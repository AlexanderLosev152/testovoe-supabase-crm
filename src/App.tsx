import { Button } from '@mantine/core';
import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './components/AppLayout';
import { EmptyBlock } from './components/ErrorState';
import { LoginPage } from './pages/LoginPage';
import { ObjectPage } from './pages/ObjectPage';
import { ObjectsPage } from './pages/ObjectsPage';
import { TaskPage } from './pages/TaskPage';
import { TasksPage } from './pages/TasksPage';

function HomeRedirect() {
	const { profile } = useAuth();
	return <Navigate to={profile?.role === 'executor' ? '/tasks' : '/objects'} replace />;
}

function NotFound() {
	return (
		<EmptyBlock title="Страница не найдена">
			<Button component={Link} to="/" variant="light" mt="sm">
				На главную
			</Button>
		</EmptyBlock>
	);
}

const router = createBrowserRouter([
	{ path: '/login', element: <LoginPage /> },
	{
		element: <AppLayout />,
		children: [
			{ index: true, element: <HomeRedirect /> },
			{ path: 'objects', element: <ObjectsPage /> },
			{ path: 'objects/:id', element: <ObjectPage /> },
			{ path: 'tasks', element: <TasksPage /> },
			{ path: 'tasks/:id', element: <TaskPage /> },
			{ path: '*', element: <NotFound /> },
		],
	},
]);

export default function App() {
	return <RouterProvider router={router} />;
}
