import { Button, Card, Group, SegmentedControl, Select, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingSkyscraper, IconListCheck, IconPlus, IconSearch, IconUser } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExecutors, useObjects, useTasks } from '../api/queries';
import { useProfile } from '../auth/AuthContext';
import { EmptyBlock, ErrorState } from '../components/ErrorState';
import { TaskFormModal } from '../components/TaskFormModal';
import { TasksTable } from '../components/TasksTable';
import type { TaskStatus } from '../lib/database.types';
import { countByStatus, STATUS_META, STATUS_ORDER } from '../lib/status';

type Filter = 'active' | 'all' | TaskStatus;

export function TasksPage() {
	const profile = useProfile();
	const isManager = profile.role === 'manager';
	const navigate = useNavigate();

	// Для исполнителя явно фильтруем по себе (RLS и так не отдаст чужие задачи).
	const tasks = useTasks(isManager ? {} : { assigneeId: profile.id });
	const objects = useObjects();
	const executors = useExecutors(isManager);

	const [status, setStatus] = useState<Filter>('active');
	const [search, setSearch] = useState('');
	const [objectId, setObjectId] = useState<string | null>(null);
	const [assigneeId, setAssigneeId] = useState<string | null>(null);
	const [formOpened, form] = useDisclosure(false);

	const all = tasks.data ?? [];
	const counts = countByStatus(all);
	const activeCount = all.length - counts.accepted;
	const q = search.trim().toLowerCase();

	const visible = all.filter(
		(t) =>
			(status === 'all' || (status === 'active' ? t.status !== 'accepted' : t.status === status)) &&
			(!q || t.title.toLowerCase().includes(q)) &&
			(!objectId || t.object_id === objectId) &&
			(!assigneeId || t.assignee_id === assigneeId),
	);

	// Подсказка исполнителю: что требует его действия.
	const actionable = isManager ? counts.review : counts.new + counts.rework;

	return (
		<Stack gap="lg">
			<Group justify="space-between" align="flex-end">
				<div>
					<Title order={2}>{isManager ? 'Все задачи' : 'Мои задачи'}</Title>
					<Text c="dimmed" size="sm">
						{actionable > 0
							? isManager
								? `Ждут проверки: ${actionable}`
								: `Ждут ваших действий: ${actionable}`
							: isManager
								? 'Задачи по всем объектам'
								: 'Задачи, назначенные вам'}
					</Text>
				</div>
				{isManager && (
					<Button leftSection={<IconPlus size={16} />} onClick={form.open}>
						Новая задача
					</Button>
				)}
			</Group>

			<Card withBorder radius="md" padding={0}>
				<Stack gap="sm" p="md">
					<SegmentedControl
						value={status}
						onChange={(v) => setStatus(v as Filter)}
						style={{ alignSelf: 'flex-start', maxWidth: '100%', overflowX: 'auto' }}
						data={[
							{ value: 'active', label: `Активные · ${activeCount}` },
							...STATUS_ORDER.map((s) => ({ value: s, label: `${STATUS_META[s].label} · ${counts[s]}` })),
							{ value: 'all', label: `Все · ${all.length}` },
						]}
					/>
					<Group grow>
						<TextInput placeholder="Поиск по названию" leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
						<Select
							placeholder="Все объекты"
							leftSection={<IconBuildingSkyscraper size={16} />}
							data={(objects.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
							value={objectId}
							onChange={setObjectId}
							clearable
							searchable
						/>
						{isManager && (
							<Select
								placeholder="Все исполнители"
								leftSection={<IconUser size={16} />}
								data={(executors.data ?? []).map((p) => ({ value: p.id, label: p.full_name }))}
								value={assigneeId}
								onChange={setAssigneeId}
								clearable
								searchable
							/>
						)}
					</Group>
				</Stack>

				{tasks.isPending ? (
					<Stack p="md">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} h={36} />
						))}
					</Stack>
				) : tasks.error ? (
					<ErrorState error={tasks.error} action={{ label: 'Повторить', onClick: () => tasks.refetch() }} />
				) : visible.length === 0 ? (
					<EmptyBlock
						icon={<IconListCheck size={30} />}
						title={all.length === 0 ? 'Задач пока нет' : 'Нет задач по выбранным фильтрам'}
						description={all.length === 0 && !isManager ? 'Когда постановщик назначит вам задачу, она появится здесь.' : undefined}
					/>
				) : (
					<TasksTable tasks={visible} showAssignee={isManager} />
				)}
			</Card>

			{isManager && <TaskFormModal opened={formOpened} onClose={form.close} onSaved={(id) => navigate(`/tasks/${id}`)} />}
		</Stack>
	);
}
