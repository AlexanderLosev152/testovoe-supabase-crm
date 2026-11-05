import { ActionIcon, Anchor, Avatar, Breadcrumbs, Button, Card, Grid, Group, Menu, Stack, Text, Title, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingSkyscraper, IconCalendar, IconDots, IconMapPin, IconPencil, IconTrash, IconUserCheck, IconUserEdit } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteTask, useTask } from '../api/queries';
import { useProfile } from '../auth/AuthContext';
import { confirmDelete } from '../components/ConfirmDelete';
import { EmptyBlock, ErrorState, PageLoader } from '../components/ErrorState';
import { StatusBadge } from '../components/StatusBadge';
import { TaskActions } from '../components/TaskActions';
import { TaskFormModal } from '../components/TaskFormModal';
import { TaskHistory } from '../components/TaskHistory';
import { notifyError, notifySuccess } from '../lib/errors';
import { formatDateTime, initials } from '../lib/format';

export function TaskPage() {
	const { id = '' } = useParams();
	const profile = useProfile();
	const isManager = profile.role === 'manager';
	const navigate = useNavigate();
	const task = useTask(id);
	const del = useDeleteTask();
	const [editOpened, edit] = useDisclosure(false);

	if (task.isPending) return <PageLoader />;
	if (task.error) return <ErrorState error={task.error} />;
	if (!task.data) {
		return (
			<EmptyBlock title="Задача не найдена" description="Возможно, она удалена или назначена не вам.">
				<Button component={Link} to="/tasks" variant="light" mt="sm">
					К списку задач
				</Button>
			</EmptyBlock>
		);
	}

	const t = task.data;
	const locked = t.status === 'accepted';

	const onDelete = () =>
		confirmDelete({
			title: 'Удалить задачу?',
			message: 'Задача и её история будут удалены без возможности восстановления.',
			onConfirm: () =>
				del.mutate(t.id, {
					onSuccess: () => {
						notifySuccess('Задача удалена');
						navigate(t.object ? `/objects/${t.object.id}` : '/tasks');
					},
					onError: (e) => notifyError(e),
				}),
		});

	return (
		<Stack gap="lg">
			<Breadcrumbs>
				<Anchor component={Link} to="/objects" size="sm">
					Объекты
				</Anchor>
				{t.object && (
					<Anchor component={Link} to={`/objects/${t.object.id}`} size="sm">
						{t.object.name}
					</Anchor>
				)}
				<Text size="sm" c="dimmed" lineClamp={1}>
					{t.title}
				</Text>
			</Breadcrumbs>

			<Group justify="space-between" align="flex-start" wrap="nowrap">
				<div style={{ minWidth: 0 }}>
					<StatusBadge status={t.status} size="lg" mb="xs" />
					<Title order={2}>{t.title}</Title>
				</div>
				{isManager && (
					<Menu position="bottom-end" shadow="md">
						<Menu.Target>
							<ActionIcon variant="default" size="lg" aria-label="Действия с задачей">
								<IconDots size={18} />
							</ActionIcon>
						</Menu.Target>
						<Menu.Dropdown>
							<Tooltip label="Принятую задачу нельзя редактировать" disabled={!locked} position="left">
								<div>
									<Menu.Item leftSection={<IconPencil size={16} />} onClick={edit.open} disabled={locked}>
										Редактировать
									</Menu.Item>
								</div>
							</Tooltip>
							<Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={onDelete}>
								Удалить
							</Menu.Item>
						</Menu.Dropdown>
					</Menu>
				)}
			</Group>

			<Grid gap="lg">
				<Grid.Col span={{ base: 12, md: 8 }}>
					<Stack gap="lg">
						<Card withBorder radius="md" padding="lg">
							<Title order={5} mb="sm">
								Описание
							</Title>
							{t.description ? (
								<Text style={{ whiteSpace: 'pre-wrap' }}>{t.description}</Text>
							) : (
								<Text c="dimmed" fs="italic">
									Без описания
								</Text>
							)}
						</Card>

						<Card withBorder radius="md" padding="lg">
							<Title order={5} mb="lg">
								История
							</Title>
							<TaskHistory taskId={t.id} />
						</Card>
					</Stack>
				</Grid.Col>

				<Grid.Col span={{ base: 12, md: 4 }}>
					<Stack gap="lg">
						<Card withBorder radius="md" padding="lg">
							<Title order={5} mb="md">
								Действия
							</Title>
							<TaskActions task={t} />
						</Card>

						<Card withBorder radius="md" padding="lg">
							<Stack gap="md">
								<Field icon={<IconBuildingSkyscraper size={16} />} label="Объект">
									{t.object ? (
										<>
											<Anchor component={Link} to={`/objects/${t.object.id}`} size="sm" fw={600}>
												{t.object.name}
											</Anchor>
											<Group gap={4} c="dimmed" wrap="nowrap">
												<IconMapPin size={12} style={{ flexShrink: 0 }} />
												<Text size="xs">{t.object.address}</Text>
											</Group>
										</>
									) : (
										'—'
									)}
								</Field>
								<Field icon={<IconUserCheck size={16} />} label="Исполнитель">
									<Person name={t.assignee?.full_name} color="blue" you={t.assignee_id === profile.id} />
								</Field>
								<Field icon={<IconUserEdit size={16} />} label="Автор">
									<Person name={t.author?.full_name} color="orange" you={t.author_id === profile.id} />
								</Field>
								<Field icon={<IconCalendar size={16} />} label="Создана">
									<Text size="sm">{formatDateTime(t.created_at)}</Text>
								</Field>
								<Field icon={<IconCalendar size={16} />} label="Обновлена">
									<Text size="sm">{formatDateTime(t.updated_at)}</Text>
								</Field>
							</Stack>
						</Card>
					</Stack>
				</Grid.Col>
			</Grid>

			{isManager && (
				<TaskFormModal
					opened={editOpened}
					onClose={edit.close}
					task={{ id: t.id, title: t.title, description: t.description, object_id: t.object_id, assignee_id: t.assignee_id }}
				/>
			)}
		</Stack>
	);
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
	return (
		<div>
			<Group gap={6} c="dimmed" mb={4}>
				{icon}
				<Text size="xs" tt="uppercase" fw={600} lts={0.4}>
					{label}
				</Text>
			</Group>
			{children}
		</div>
	);
}

function Person({ name, color, you }: { name?: string | null; color: string; you?: boolean }) {
	if (!name) return <Text size="sm">—</Text>;
	return (
		<Group gap="xs" wrap="nowrap">
			<Avatar size={28} radius="xl" color={color}>
				{initials(name)}
			</Avatar>
			<Text size="sm" fw={500}>
				{name}
				{you && (
					<Text span c="dimmed" size="sm">
						{' '}
						(вы)
					</Text>
				)}
			</Text>
		</Group>
	);
}
