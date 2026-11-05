/**
 * Заполняет проект демо-данными: пользователи, объекты, задачи в разных статусах.
 *
 * Статусы задач меняются «по-честному» — от имени исполнителя/постановщика через
 * RPC change_task_status, поэтому история переходов получается настоящей.
 *
 * Запуск (секретный ключ только в локальном env, не в репозитории и не во фронтенде):
 *   SUPABASE_SECRET_KEY=sb_secret_... npm run seed            # если данных ещё нет
 *   SUPABASE_SECRET_KEY=sb_secret_... npm run seed -- --reset # удалить объекты/задачи и создать заново
 *
 * Переменные: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (из .env.local),
 * SUPABASE_SECRET_KEY (service_role / secret), SEED_PASSWORD (по умолчанию — ниже).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const password = process.env.SEED_PASSWORD ?? 'Stroy-Demo-2026';
const reset = process.argv.includes('--reset');

if (!url || !publishableKey || !secretKey) {
	console.error('Нужны VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY и SUPABASE_SECRET_KEY');
	process.exit(1);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secretKey, opts);

type Role = 'manager' | 'executor';
const USERS: { key: string; email: string; name: string; role: Role }[] = [
	{ key: 'boss', email: 'manager@stroy.test', name: 'Ирина Соколова', role: 'manager' },
	{ key: 'boss2', email: 'manager2@stroy.test', name: 'Сергей Кузнецов', role: 'manager' },
	{ key: 'alex', email: 'alexey@stroy.test', name: 'Алексей Иванов', role: 'executor' },
	{ key: 'dima', email: 'dmitry@stroy.test', name: 'Дмитрий Петров', role: 'executor' },
];

function check<T>(res: { data: T; error: unknown }, what: string): T {
	if (res.error) {
		console.error(`✗ ${what}:`, res.error);
		process.exit(1);
	}
	return res.data;
}

async function ensureUser(u: (typeof USERS)[number]): Promise<string> {
	const list = check(await admin.auth.admin.listUsers({ perPage: 1000 }), 'listUsers');
	const existing = list.users.find((x) => x.email === u.email);
	const attrs = {
		password,
		email_confirm: true,
		user_metadata: { full_name: u.name },
		app_metadata: { role: u.role },
	};
	let id: string;
	if (existing) {
		check(await admin.auth.admin.updateUserById(existing.id, attrs), `update ${u.email}`);
		id = existing.id;
	} else {
		id = check(await admin.auth.admin.createUser({ email: u.email, ...attrs }), `create ${u.email}`).user!.id;
	}
	// Роль и имя — в profiles (источник правды для RLS). service_role обходит RLS.
	check(await admin.from('profiles').update({ role: u.role, full_name: u.name }).eq('id', id), `profile ${u.email}`);
	return id;
}

async function signIn(email: string): Promise<SupabaseClient> {
	const c = createClient(url!, publishableKey!, opts);
	check(await c.auth.signInWithPassword({ email, password }), `signIn ${email}`);
	return c;
}

async function main() {
	console.log('→ Пользователи');
	const ids: Record<string, string> = {};
	for (const u of USERS) ids[u.key] = await ensureUser(u);

	const existing = check(await admin.from('objects').select('id'), 'objects');
	if (existing.length && !reset) {
		console.log('Объекты уже есть — данные не трогаю. Запустите с --reset, чтобы пересоздать.');
		return;
	}
	if (reset) {
		console.log('→ Очистка объектов и задач');
		check(await admin.from('objects').delete().not('id', 'is', null), 'reset');
	}

	const boss = await signIn('manager@stroy.test');
	const boss2 = await signIn('manager2@stroy.test');
	const alex = await signIn('alexey@stroy.test');
	const dima = await signIn('dmitry@stroy.test');
	const as: Record<string, SupabaseClient> = { boss, boss2, alex, dima };

	console.log('→ Объекты');
	const objects = check(
		await boss
			.from('objects')
			.insert([
				{ name: 'ЖК «Северный», корпус 2', address: 'г. Казань, ул. Строителей, 12' },
				{ name: 'БЦ «Меридиан»', address: 'г. Казань, пр. Победы, 141' },
				{ name: 'Коттедж в Усадах', address: 'Республика Татарстан, с. Усады, ул. Лесная, 7' },
			])
			.select('id, name'),
		'insert objects',
	) as { id: string; name: string }[];
	const [north, meridian, cottage] = objects.map((o) => o.id);

	// [объект, название, описание, исполнитель, сценарий переходов]
	type Step = [actor: string, to: string, comment?: string];
	const TASKS: [string, string, string, string, Step[]][] = [
		[north, 'Залить фундамент секции А', 'Бетон М350, после заливки — уход за бетоном 7 дней. Фотоотчёт по готовности.', 'alex', [
			['alex', 'in_progress'],
			['alex', 'review', 'Залили, фото в общей папке.'],
			['boss', 'accepted', 'Принято, хорошая работа.'],
		]],
		[north, 'Монтаж опалубки перекрытия 3 этажа', 'Щитовая опалубка, проверить геометрию перед армированием.', 'alex', [
			['alex', 'in_progress'],
			['alex', 'review'],
			['boss', 'rework', 'Перепад по уровню в осях 3–4 до 15 мм. Выровнять и прислать замеры.'],
		]],
		[north, 'Вывоз строительного мусора', 'Заказать 2 контейнера по 20 м³.', 'dima', []],
		[meridian, 'Прокладка кабельных трасс 2 этаж', 'По проекту ЭОМ, лист 14. Лотки 200×50.', 'dima', [
			['dima', 'in_progress'],
		]],
		[meridian, 'Установка оконных блоков фасад Б', '18 блоков, монтаж по ГОСТ 30971 (ПСУЛ + пароизоляция).', 'dima', [
			['dima', 'in_progress'],
			['dima', 'review', 'Все 18 блоков установлены, откосы подготовлены.'],
		]],
		[meridian, 'Гидроизоляция кровли', 'Наплавляемая, 2 слоя. Проверка проливом.', 'alex', [
			['alex', 'in_progress'],
			['alex', 'review'],
			['boss2', 'rework', 'При проливе протечка у парапета, переделать примыкание.'],
			['alex', 'in_progress'],
		]],
		[cottage, 'Кладка стен первого этажа', 'Газобетон D500, 400 мм. Армирование каждого 4-го ряда.', 'dima', []],
		[cottage, 'Устройство септика', 'Септик на 4 человек, точка — по генплану.', 'dima', [
			['dima', 'in_progress'],
			['dima', 'review'],
			['boss2', 'accepted'],
		]],
	];

	console.log('→ Задачи и переходы');
	for (const [objectId, title, description, assignee, steps] of TASKS) {
		const author = steps.some((s) => s[0] === 'boss2') ? boss2 : boss;
		const task = check(
			await author.from('tasks').insert({ object_id: objectId, title, description, assignee_id: ids[assignee] }).select('id').single(),
			`insert task ${title}`,
		) as { id: string };
		for (const [actor, to, comment] of steps) {
			check(await as[actor].rpc('change_task_status', { p_task_id: task.id, p_to_status: to, p_comment: comment }), `${title}: → ${to}`);
		}
		console.log(`  ✓ ${title}`);
	}

	console.log('\nГотово. Доступы (пароль у всех один):', password);
	for (const u of USERS) console.log(`  ${u.role === 'manager' ? 'Постановщик' : 'Исполнитель'}: ${u.email} — ${u.name}`);
}

await main();
