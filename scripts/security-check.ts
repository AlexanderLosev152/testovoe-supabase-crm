/**
 * Проверка правил доступа «в обход интерфейса»: скрипт ходит в Supabase API
 * напрямую с публичным ключом и логинами демо-пользователей и пытается
 * сделать то, что запрещено. Каждая попытка должна провалиться.
 *
 * Требует демо-данные из scripts/seed.ts. Служебный ключ НЕ нужен.
 *   npm run security-check
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const password = process.env.SEED_PASSWORD ?? 'Stroy-Demo-2026';
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

if (!url || !key) {
	console.error('Нужны VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY');
	process.exit(1);
}

let passed = 0;
let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
	try {
		await fn();
		passed++;
		console.log(`  ✓ ${name}`);
	} catch (e) {
		failed++;
		console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
	}
}
function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}
/** Запрос должен вернуть ошибку или ничего не затронуть. */
function denied(res: { error: unknown; data?: unknown; count?: number | null }, what: string) {
	if (res.error) return;
	const rows = Array.isArray(res.data) ? res.data.length : res.data ? 1 : 0;
	assert(rows === 0 && !res.count, `${what}: ожидался отказ, а запрос прошёл (${JSON.stringify(res.data)})`);
}

async function login(email: string): Promise<SupabaseClient & { uid: string }> {
	const c = createClient(url, key, opts);
	const { data, error } = await c.auth.signInWithPassword({ email, password });
	if (error) throw new Error(`Не удалось войти как ${email}: ${error.message}. Запустите npm run seed.`);
	return Object.assign(c, { uid: data.user.id });
}

const anon = createClient(url, key, opts);
const boss = await login('manager@stroy.test');
const alex = await login('alexey@stroy.test');
const dima = await login('dmitry@stroy.test');

// Подготовка: постановщик создаёт тестовый объект и задачи
const { data: obj } = await boss.from('objects').insert({ name: '[security-check] объект', address: 'тест' }).select('id').single();
const objectId = obj!.id as string;
const mk = async (assignee: string, title: string) =>
	(await boss.from('tasks').insert({ object_id: objectId, title, assignee_id: assignee }).select('id').single()).data!.id as string;
const alexTask = await mk(alex.uid, '[security-check] задача Алексея');
const dimaTask = await mk(dima.uid, '[security-check] задача Дмитрия');

