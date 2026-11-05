import { Group, Progress, Text, Tooltip } from '@mantine/core';
import type { TaskStatus } from '../lib/database.types';
import { countByStatus, STATUS_META, STATUS_ORDER } from '../lib/status';

/** Полоса прогресса, разбитая по статусам задач. */
export function StatusProgress({ tasks, size = 'md' }: { tasks: { status: TaskStatus }[]; size?: string }) {
	const total = tasks.length;
	const counts = countByStatus(tasks);

	if (total === 0) return <Progress value={0} size={size} radius="xl" />;

	return (
		<Progress.Root size={size} radius="xl">
			{STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
				<Tooltip key={s} label={`${STATUS_META[s].label}: ${counts[s]}`} withArrow>
					<Progress.Section value={(counts[s] / total) * 100} color={STATUS_META[s].color} />
				</Tooltip>
			))}
		</Progress.Root>
	);
}

export function StatusLegend({ tasks }: { tasks: { status: TaskStatus }[] }) {
	const counts = countByStatus(tasks);
	return (
		<Group gap="md">
			{STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
				<Group key={s} gap={6}>
					<span
						style={{
							width: 8,
							height: 8,
							borderRadius: 999,
							background: `var(--mantine-color-${STATUS_META[s].color}-filled)`,
						}}
					/>
					<Text size="xs" c="dimmed">
						{STATUS_META[s].label} · {counts[s]}
					</Text>
				</Group>
			))}
		</Group>
	);
}
