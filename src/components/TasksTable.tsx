import { Anchor, Avatar, Group, Table, Text } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { TaskListItem } from '../api/queries';
import { formatDate, initials } from '../lib/format';
import { StatusBadge } from './StatusBadge';

interface Props {
	tasks: TaskListItem[];
	showObject?: boolean;
	showAssignee?: boolean;
}

export function TasksTable({ tasks, showObject = true, showAssignee = true }: Props) {
	const navigate = useNavigate();

	return (
		<Table.ScrollContainer minWidth={640}>
			<Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
				<Table.Thead>
					<Table.Tr>
						<Table.Th>Задача</Table.Th>
						{showObject && <Table.Th>Объект</Table.Th>}
						{showAssignee && <Table.Th>Исполнитель</Table.Th>}
						<Table.Th>Статус</Table.Th>
						<Table.Th>Обновлена</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>
					{tasks.map((t) => (
						<Table.Tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
							<Table.Td>
								<Anchor component={Link} to={`/tasks/${t.id}`} fw={600} size="sm" c="var(--mantine-color-text)" onClick={(e) => e.stopPropagation()}>
									{t.title}
								</Anchor>
							</Table.Td>
							{showObject && (
								<Table.Td>
									<Text size="sm" c="dimmed" lineClamp={1}>
										{t.object?.name ?? '—'}
									</Text>
								</Table.Td>
							)}
							{showAssignee && (
								<Table.Td>
									<Group gap="xs" wrap="nowrap">
										<Avatar size={26} radius="xl" color="blue">
											{initials(t.assignee?.full_name)}
										</Avatar>
										<Text size="sm">{t.assignee?.full_name ?? '—'}</Text>
									</Group>
								</Table.Td>
							)}
							<Table.Td>
								<StatusBadge status={t.status} />
							</Table.Td>
							<Table.Td>
								<Text size="sm" c="dimmed">
									{formatDate(t.updated_at)}
								</Text>
							</Table.Td>
						</Table.Tr>
					))}
				</Table.Tbody>
			</Table>
		</Table.ScrollContainer>
	);
}
