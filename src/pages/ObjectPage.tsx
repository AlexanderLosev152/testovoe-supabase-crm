import { ActionIcon, Anchor, Breadcrumbs, Button, Card, Group, Menu, SegmentedControl, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDots, IconListCheck, IconMapPin, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteObject, useObject, useObjectTasks } from '../api/queries';
import { useProfile } from '../auth/AuthContext';
import { confirmDelete } from '../components/ConfirmDelete';
import { EmptyBlock, ErrorState, PageLoader } from '../components/ErrorState';
import { ObjectFormModal } from '../components/ObjectFormModal';
import { StatusLegend, StatusProgress } from '../components/StatusProgress';
import { TaskFormModal } from '../components/TaskFormModal';
import { TasksTable } from '../components/TasksTable';
import type { TaskStatus } from '../lib/database.types';
import { notifyError, notifySuccess } from '../lib/errors';
import { formatDate, plural } from '../lib/format';
import { countByStatus, STATUS_META, STATUS_ORDER } from '../lib/status';

export function ObjectPage() {
	const { id = '' } = useParams();
	const profile = useProfile();
	const isManager = profile.role === 'manager';
	const navigate = useNavigate();

	const object = useObject(id);
	const tasks = useObjectTasks(id);
	const del = useDeleteObject();

	const [editOpened, edit] = useDisclosure(false);
	const [taskOpened, taskForm] = useDisclosure(false);
	const [filter, setFilter] = useState<'all' | TaskStatus>('all');

	if (object.isPending) return <PageLoader />;
	if (object.error) return <ErrorState error={object.error} />;
	if (!object.data) {
		return (
			<EmptyBlock title="Объект не найден" description="Возможно, он удалён или у вас нет к нему доступа.">
				<Button component={Link} to="/objects" variant="light" mt="sm">
					К списку объектов
				</Button>
			</EmptyBlock>
		);
	}

	const o = object.data;
	const allTasks = tasks.data ?? [];
	const counts = countByStatus(allTasks);
	const visible = filter === 'all' ? allTasks : allTasks.filter((t) => t.status === filter);

	const onDelete = () =>
		confirmDelete({
			title: 'Удалить объект?',
			message: allTasks.length
				? `Вместе с объектом будут удалены ${allTasks.length} ${plural(allTasks.length, ['задача', 'задачи', 'задач'])} и их история. Действие необратимо.`
				: 'Действие необратимо.',
			onConfirm: () =>
				del.mutate(o.id, {
					onSuccess: () => {
						notifySuccess('Объект удалён');
						navigate('/objects');
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
				<Text size="sm" c="dimmed" lineClamp={1}>
					{o.name}
				</Text>
			</Breadcrumbs>

			<Card withBorder radius="md" padding="lg">
				<Group justify="space-between" align="flex-start" wrap="nowrap">
					<div style={{ minWidth: 0 }}>
						<Title order={2}>{o.name}</Title>
						<Group gap={6} c="dimmed" mt={6} wrap="nowrap">
							<IconMapPin size={16} style={{ flexShrink: 0 }} />
							<Text size="sm">{o.address}</Text>
						</Group>
						<Text size="xs" c="dimmed" mt={6}>
							Создан {formatDate(o.created_at)}
							{o.creator ? ` · ${o.creator.full_name}` : ''}
						</Text>
					</div>
					{isManager && (
						<Menu position="bottom-end" shadow="md">
							<Menu.Target>
								<ActionIcon variant="default" size="lg" aria-label="Действия с объектом">
									<IconDots size={18} />
								</ActionIcon>
							</Menu.Target>
							<Menu.Dropdown>
								<Menu.Item leftSection={<IconPencil size={16} />} onClick={edit.open}>
									Редактировать
								</Menu.Item>
								<Menu.Item leftSection={<IconTrash size={16} />} color="red" onClick={onDelete}>
									Удалить
								</Menu.Item>
							</Menu.Dropdown>
						</Menu>
					)}
				</Group>
				{allTasks.length > 0 && (
					<Stack gap={8} mt="lg">
						<StatusProgress tasks={allTasks} />
						<StatusLegend tasks={allTasks} />
					</Stack>
				)}
			</Card>

			<Card withBorder radius="md" padding={0}>
				<Group justify="space-between" p="md" pb="sm">
					<Title order={4}>{isManager ? 'Задачи по объекту' : 'Мои задачи по объекту'}</Title>
					{isManager && (
						<Button size="sm" leftSection={<IconPlus size={16} />} onClick={taskForm.open}>
							Новая задача
						</Button>
					)}
				</Group>

				{allTasks.length > 0 && (
					<Group px="md" pb="sm">
						<SegmentedControl
							size="xs"
							value={filter}
							onChange={(v) => setFilter(v as typeof filter)}
							data={[
								{ value: 'all', label: `Все · ${allTasks.length}` },
								...STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => ({ value: s, label: `${STATUS_META[s].label} · ${counts[s]}` })),
							]}
						/>
					</Group>
				)}

				{tasks.isPending ? (
					<PageLoader />
				) : tasks.error ? (
					<ErrorState error={tasks.error} />
				) : allTasks.length === 0 ? (
					<EmptyBlock
						icon={<IconListCheck size={30} />}
						title="Задач пока нет"
						description={isManager ? 'Создайте задачу и назначьте исполнителя.' : undefined}
					/>
				) : (
					<TasksTable tasks={visible} showObject={false} showAssignee={isManager} />
				)}
			</Card>

			{isManager && (
				<>
					<ObjectFormModal opened={editOpened} onClose={edit.close} object={o} />
					<TaskFormModal opened={taskOpened} onClose={taskForm.close} defaultObjectId={o.id} onSaved={(tid) => navigate(`/tasks/${tid}`)} />
				</>
			)}
		</Stack>
	);
}