try {
	console.log('\nАнонимный доступ');
	for (const table of ['profiles', 'objects', 'tasks', 'task_status_history'] as const) {
		await test(`аноним не читает ${table}`, async () => denied(await anon.from(table).select('*'), table));
	}
	await test('аноним не вызывает change_task_status', async () => {
		const r = await anon.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'in_progress' });
		assert(r.error, 'RPC прошёл без авторизации');
	});
	await test('открытая регистрация отключена', async () => {
		const r = await anon.auth.signUp({ email: `hacker${Date.now()}@example.com`, password: 'Password-123456' });
		assert(r.error, 'регистрация прошла');
	});

	console.log('\nИсполнитель: видимость');
	await test('видит только свои задачи', async () => {
		const { data } = await alex.from('tasks').select('assignee_id');
		assert(data!.length > 0 && data!.every((t) => t.assignee_id === alex.uid), 'в выдаче есть чужие задачи');
	});
	await test('не читает чужую задачу по id', async () => denied(await alex.from('tasks').select('*').eq('id', dimaTask), 'select'));
	await test('не читает историю чужой задачи', async () =>
		denied(await alex.from('task_status_history').select('*').eq('task_id', dimaTask), 'history'));
	await test('видит только объекты, где есть его задачи', async () => {
		const { data: mine } = await alex.from('objects').select('id, tasks!inner(id)');
		const { data: visible } = await alex.from('objects').select('id');
		const { data: all } = await boss.from('objects').select('id');
		assert(visible!.length === mine!.length, 'видит объекты без своих задач');
		assert(visible!.length < all!.length, 'видит все объекты');
	});
	await test('не видит профили других исполнителей', async () =>
		denied(await alex.from('profiles').select('*').eq('id', dima.uid), 'profiles'));

	console.log('\nИсполнитель: изменения');
	await test('не меняет поля своей задачи', async () =>
		denied(await alex.from('tasks').update({ title: 'взлом' }, { count: 'exact' }).eq('id', alexTask).select(), 'update'));
	await test('не меняет чужую задачу', async () =>
		denied(await alex.from('tasks').update({ title: 'взлом' }, { count: 'exact' }).eq('id', dimaTask).select(), 'update'));
	await test('не создаёт задачи', async () =>
		denied(await alex.from('tasks').insert({ object_id: objectId, title: 'x', assignee_id: alex.uid }).select(), 'insert'));
	await test('не удаляет задачи', async () => denied(await alex.from('tasks').delete({ count: 'exact' }).eq('id', alexTask), 'delete'));
	await test('не создаёт объекты', async () => denied(await alex.from('objects').insert({ name: 'x', address: 'y' }).select(), 'insert'));
	await test('не повышает себе роль', async () =>
		denied(await alex.from('profiles').update({ role: 'manager' }, { count: 'exact' }).eq('id', alex.uid).select(), 'update role'));

	console.log('\nПереходы статусов');
	await test('прямой UPDATE status запрещён исполнителю', async () =>
		denied(await alex.from('tasks').update({ status: 'accepted' } as never).eq('id', alexTask).select(), 'update status'));
	await test('прямой UPDATE status запрещён даже постановщику', async () =>
		denied(await boss.from('tasks').update({ status: 'accepted' } as never).eq('id', alexTask).select(), 'update status'));
	await test('при создании нельзя задать статус/автора', async () =>
		denied(
			await boss
				.from('tasks')
				.insert({ object_id: objectId, title: 'x', assignee_id: alex.uid, status: 'accepted', author_id: alex.uid } as never)
				.select(),
			'insert status',
		));
	await test('исполнитель не может «Новая → Принята»', async () => {
		assert((await alex.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'accepted' })).error, 'переход прошёл');
	});
	await test('постановщик не может «Новая → В работе» (это делает исполнитель)', async () => {
		assert((await boss.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'in_progress' })).error, 'переход прошёл');
	});
	await test('чужой исполнитель не может двигать задачу', async () => {
		assert((await dima.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'in_progress' })).error, 'переход прошёл');
	});
	await test('назначенный исполнитель: Новая → В работе → На проверке', async () => {
		const a = await alex.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'in_progress' });
		assert(!a.error, a.error?.message ?? '');
		const b = await alex.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'review' });
		assert(!b.error, b.error?.message ?? '');
	});
	await test('исполнитель не принимает свою задачу сам', async () => {
		assert((await alex.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'accepted' })).error, 'переход прошёл');
	});
	await test('возврат на доработку без комментария запрещён', async () => {
		assert((await boss.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'rework', p_comment: '   ' })).error, 'переход прошёл');
	});
	await test('возврат на доработку с комментарием проходит', async () => {
		const r = await boss.rpc('change_task_status', { p_task_id: alexTask, p_to_status: 'rework', p_comment: 'Исправить' });
		assert(!r.error, r.error?.message ?? '');
	});
	await test('нельзя назначить исполнителем постановщика', async () =>
		denied(await boss.from('tasks').update({ assignee_id: boss.uid }).eq('id', dimaTask).select(), 'assign manager'));

	console.log('\nИстория');
	const { data: hist } = await alex.from('task_status_history').select('id').eq('task_id', alexTask);
	const histId = hist![0].id;
	await test('история пишется на каждый переход', async () => assert(hist!.length === 4, `ожидалось 4 записи, есть ${hist!.length}`));
	for (const [who, c] of [['исполнитель', alex], ['постановщик', boss]] as const) {
		await test(`${who} не может добавить запись в историю`, async () =>
			denied(
				await c.from('task_status_history').insert({ task_id: alexTask, to_status: 'accepted', changed_by: c.uid } as never).select(),
				'insert',
			));
		await test(`${who} не может изменить историю`, async () =>
			denied(await c.from('task_status_history').update({ comment: 'подделка' } as never, { count: 'exact' }).eq('id', histId).select(), 'update'));
		await test(`${who} не может удалить историю`, async () =>
			denied(await c.from('task_status_history').delete({ count: 'exact' }).eq('id', histId), 'delete'));
	}
	await test('история не изменилась', async () => {
		const { data } = await boss.from('task_status_history').select('id, comment').eq('task_id', alexTask);
		assert(data!.length === 4 && !data!.some((h) => h.comment === 'подделка'), 'история изменена');
	});
} finally {
	await boss.from('objects').delete().eq('id', objectId);
}

console.log(`\nИтого: ${passed} пройдено, ${failed} провалено`);
process.exit(failed ? 1 : 0);
