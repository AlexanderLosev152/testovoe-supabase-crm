import { modals } from '@mantine/modals';

/** Модалка подтверждения удаления. */
export function confirmDelete(opts: { title: string; message: string; onConfirm: () => void }) {
	modals.openConfirmModal({
		title: opts.title,
		children: opts.message,
		centered: true,
		labels: { confirm: 'Удалить', cancel: 'Отмена' },
		confirmProps: { color: 'red' },
		onConfirm: opts.onConfirm,
	});
}
