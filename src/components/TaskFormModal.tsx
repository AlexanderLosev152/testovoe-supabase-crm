import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconBuildingSkyscraper, IconUser } from '@tabler/icons-react';
import { useExecutors, useObjects, useSaveTask, type TaskInput } from '../api/queries';
import { notifyError, notifySuccess } from '../lib/errors';

interface Props {
	opened: boolean;
	onClose: () => void;
	task?: Required<Pick<TaskInput, 'id'>> & Omit<TaskInput, 'id'>;
	defaultObjectId?: string;
	onSaved?: (id: string) => void;
}

export function TaskFormModal({ opened, onClose, task, defaultObjectId, onSaved }: Props) {
	return (
		<Modal opened={opened} onClose={onClose} title={task ? 'Редактировать задачу' : 'Новая задача'} size="lg" centered>
			<TaskForm key={task?.id ?? `new-${defaultObjectId ?? ''}`} task={task} defaultObjectId={defaultObjectId} onClose={onClose} onSaved={onSaved} />
		</Modal>
	);
}

function TaskForm({ task, defaultObjectId, onClose, onSaved }: Omit<Props, 'opened'>) {
	const save = useSaveTask();
	const objects = useObjects();
	const executors = useExecutors();

	const form = useForm({
		initialValues: {
			title: task?.title ?? '',
			description: task?.description ?? '',
			object_id: task?.object_id ?? defaultObjectId ?? '',
			assignee_id: task?.assignee_id ?? '',
		},
		validate: {
			title: (v) => (v.trim() ? (v.trim().length > 200 ? 'Не больше 200 символов' : null) : 'Укажите название'),
			description: (v) => (v.length > 5000 ? 'Не больше 5000 символов' : null),
			object_id: (v) => (v ? null : 'Выберите объект'),
			assignee_id: (v) => (v ? null : 'Выберите исполнителя'),
		},
	});

	const submit = form.onSubmit((values) =>
		save.mutate(
			{ id: task?.id, ...values },
			{
				onSuccess: (data) => {
					notifySuccess(task ? 'Задача сохранена' : 'Задача создана');
					onClose();
					onSaved?.(data.id);
				},
				onError: (e) => notifyError(e),
			},
		),
	);

	return (
		<form onSubmit={submit}>
			<Stack>
				<TextInput label="Название" placeholder="Залить фундамент секции А" data-autofocus withAsterisk {...form.getInputProps('title')} />
				<Textarea
					label="Описание"
					placeholder="Что нужно сделать, сроки, материалы…"
					autosize
					minRows={3}
					maxRows={10}
					{...form.getInputProps('description')}
				/>
				<Group grow align="flex-start">
					<Select
						label="Объект"
						placeholder="Выберите объект"
						leftSection={<IconBuildingSkyscraper size={16} />}
						data={(objects.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
						searchable
						nothingFoundMessage="Ничего не найдено"
						disabled={objects.isPending}
						withAsterisk
						{...form.getInputProps('object_id')}
					/>
					<Select
						label="Исполнитель"
						placeholder="Выберите исполнителя"
						leftSection={<IconUser size={16} />}
						data={(executors.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
						searchable
						nothingFoundMessage="Нет исполнителей"
						disabled={executors.isPending}
						withAsterisk
						{...form.getInputProps('assignee_id')}
					/>
				</Group>
				<Group justify="flex-end" mt="sm">
					<Button variant="default" onClick={onClose}>
						Отмена
					</Button>
					<Button type="submit" loading={save.isPending}>
						{task ? 'Сохранить' : 'Создать задачу'}
					</Button>
				</Group>
			</Stack>
		</form>
	);
}
