import { Button, Card, Group, SimpleGrid, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingSkyscraper, IconMapPin, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useObjects } from '../api/queries';
import { useProfile } from '../auth/AuthContext';
import { EmptyBlock, ErrorState } from '../components/ErrorState';
import { ObjectFormModal } from '../components/ObjectFormModal';
import { StatusLegend, StatusProgress } from '../components/StatusProgress';
import { plural } from '../lib/format';

export function ObjectsPage() {
	const profile = useProfile();
	const isManager = profile.role === 'manager';
	const objects = useObjects();
	const navigate = useNavigate();
	const [search, setSearch] = useState('');
	const [formOpened, form] = useDisclosure(false);

	const q = search.trim().toLowerCase();
	const list = (objects.data ?? []).filter((o) => !q || o.name.toLowerCase().includes(q) || o.address.toLowerCase().includes(q));

	return (
		<Stack gap="lg">
			<Group justify="space-between" align="flex-end">
				<div>
					<Title order={2}>Объекты</Title>
					<Text c="dimmed" size="sm">
						{isManager ? 'Все стройки компании' : 'Стройки, на которых у вас есть задачи'}
					</Text>
				</div>
				<Group>
					<TextInput
						placeholder="Поиск по названию или адресу"
						leftSection={<IconSearch size={16} />}
						value={search}
						onChange={(e) => setSearch(e.currentTarget.value)}
						w={{ base: '100%', xs: 280 }}
					/>
					{isManager && (
						<Button leftSection={<IconPlus size={16} />} onClick={form.open}>
							Добавить объект
						</Button>
					)}
				</Group>
			</Group>

			{objects.isPending ? (
				<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} h={150} radius="md" />
					))}
				</SimpleGrid>
			) : objects.error ? (
				<ErrorState error={objects.error} action={{ label: 'Повторить', onClick: () => objects.refetch() }} />
			) : list.length === 0 ? (
				<Card withBorder radius="md">
					<EmptyBlock
						icon={<IconBuildingSkyscraper size={30} />}
						title={q ? 'Ничего не найдено' : 'Объектов пока нет'}
						description={
							q ? 'Попробуйте изменить запрос' : isManager ? 'Добавьте первую стройку, чтобы ставить по ней задачи.' : 'Когда вам назначат задачу, здесь появится её объект.'
						}
					>
						{isManager && !q && (
							<Button mt="sm" leftSection={<IconPlus size={16} />} onClick={form.open}>
								Добавить объект
							</Button>
						)}
					</EmptyBlock>
				</Card>
			) : (
				<SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
					{list.map((o) => {
						const done = o.tasks.filter((t) => t.status === 'accepted').length;
						return (
							<Card
								key={o.id}
								withBorder
								radius="md"
								padding="lg"
								component={Link}
								to={`/objects/${o.id}`}
								className="hover-card"
							>
								<Stack gap="sm" h="100%">
									<div>
										<Text fw={700} size="lg" lineClamp={2}>
											{o.name}
										</Text>
										<Group gap={4} wrap="nowrap" c="dimmed" mt={4}>
											<IconMapPin size={14} style={{ flexShrink: 0 }} />
											<Text size="sm" lineClamp={1}>
												{o.address}
											</Text>
										</Group>
									</div>
									<div style={{ marginTop: 'auto' }}>
										<Group justify="space-between" mb={6}>
											<Text size="sm" fw={500}>
												{o.tasks.length} {plural(o.tasks.length, ['задача', 'задачи', 'задач'])}
											</Text>
											<Text size="sm" c="dimmed">
												принято {done} из {o.tasks.length}
											</Text>
										</Group>
										<StatusProgress tasks={o.tasks} size="sm" />
										<Stack mt="xs">
											<StatusLegend tasks={o.tasks} />
										</Stack>
									</div>
								</Stack>
							</Card>
						);
					})}
				</SimpleGrid>
			)}

			{isManager && <ObjectFormModal opened={formOpened} onClose={form.close} onSaved={(id) => navigate(`/objects/${id}`)} />}
		</Stack>
	);
}
