import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { IconArrowRight, IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useChangeStatus } from '../api/queries';
import { useProfile } from '../auth/AuthContext';
import type { TaskStatus } from '../lib/database.types';
import { notifyError, notifySuccess } from '../lib/errors';
import { getAvailableTransitions, STATUS_META, waitingHint, type Transition } from '../lib/status';
import { StatusBadge } from './StatusBadge';

export function TaskActions({ task }: { task: { id: string; status: TaskStatus; assignee_id: string } }) {
	const profile = useProfile();
	const change = useChangeStatus();
	const [pending, setPending] = useState<Transition | null>(null);

	const actions = getAvailableTransitions(task, profile);

	const run = (t: Transition, comment?: string) =>
		change.mutate(
			{ taskId: task.id, to: t.to, comment },
			{
				onSuccess: () => {
					notifySuccess(`Статус изменён: «${STATUS_META[t.to].label}»`);
					setPending(null);
				},
				onError: (e) => notifyError(e, 'Не удалось сменить статус'),
			},
		);

	if (actions.length === 0) {
		return (
			<Group gap="xs" wrap="nowrap" c="dimmed">
				<IconInfoCircle size={18} style={{ flexShrink: 0 }} />
				<Text size="sm">{waitingHint(task.status, profile.role)}</Text>
			</Group>
		);
	}

	return (
		<>
			<Stack gap="xs">
				{actions.map((t) => (
					<Button
						key={t.to}
						color={t.color}
						variant={t.to === 'rework' ? 'light' : 'filled'}
						fullWidth
						rightSection={<IconArrowRight size={16} />}
						loading={change.isPending && change.variables?.to === t.to}
						disabled={change.isPending}
						onClick={() => (t.comment === 'none' ? run(t) : setPending(t))}
					>
						{t.label}
					</Button>
				))}
			</Stack>

			<CommentModal transition={pending} loading={change.isPending} onClose={() => setPending(null)} onSubmit={(c) => pending && run(pending, c)} />
		</>
	);
}

function CommentModal({
	transition,
	loading,
	onClose,
	onSubmit,
}: {
	transition: Transition | null;
	loading: boolean;
	onClose: () => void;
	onSubmit: (comment: string) => void;
}) {
	return (
		<Modal opened={!!transition} onClose={onClose} title={transition?.label} centered>
			{transition && <CommentForm key={transition.to} transition={transition} loading={loading} onClose={onClose} onSubmit={onSubmit} />}
		</Modal>
	);
}

function CommentForm({
	transition,
	loading,
	onClose,
	onSubmit,
}: {
	transition: Transition;
	loading: boolean;
	onClose: () => void;
	onSubmit: (comment: string) => void;
}) {
	const [comment, setComment] = useState('');
	const [error, setError] = useState<string | null>(null);
	const required = transition.comment === 'required';

	const submit = (e: { preventDefault: () => void }) => {
		e.preventDefault();
		if (required && !comment.trim()) return setError('Опишите, что нужно исправить');
		if (comment.length > 2000) return setError('Не больше 2000 символов');
		onSubmit(comment);
	};

	return (
		<form onSubmit={submit}>
			<Stack>
				<Group gap="xs">
					<StatusBadge status={transition.from} />
					<IconArrowRight size={14} />
					<StatusBadge status={transition.to} />
				</Group>
				<Textarea
					label={required ? 'Комментарий' : 'Комментарий (необязательно)'}
					description={required ? 'Исполнитель увидит его в истории задачи' : undefined}
					placeholder={required ? 'Что нужно доработать?' : 'Например, что сделано'}
					withAsterisk={required}
					autosize
					minRows={3}
					maxRows={8}
					data-autofocus
					value={comment}
					error={error}
					onChange={(e) => {
						setComment(e.currentTarget.value);
						setError(null);
					}}
				/>
				<Group justify="flex-end">
					<Button variant="default" onClick={onClose}>
						Отмена
					</Button>
					<Button type="submit" color={transition.color} loading={loading}>
						{transition.label}
					</Button>
				</Group>
			</Stack>
		</form>
	);
}
