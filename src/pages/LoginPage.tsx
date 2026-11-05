import { Alert, Box, Button, Center, Paper, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconHomeBolt, IconLock, IconMail } from '@tabler/icons-react';
import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/errors';

export function LoginPage() {
	const { session, signIn } = useAuth();
	const location = useLocation();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const form = useForm({
		initialValues: { email: '', password: '' },
		validate: {
			email: (v) => (/^\S+@\S+\.\S+$/.test(v.trim()) ? null : 'Введите корректный email'),
			password: (v) => (v ? null : 'Введите пароль'),
		},
	});

	if (session) {
		const from = (location.state as { from?: string } | null)?.from;
		return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
	}

	const submit = form.onSubmit(async ({ email, password }) => {
		setError(null);
		setLoading(true);
		try {
			await signIn(email.trim(), password);
		} catch (e) {
			setError(errorMessage(e));
		} finally {
			setLoading(false);
		}
	});

	return (
		<Box
			mih="100vh"
			style={{
				background:
					'radial-gradient(1200px 600px at 10% -10%, var(--mantine-color-orange-light), transparent), radial-gradient(900px 500px at 110% 110%, var(--mantine-color-blue-light), transparent)',
			}}
		>
			<Center mih="100vh" p="md">
				<Paper withBorder shadow="md" radius="lg" p={36} w="100%" maw={420}>
					<Stack align="center" gap={6} mb="xl">
						<ThemeIcon size={56} radius="lg" variant="gradient" gradient={{ from: 'orange', to: 'red', deg: 135 }}>
							<IconHomeBolt size={30} />
						</ThemeIcon>
						<Title order={2} mt="sm">
							СтройКонтроль
						</Title>
						<Text c="dimmed" size="sm">
							Войдите, чтобы увидеть объекты и задачи
						</Text>
					</Stack>

					<form onSubmit={submit}>
						<Stack>
							{error && (
								<Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
									{error}
								</Alert>
							)}
							<TextInput
								label="Email"
								placeholder="name@company.ru"
								autoComplete="email"
								leftSection={<IconMail size={16} />}
								{...form.getInputProps('email')}
							/>
							<PasswordInput
								label="Пароль"
								placeholder="••••••••"
								autoComplete="current-password"
								leftSection={<IconLock size={16} />}
								{...form.getInputProps('password')}
							/>
							<Button type="submit" size="md" mt="sm" loading={loading} fullWidth>
								Войти
							</Button>
							<Text size="xs" c="dimmed" ta="center">
								Регистрация закрыта. Доступ выдаёт администратор.
							</Text>
						</Stack>
					</form>
				</Paper>
			</Center>
		</Box>
	);
}
