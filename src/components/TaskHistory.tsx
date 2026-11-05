import { Blockquote, Group, Skeleton, Text, ThemeIcon, Timeline } from '@mantine/core';
import { IconArrowRight, IconCircleCheck, IconCirclePlus, IconMessage, IconPlayerPlay, IconRotate, IconSend } from '@tabler/icons-react';
import { useTaskHistory } from '../api/queries';
import type { TaskStatus } from '../lib/database.types';
import { formatDateTime } from '../lib/format';
import { STATUS_META } from '../lib/status';
import { ErrorState } from './ErrorState';
import { StatusBadge } from './StatusBadge';

const ICON: Record<TaskStatus, typeof IconCirclePlus> = {
	new: IconCirclePlus,
	in_progress: IconPlayerPlay,
	review: IconSend,
	rework: IconRotate,
	accepted: IconCircleCheck,
};

const VERB: Record<TaskStatus, string> = {
	new: 'Задача создана',
	in_progress: 'Взята в работу',
	review: 'Отправлена на проверку',
	rework: 'Возвращена на доработку',
	accepted: 'Принята',
};

export function TaskHistory({ taskId }: { taskId: string }) {
	const history = useTaskHistory(taskId);

	if (history.isPending) {
		return (
			<>
				<Skeleton h={48} mb="sm" />
				<Skeleton h={48} />
			</>
		);
	}
	if (history.error) return <ErrorState error={history.error} />;

	const items = history.data;

	return (
		<Timeline active={items.length - 1} bulletSize={28} lineWidth={2}>
			{items.map((h) => {
				const Icon = ICON[h.to_status];
				return (
					<Timeline.Item
						key={h.id}
						bullet={
							<ThemeIcon size={28} radius="xl" color={STATUS_META[h.to_status].color}>
								<Icon size={15} />
							</ThemeIcon>
						}
						title={<Text fw={600} size="sm">{VERB[h.to_status]}</Text>}
					>
						{h.from_status && (
							<Group gap={6} mt={4}>
								<StatusBadge status={h.from_status} size="xs" />
								<IconArrowRight size={12} />
								<StatusBadge status={h.to_status} size="xs" />
							</Group>
						)}
						<Text size="xs" c="dimmed" mt={4}>
							{h.actor?.full_name ?? 'Пользователь'} · {formatDateTime(h.created_at)}
						</Text>
						{h.comment && (
							<Blockquote
								color={STATUS_META[h.to_status].color}
								icon={<IconMessage size={14} />}
								iconSize={26}
								mt="sm"
								p="sm"
								pl="md"
								style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--mantine-font-size-sm)' }}
							>
								{h.comment}
							</Blockquote>
						)}
					</Timeline.Item>
				);
			})}
		</Timeline>
	);
}
