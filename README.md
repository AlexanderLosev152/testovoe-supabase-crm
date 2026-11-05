# СтройКонтроль — мини-CRM «Объекты и задачи»

Постановщик ставит задачи по объектам (стройкам), исполнители берут их в работу и отдают на проверку.
Права доступа и правила смены статусов проверяет сама база данных (Supabase / PostgreSQL), а не только интерфейс.

**Стек:** React 19 + TypeScript, Vite, Mantine 9, TanStack Query, React Router, Supabase (Auth + Postgres + RLS).

- [Объяснение для руководителя](docs/EXPLANATION.md): как устроена система и как защищены данные.
- [Решения и допущения](docs/DECISIONS.md): что решено самостоятельно и что не сделано.

## Структура

```
supabase/migrations/       схема БД, RLS-политики, триггеры, функция смены статуса
scripts/seed.ts            демо-пользователи, объекты и задачи (история создаётся настоящими переходами)
scripts/security-check.ts  36 проверок прав доступа «в обход интерфейса»
src/api/                   запросы к Supabase (TanStack Query)
src/auth/                  сессия и профиль текущего пользователя
src/pages/                 экраны: вход, объекты, объект, задачи, задача
src/components/            таблицы, формы, история, кнопки действий
```

## Запуск локально

Нужны Node.js 22+ и (для локальной базы) Docker.

```bash
npm install
```

### Вариант A: локальная база в Docker

```bash
npx supabase start          # поднимает Postgres/Auth/API и применяет миграции
npx supabase status -o env  # здесь API_URL, PUBLISHABLE_KEY, SECRET_KEY
```

Создайте `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY>
```

Заполните демо-данными и запустите:

```bash
SUPABASE_SECRET_KEY=<SECRET_KEY> npm run seed
npm run dev
```

### Вариант B: облачный Supabase

1. Создайте проект на supabase.com.
2. Примените миграцию: `npx supabase login`, `npx supabase link --project-ref <ref>` и `npx supabase db push --remote`
   (в Supabase CLI 3 без `--remote` миграция применяется к локальной базе). Или выполните `supabase/migrations/*.sql` в SQL Editor.
   Проверить: `npx supabase migration list --remote` — в колонке remote должна стоять версия миграции.
3. **Authentication → Sign In / Providers → Email:** выключите *Allow new users to sign up*.
4. В `.env.local` укажите URL проекта и **publishable** (anon) ключ.
5. Секретный ключ положите в `.env.seed.local` (файл в `.gitignore`) и выполните `npm run seed`.

`npm run seed -- --reset` удаляет объекты и задачи и создаёт их заново.

## Демо-доступы

Пароль у всех: `Stroy-Demo-2026` (меняется переменной `SEED_PASSWORD`).

| Роль        | Email                 | Имя             |
|-------------|-----------------------|-----------------|
| Постановщик | manager@stroy.test    | Ирина Соколова  |
| Постановщик | manager2@stroy.test   | Сергей Кузнецов |
| Исполнитель | alexey@stroy.test     | Алексей Иванов  |
| Исполнитель | dmitry@stroy.test     | Дмитрий Петров  |

Новых пользователей добавляет администратор: Supabase → Authentication → Add user.
Роль задаётся в `app_metadata` (`{"role": "manager"}`) или потом меняется в таблице `profiles`.
По умолчанию новый пользователь получает роль «Исполнитель».

## Проверка безопасности

```bash
npm run security-check
```

Скрипт входит под разными пользователями с публичным ключом, то есть так же, как злоумышленник с доступом к API,
и пытается читать чужие задачи, менять статусы в обход правил, подделывать историю и так далее.
Каждая попытка должна быть отклонена базой. Скрипт создаёт свои тестовые записи с пометкой `[security-check]` и удаляет их в конце.

## Деплой

Подходит любой статический хостинг. `vercel.json` и `public/_redirects` (Netlify) настраивают SPA-маршрутизацию.
В переменных окружения хостинга указываются **только** `VITE_SUPABASE_URL` и `VITE_SUPABASE_PUBLISHABLE_KEY`.
Секретный ключ на хостинг не нужен.

## Команды

| Команда                  | Что делает                          |
|--------------------------|-------------------------------------|
| `npm run dev`            | dev-сервер                          |
| `npm run build`          | проверка типов и сборка в `dist/`   |
| `npm run lint`           | ESLint                              |
| `npm run seed`           | демо-данные                         |
| `npm run security-check` | проверки прав доступа               |
