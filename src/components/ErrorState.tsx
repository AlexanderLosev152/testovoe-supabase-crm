import { Button, Center, Loader, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconMoodEmpty } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { errorMessage } from '../lib/errors';

interface Action {
	label: string;
	onClick: () => void;
}

export function ErrorState({ error, action }: { error: unknown; action?: Action }) {
	return (
		<Stack align="center" gap="xs" py="xl" maw={420} mx="auto" ta="center">
			<ThemeIcon size={56} radius="xl" color="red" variant="light">
				<IconAlertTriangle size={30} />
			</ThemeIcon>
			<Title order={4}>Что-то пошло не так</Title>
			<Text c="dimmed" size="sm">
				{errorMessage(error)}
			</Text>
			{action && (
				<Button variant="light" mt="sm" onClick={action.onClick}>
					{action.label}
				</Button>
			)}
		</Stack>
	);
}

export function EmptyBlock({ title, description, icon, children }: { title: string; description?: ReactNode; icon?: ReactNode; children?: ReactNode }) {
	return (
		<Stack align="center" gap="xs" py={48} ta="center">
			<ThemeIcon size={56} radius="xl" color="gray" variant="light">
				{icon ?? <IconMoodEmpty size={30} />}
			</ThemeIcon>
			<Text fw={600}>{title}</Text>
			{description && (
				<Text c="dimmed" size="sm" maw={380}>
					{description}
				</Text>
			)}
			{children}
		</Stack>
	);
}

export function PageLoader() {
	return (
		<Center py={80}>
			<Loader />
		</Center>
	);
}
