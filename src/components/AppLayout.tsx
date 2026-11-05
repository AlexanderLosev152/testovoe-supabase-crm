import {
	ActionIcon,
	AppShell,
	Avatar,
	Badge,
	Burger,
	Center,
	Group,
	Loader,
	NavLink,
	Stack,
	Text,
	ThemeIcon,
	Tooltip,
	useComputedColorScheme,
	useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconBuildingSkyscraper, IconHomeBolt, IconListCheck, IconLogout, IconMoon, IconSun } from '@tabler/icons-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { initials } from '../lib/format';
import { ROLE_LABEL } from '../lib/status';
import { ErrorState } from './ErrorState';

export function AppLayout() {
	const { session, profile, profileLoading, profileError, signOut } = useAuth();
	const location = useLocation();
	const [opened, { toggle, close }] = useDisclosure();
	const { setColorScheme } = useMantineColorScheme();
	const scheme = useComputedColorScheme('light');

	if (session === undefined || profileLoading) {
		return (
			<Center h="100vh">
				<Loader />
			</Center>
		);
	}
	if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
	if (!profile) {
		return (
			<Center h="100vh" p="md">
				<ErrorState
					error={profileError ?? new Error('Профиль пользователя не найден. Обратитесь к администратору.')}
					action={{ label: 'Выйти', onClick: signOut }}
				/>
			</Center>
		);
	}

	const isManager = profile.role === 'manager';
	const links = [
		{ to: '/objects', label: 'Объекты', icon: IconBuildingSkyscraper },
		{ to: '/tasks', label: isManager ? 'Все задачи' : 'Мои задачи', icon: IconListCheck },
	];

	return (
		<AppShell
			header={{ height: 60 }}
			navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
			padding={{ base: 'md', sm: 'xl' }}
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between">
					<Group gap="sm">
						<Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
						<ThemeIcon size={34} radius="md" variant="gradient" gradient={{ from: 'orange', to: 'red', deg: 135 }}>
							<IconHomeBolt size={20} />
						</ThemeIcon>
						<div>
							<Text fw={700} lh={1.1}>
								СтройКонтроль
							</Text>
							<Text size="xs" c="dimmed" lh={1.1}>
								объекты и задачи
							</Text>
						</div>
					</Group>
					<Tooltip label={scheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
						<ActionIcon
							variant="default"
							size="lg"
							aria-label="Сменить тему"
							onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
						>
							{scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
						</ActionIcon>
					</Tooltip>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<AppShell.Section grow>
					<Stack gap={4}>
						{links.map((l) => (
							<NavLink
								key={l.to}
								component={Link}
								to={l.to}
								label={l.label}
								leftSection={<l.icon size={20} stroke={1.6} />}
								active={location.pathname.startsWith(l.to)}
								onClick={close}
								variant="light"
								style={{ borderRadius: 'var(--mantine-radius-md)' }}
							/>
						))}
					</Stack>
				</AppShell.Section>

				<AppShell.Section>
					<Group
						gap="sm"
						wrap="nowrap"
						p="sm"
						style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)' }}
					>
						<Avatar color={isManager ? 'orange' : 'blue'} radius="xl">
							{initials(profile.full_name)}
						</Avatar>
						<div style={{ flex: 1, minWidth: 0 }}>
							<Text size="sm" fw={600} truncate>
								{profile.full_name}
							</Text>
							<Badge size="xs" variant="light" color={isManager ? 'orange' : 'blue'}>
								{ROLE_LABEL[profile.role]}
							</Badge>
						</div>
						<Tooltip label="Выйти">
							<ActionIcon variant="subtle" color="gray" onClick={signOut} aria-label="Выйти">
								<IconLogout size={18} />
							</ActionIcon>
						</Tooltip>
					</Group>
				</AppShell.Section>
			</AppShell.Navbar>

			<AppShell.Main>
				<div style={{ maxWidth: 1200, margin: '0 auto' }}>
					<Outlet />
				</div>
			</AppShell.Main>
		</AppShell>
	);
}
