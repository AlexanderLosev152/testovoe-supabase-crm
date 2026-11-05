import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconMapPin } from '@tabler/icons-react';
import { useSaveObject } from '../api/queries';
import { notifyError, notifySuccess } from '../lib/errors';

interface Props {
	opened: boolean;
	onClose: () => void;
	object?: { id: string; name: string; address: string };
	onSaved?: (id: string) => void;
}

export function ObjectFormModal({ opened, onClose, object, onSaved }: Props) {
	return (
		<Modal opened={opened} onClose={onClose} title={object ? 'Редактировать объект' : 'Новый объект'} centered>
			{/* key пересоздаёт форму с актуальными начальными значениями */}
			<ObjectForm key={object?.id ?? 'new'} object={object} onClose={onClose} onSaved={onSaved} />
		</Modal>
	);
}

function ObjectForm({ object, onClose, onSaved }: Omit<Props, 'opened'>) {
	const save = useSaveObject();
	const form = useForm({
		initialValues: { name: object?.name ?? '', address: object?.address ?? '' },
		validate: {
			name: (v) => (v.trim() ? (v.trim().length > 200 ? 'Не больше 200 символов' : null) : 'Укажите название'),
			address: (v) => (v.trim() ? (v.trim().length > 500 ? 'Не больше 500 символов' : null) : 'Укажите адрес'),
		},
	});

	const submit = form.onSubmit((values) =>
		save.mutate(
			{ id: object?.id, ...values },
			{
				onSuccess: (data) => {
					notifySuccess(object ? 'Объект сохранён' : 'Объект создан');
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
				<TextInput label="Название" placeholder="ЖК «Северный», корпус 2" data-autofocus withAsterisk {...form.getInputProps('name')} />
				<TextInput
					label="Адрес"
					placeholder="г. Москва, ул. Строителей, 12"
					leftSection={<IconMapPin size={16} />}
					withAsterisk
					{...form.getInputProps('address')}
				/>
				<Group justify="flex-end" mt="sm">
					<Button variant="default" onClick={onClose}>
						Отмена
					</Button>
					<Button type="submit" loading={save.isPending}>
						{object ? 'Сохранить' : 'Создать'}
					</Button>
				</Group>
			</Stack>
		</form>
	);
}
