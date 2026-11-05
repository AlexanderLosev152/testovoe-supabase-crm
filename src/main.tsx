import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './global.css';

import { createTheme, MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider';

const theme = createTheme({
	primaryColor: 'orange',
	defaultRadius: 'md',
	fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
	headings: { fontWeight: '700' },
	cursorType: 'pointer',
});

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 15_000,
			retry: (count, error) => count < 2 && !(error as { code?: string })?.code,
		},
	},
});

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<MantineProvider theme={theme} defaultColorScheme="auto">
			<QueryClientProvider client={queryClient}>
				<ModalsProvider>
					<Notifications position="top-right" />
					<AuthProvider>
						<App />
					</AuthProvider>
				</ModalsProvider>
			</QueryClientProvider>
		</MantineProvider>
	</StrictMode>,
);
