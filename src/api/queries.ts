import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { TaskStatus } from '../lib/database.types';

// ---------------------------------------------------------------------------
// Ключи кэша
// ---------------------------------------------------------------------------
export const qk = {
	objects: ['objects'] as const,
	object: (id: string) => ['objects', id] as const,
	tasks: ['tasks'] as const,
	objectTasks: (objectId: string) => ['tasks', 'object', objectId] as const,
	task: (id: string) => ['tasks', 'one', id] as const,
	history: (taskId: string) => ['history', taskId] as const,
	executors: ['executors'] as const,
};

// ---------------------------------------------------------------------------
// Select-строки (PostgREST embedding). Видимость строк ограничивает RLS.
// ---------------------------------------------------------------------------
const PERSON = 'id, full_name';
const TASK_LIST_SELECT = `id, title, status, created_at, updated_at, assignee_id, object_id,
	assignee:profiles!tasks_assignee_id_fkey(${PERSON}),
	object:objects(id, name)` as const;

// ---------------------------------------------------------------------------
// Объекты
// ---------------------------------------------------------------------------
export function useObjects() {
	return useQuery({
		queryKey: qk.objects,
		queryFn: async () => {
			const { data, error } = await supabase
				.from('objects')
				.select('id, name, address, created_at, tasks(status)')
				.order('created_at', { ascending: false });
			if (error) throw error;
			return data;
		},
	});
}

export function useObject(id: string) {
	return useQuery({
		queryKey: qk.object(id),
		queryFn: async () => {
			const { data, error } = await supabase
				.from('objects')
				.select(`id, name, address, created_at, creator:profiles(${PERSON})`)
				.eq('id', id)
				.maybeSingle();
			if (error) throw error;
			return data;
		},
	});
}

export function useSaveObject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: { id?: string; name: string; address: string }) => {
			const values = { name: input.name.trim(), address: input.address.trim() };
			const query = input.id
				? supabase.from('objects').update(values).eq('id', input.id)
				: supabase.from('objects').insert(values);
			const { data, error } = await query.select('id').single();
			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: qk.objects });
			qc.invalidateQueries({ queryKey: qk.tasks });
		},
	});
}

export function useDeleteObject() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const { error, count } = await supabase.from('objects').delete({ count: 'exact' }).eq('id', id);
			if (error) throw error;
			if (!count) throw new Error('Объект не найден или нет прав на удаление');
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: qk.objects });
			qc.invalidateQueries({ queryKey: qk.tasks });
		},
	});
}

// ---------------------------------------------------------------------------
// Задачи
// ---------------------------------------------------------------------------
export function useTasks(filter: { assigneeId?: string } = {}) {
	return useQuery({
		queryKey: [...qk.tasks, 'list', filter],
		queryFn: async () => {
			let q = supabase.from('tasks').select(TASK_LIST_SELECT).order('updated_at', { ascending: false });
			if (filter.assigneeId) q = q.eq('assignee_id', filter.assigneeId);
			const { data, error } = await q;
			if (error) throw error;
			return data;
		},
	});
}

export type TaskListItem = NonNullable<ReturnType<typeof useTasks>['data']>[number];

export function useObjectTasks(objectId: string) {
	return useQuery({
		queryKey: qk.objectTasks(objectId),
		queryFn: async () => {
			const { data, error } = await supabase
				.from('tasks')
				.select(TASK_LIST_SELECT)
				.eq('object_id', objectId)
				.order('created_at', { ascending: false });
			if (error) throw error;
			return data;
		},
	});
}

export function useTask(id: string) {
	return useQuery({
		queryKey: qk.task(id),
		queryFn: async () => {
			const { data, error } = await supabase
				.from('tasks')
				.select(
					`id, title, description, status, created_at, updated_at, assignee_id, object_id, author_id,
					assignee:profiles!tasks_assignee_id_fkey(${PERSON}),
					author:profiles!tasks_author_id_fkey(${PERSON}),
					object:objects(id, name, address)`,
				)
				.eq('id', id)
				.maybeSingle();
			if (error) throw error;
			return data;
		},
	});
}

export type TaskDetails = NonNullable<ReturnType<typeof useTask>['data']>;

export function useTaskHistory(taskId: string) {
	return useQuery({
		queryKey: qk.history(taskId),
		queryFn: async () => {
			const { data, error } = await supabase
				.from('task_status_history')
				.select(`id, from_status, to_status, comment, created_at, changed_by, actor:profiles(${PERSON}, role)`)
				.eq('task_id', taskId)
				.order('created_at', { ascending: true })
				.order('id', { ascending: true });
			if (error) throw error;
			return data;
		},
	});
}

export function useExecutors(enabled = true) {
	return useQuery({
		queryKey: qk.executors,
		enabled,
		staleTime: 5 * 60_000,
		queryFn: async () => {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, full_name, email')
				.eq('role', 'executor')
				.order('full_name');
			if (error) throw error;
			return data;
		},
	});
}

export interface TaskInput {
	id?: string;
	title: string;
	description: string;
	object_id: string;
	assignee_id: string;
}

export function useSaveTask() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: TaskInput) => {
			const values = {
				title: input.title.trim(),
				description: input.description.trim(),
				object_id: input.object_id,
				assignee_id: input.assignee_id,
			};
			const query = input.id
				? supabase.from('tasks').update(values).eq('id', input.id)
				: supabase.from('tasks').insert(values);
			const { data, error } = await query.select('id').single();
			if (error) throw error;
			return data;
		},
		onSuccess: (_data, input) => {
			qc.invalidateQueries({ queryKey: qk.tasks });
			qc.invalidateQueries({ queryKey: qk.objects });
			if (input.id) qc.invalidateQueries({ queryKey: qk.history(input.id) });
		},
	});
}

export function useDeleteTask() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const { error, count } = await supabase.from('tasks').delete({ count: 'exact' }).eq('id', id);
			if (error) throw error;
			if (!count) throw new Error('Задача не найдена или нет прав на удаление');
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: qk.tasks });
			qc.invalidateQueries({ queryKey: qk.objects });
		},
	});
}

export function useChangeStatus() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (input: { taskId: string; to: TaskStatus; comment?: string }) => {
			const { data, error } = await supabase.rpc('change_task_status', {
				p_task_id: input.taskId,
				p_to_status: input.to,
				p_comment: input.comment?.trim() || undefined,
			});
			if (error) throw error;
			return data;
		},
		onSettled: (_d, _e, input) => {
			qc.invalidateQueries({ queryKey: qk.tasks });
			qc.invalidateQueries({ queryKey: qk.objects });
			qc.invalidateQueries({ queryKey: qk.history(input.taskId) });
		},
	});
}
