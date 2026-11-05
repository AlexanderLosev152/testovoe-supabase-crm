-- =============================================================================
-- Мини-CRM «Объекты и задачи»: схема, права доступа, бизнес-правила.
--
-- Принципы:
--   * Все таблицы в public под RLS; anon не имеет доступа ни к чему.
--   * Роль пользователя хранится в public.profiles и меняется только админом БД.
--   * Статус задачи нельзя изменить обычным UPDATE (нет column-grant'а на status
--     + триггер). Единственный путь — функция public.change_task_status(), которая
--     проверяет переход по таблице private.status_transitions и пишет историю.
--   * История статусов только для чтения: INSERT делает лишь сама БД,
--     UPDATE запрещён триггером даже суперпользователю.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Служебная схема (не публикуется через Data API)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated; -- нужно, чтобы RLS-политики могли вызывать хелперы

-- -----------------------------------------------------------------------------
-- Типы
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'rework');

-- -----------------------------------------------------------------------------
-- Таблицы
-- -----------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text not null check (length(btrim(full_name)) between 1 and 200),
  role       public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Сотрудники. Роль меняется только через SQL (админ БД).';

create table public.objects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) between 1 and 200),
  address    text not null check (length(btrim(address)) between 1 and 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.objects is 'Объекты (стройки).';

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  object_id   uuid not null references public.objects (id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status      public.task_status not null default 'new',
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.tasks is 'Задачи по объектам. Статус меняется только через change_task_status().';

create index tasks_object_id_idx   on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_author_id_idx   on public.tasks (author_id);

create table public.task_status_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status,                 -- null = создание задачи
  to_status   public.task_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  comment     text check (comment is null or length(comment) <= 2000),
  created_at  timestamptz not null default now()
);
comment on table public.task_status_history is 'Журнал смены статусов. Только чтение через API.';

create index task_status_history_task_id_idx    on public.task_status_history (task_id, created_at);
create index task_status_history_changed_by_idx on public.task_status_history (changed_by);
create index objects_created_by_idx              on public.objects (created_by);

-- Разрешённые переходы статусов — единый источник правды.
-- actor: 'assignee' — назначенный исполнитель задачи, 'manager' — любой постановщик.
create table private.status_transitions (
  from_status      public.task_status not null,
  to_status        public.task_status not null,
  actor            text not null check (actor in ('assignee', 'manager')),
  comment_required boolean not null default false,
  primary key (from_status, to_status)
);

insert into private.status_transitions (from_status, to_status, actor, comment_required) values
  ('new',         'in_progress', 'assignee', false),
  ('in_progress', 'review',      'assignee', false),
  ('review',      'accepted',    'manager',  false),
  ('review',      'rework',      'manager',  true),
  ('rework',      'in_progress', 'assignee', false);

-- -----------------------------------------------------------------------------
-- Хелперы для RLS (security definer, чтобы не упираться в RLS profiles)
-- -----------------------------------------------------------------------------
create function private.is_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

create function private.is_executor(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'executor'
  );
$$;

-- -----------------------------------------------------------------------------
-- Профиль создаётся автоматически при создании пользователя в Auth.
-- Роль берётся из app_metadata (её может задать только админ/service_role),
-- а НЕ из user_metadata (её может менять сам пользователь).
-- -----------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'executor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- Триггеры объектов
-- -----------------------------------------------------------------------------
create function private.objects_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.id         := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.name    := btrim(new.name);
  new.address := btrim(new.address);
  return new;
end;
$$;

create trigger objects_before_write
  before insert or update on public.objects
  for each row execute function private.objects_before_write();

-- -----------------------------------------------------------------------------
-- Триггеры задач
-- -----------------------------------------------------------------------------
create function private.tasks_before_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Задача всегда рождается в статусе «Новая», автор — текущий пользователь.
  new.status     := 'new';
  new.author_id  := coalesce(auth.uid(), new.author_id);
  new.created_at := now();
  new.updated_at := now();
  new.title      := btrim(new.title);

  if not private.is_executor(new.assignee_id) then
    raise exception 'Исполнителем можно назначить только пользователя с ролью «Исполнитель»'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function private.tasks_before_insert();

create function private.tasks_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);
  return null;
end;
$$;

create trigger tasks_after_insert
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

create function private.tasks_before_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- Неизменяемые поля
  new.id         := old.id;
  new.author_id  := old.author_id;
  new.created_at := old.created_at;

  -- Статус меняется только через change_task_status() (она выставляет флаг).
  -- Защищает даже от прямого UPDATE из SQL-редактора, чтобы история не разъехалась.
  if new.status is distinct from old.status
     and coalesce(current_setting('app.status_change', true), '') <> 'on' then
    raise exception 'Статус задачи меняется только через change_task_status()'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    -- Обычное редактирование полей
    if old.status = 'accepted' and (
         new.title       is distinct from old.title or
         new.description is distinct from old.description or
         new.object_id   is distinct from old.object_id or
         new.assignee_id is distinct from old.assignee_id) then
      raise exception 'Принятую задачу нельзя редактировать' using errcode = '42501';
    end if;

    if new.assignee_id is distinct from old.assignee_id
       and not private.is_executor(new.assignee_id) then
      raise exception 'Исполнителем можно назначить только пользователя с ролью «Исполнитель»'
        using errcode = '23514';
    end if;
  end if;

  new.title      := btrim(new.title);
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function private.tasks_before_update();

