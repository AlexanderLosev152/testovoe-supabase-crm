import type { TaskStatus, UserRole } from './database.types';

export const STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'review', 'rework', 'accepted'];

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
	new: { label: 'Новая', color: 'blue' },
	in_progress: { label: 'В работе', color: 'yellow' },
	review: { label: 'На проверке', color: 'violet' },
	rework: { label: 'На доработке', color: 'red' },
	accepted: { label: 'Принята', color: 'teal' },
};

export type CommentMode = 'none' | 'optional' | 'required';

export interface Transition {
	from: TaskStatus;
	to: TaskStatus;
	actor: 'assignee' | 'manager';
	label: string;
	color: string;
	comment: CommentMode;
}

/**
 * Зеркало таблицы private.status_transitions в БД.
 * Используется только чтобы показать нужные кнопки — реальную проверку делает база.
 */
export const TRANSITIONS: Transition[] = [
	{ from: 'new', to: 'in_progress', actor: 'assignee', label: 'Взять в работу', color: 'yellow', comment: 'none' },
	{ from: 'in_progress', to: 'review', actor: 'assignee', label: 'Отправить на проверку', color: 'violet', comment: 'optional' },
	{ from: 'review', to: 'accepted', actor: 'manager', label: 'Принять', color: 'teal', comment: 'optional' },
	{ from: 'review', to: 'rework', actor: 'manager', label: 'Вернуть на доработку', color: 'red', comment: 'required' },
	{ from: 'rework', to: 'in_progress', actor: 'assignee', label: 'Взять в работу', color: 'yellow', comment: 'none' },
];

export function getAvailableTransitions(
	task: { status: TaskStatus; assignee_id: string },
	user: { id: string; role: UserRole },
): Transition[] {
	return TRANSITIONS.filter(
		(t) =>
			t.from === task.status &&
			(t.actor === 'manager' ? user.role === 'manager' : task.assignee_id === user.id),
	);
}

/** Подсказка, когда у пользователя нет доступных действий. */
export function waitingHint(status: TaskStatus, role: UserRole): string {
	switch (status) {
		case 'new':
			return role === 'manager' ? 'Ждём, когда исполнитель возьмёт задачу в работу.' : 'Задача назначена другому исполнителю.';
		case 'in_progress':
			return role === 'manager' ? 'Исполнитель работает над задачей.' : 'Задача назначена другому исполнителю.';
		case 'review':
			return 'Задача на проверке у постановщика.';
		case 'rework':
			return role === 'manager' ? 'Задача возвращена исполнителю на доработку.' : 'Задача назначена другому исполнителю.';
		case 'accepted':
			return 'Задача принята. Работа завершена.';
	}
}

export const ROLE_LABEL: Record<UserRole, string> = {
	manager: 'Постановщик',
	executor: 'Исполнитель',
};

export function countByStatus(tasks: { status: TaskStatus }[]): Record<TaskStatus, number> {
	const res = { new: 0, in_progress: 0, review: 0, rework: 0, accepted: 0 } as Record<TaskStatus, number>;
	for (const t of tasks) res[t.status]++;
	return res;
}
