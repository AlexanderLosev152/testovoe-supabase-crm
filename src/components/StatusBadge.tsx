import { Badge, type BadgeProps } from '@mantine/core';
import type { TaskStatus } from '../lib/database.types';
import { STATUS_META } from '../lib/status';

export function StatusBadge({ status, ...rest }: { status: TaskStatus } & BadgeProps) {
	const meta = STATUS_META[status];
	return (
		<Badge color={meta.color} variant="light" radius="sm" {...rest}>
			{meta.label}
		</Badge>
	);
}