-- -----------------------------------------------------------------------------
-- История неизменяема (даже для суперпользователя UPDATE запрещён)
-- -----------------------------------------------------------------------------
create function private.forbid_history_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'История статусов не может быть изменена' using errcode = '42501';
end;
$$;

create trigger task_status_history_immutable
  before update on public.task_status_history
  for each row execute function private.forbid_history_update();

create function private.status_label(p public.task_status)
returns text
language sql immutable set search_path = ''
as $$
  select case p
    when 'new'         then 'Новая'
    when 'in_progress' then 'В работе'
    when 'review'      then 'На проверке'
    when 'rework'      then 'На доработке'
    when 'accepted'    then 'Принята'
  end;
$$;

-- -----------------------------------------------------------------------------
-- Смена статуса — единственная точка входа
-- -----------------------------------------------------------------------------
create function public.change_task_status(
  p_task_id   uuid,
  p_to_status public.task_status,
  p_comment   text default null
)
returns public.tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_role       public.user_role;
  v_task       public.tasks;
  v_from       public.task_status;
  v_rule       private.status_transitions;
  v_comment    text := nullif(btrim(coalesce(p_comment, '')), '');
  v_is_actor   boolean;
begin
  if v_uid is null then
    raise exception 'Требуется вход в систему' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role is null then
    raise exception 'Профиль пользователя не найден' using errcode = '42501';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;

  -- Чужую задачу исполнитель «не видит» — отвечаем так же, как на несуществующую.
  if not found or (v_role <> 'manager' and v_task.assignee_id <> v_uid) then
    raise exception 'Задача не найдена' using errcode = 'P0002';
  end if;

  v_from := v_task.status;

  select * into v_rule
  from private.status_transitions
  where from_status = v_from and to_status = p_to_status;

  if not found then
    raise exception 'Переход из статуса «%» в «%» запрещён',
      private.status_label(v_from), private.status_label(p_to_status)
      using errcode = '42501';
  end if;

  v_is_actor := case v_rule.actor
    when 'assignee' then v_task.assignee_id = v_uid
    when 'manager'  then v_role = 'manager'
    else false
  end;

  if not coalesce(v_is_actor, false) then
    raise exception 'У вас нет прав на переход из «%» в «%»',
      private.status_label(v_from), private.status_label(p_to_status)
      using errcode = '42501';
  end if;

  if v_rule.comment_required and v_comment is null then
    raise exception 'Для этого действия нужен комментарий' using errcode = '22023';
  end if;

  if v_comment is not null and length(v_comment) > 2000 then
    raise exception 'Комментарий слишком длинный (максимум 2000 символов)' using errcode = '22001';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.tasks set status = p_to_status where id = p_task_id returning * into v_task;
  perform set_config('app.status_change', 'off', true);

  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_from, p_to_status, v_uid, v_comment);

  return v_task;
end;
$$;

comment on function public.change_task_status is
  'Смена статуса задачи с проверкой разрешённого перехода и записью в историю.';

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.objects             enable row level security;
alter table public.tasks               enable row level security;
alter table public.task_status_history enable row level security;
alter table private.status_transitions enable row level security;

-- profiles: постановщик видит всех; исполнитель — себя и постановщиков
-- (имена авторов задач и участников истории). Других исполнителей не видит.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role = 'manager'
    or (select private.is_manager())
  );

-- objects: постановщик — всё; исполнитель — только объекты, где у него есть задачи.
create policy objects_select on public.objects
  for select to authenticated
  using (
    (select private.is_manager())
    or exists (
      select 1 from public.tasks t
      where t.object_id = objects.id and t.assignee_id = (select auth.uid())
    )
  );

create policy objects_insert on public.objects
  for insert to authenticated
  with check ((select private.is_manager()));

create policy objects_update on public.objects
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy objects_delete on public.objects
  for delete to authenticated
  using ((select private.is_manager()));

-- tasks: постановщик — всё; исполнитель — только назначенные ему (только чтение,
-- статус он меняет через change_task_status()).
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    (select private.is_manager())
    or assignee_id = (select auth.uid())
  );

create policy tasks_insert on public.tasks
  for insert to authenticated
  with check ((select private.is_manager()));

create policy tasks_update on public.tasks
  for update to authenticated
  using ((select private.is_manager()))
  with check ((select private.is_manager()));

create policy tasks_delete on public.tasks
  for delete to authenticated
  using ((select private.is_manager()));

-- history: видна тем, кто видит задачу (RLS tasks применяется в подзапросе).
create policy task_status_history_select on public.task_status_history
  for select to authenticated
  using (
    exists (select 1 from public.tasks t where t.id = task_status_history.task_id)
  );

-- -----------------------------------------------------------------------------
-- Привилегии (второй рубеж поверх RLS): явно и по колонкам.
-- -----------------------------------------------------------------------------
revoke all on public.profiles, public.objects, public.tasks, public.task_status_history
  from anon, authenticated;
revoke all on private.status_transitions from anon, authenticated, public;

grant select on public.profiles to authenticated;

grant select, delete on public.objects to authenticated;
grant insert (name, address), update (name, address) on public.objects to authenticated;

-- status, author_id, created_at — не грантим: их не задать и не изменить через API.
grant select, delete on public.tasks to authenticated;
grant insert (object_id, title, description, assignee_id),
      update (object_id, title, description, assignee_id)
  on public.tasks to authenticated;

grant select on public.task_status_history to authenticated;

-- Функции: по умолчанию EXECUTE выдан PUBLIC — отзываем.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_manager()       to authenticated;
grant execute on function private.is_executor(uuid)  to authenticated;

revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon;
grant  execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;
