import { notifications } from '@mantine/notifications';

interface MaybePgError {
	message?: string;
	code?: string;
	details?: string;
}

/** Превращает ошибку Supabase/PostgREST в понятный пользователю текст. */
export function errorMessage(error: unknown): string {
	if (!error) return 'Неизвестная ошибка';
	const e = error as MaybePgError;
	const msg = e.message ?? String(error);

	// Сообщения, которые мы сами бросаем из БД, уже на русском.
	if (/[а-яё]/i.test(msg)) return msg;

	switch (e.code) {
		case '42501':
			return 'Недостаточно прав для этого действия';
		case '23503':
			return 'Запись связана с другими данными и не может быть удалена или изменена';
		case '23514':
			return 'Данные не прошли проверку';
		case 'PGRST116':
			return 'Запись не найдена или нет доступа';
	}
	if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль';
	if (msg.includes('Failed to fetch')) return 'Нет связи с сервером';
	if (msg.includes('row-level security')) return 'Недостаточно прав для этого действия';
	return msg;
}

export function notifyError(error: unknown, title = 'Не удалось выполнить действие') {
	notifications.show({ color: 'red', title, message: errorMessage(error) });
}

export function notifySuccess(message: string) {
	notifications.show({ color: 'teal', message });
}
