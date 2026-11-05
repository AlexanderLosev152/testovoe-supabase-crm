import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { AuthContext, type AuthState } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
	const queryClient = useQueryClient();
	const [session, setSession] = useState<Session | null | undefined>(undefined);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => setSession(data.session));
		const { data } = supabase.auth.onAuthStateChange((event, next) => {
			setSession(next);
			if (event === 'SIGNED_OUT') queryClient.clear();
		});
		return () => data.subscription.unsubscribe();
	}, [queryClient]);

	const userId = session?.user.id;

	const profileQuery = useQuery({
		queryKey: ['profile', userId],
		enabled: !!userId,
		staleTime: Infinity,
		queryFn: async () => {
			const { data, error } = await supabase
				.from('profiles')
				.select('id, email, full_name, role, created_at')
				.eq('id', userId!)
				.single();
			if (error) throw error;
			return data;
		},
	});

	const value: AuthState = {
		session,
		profile: profileQuery.data ?? null,
		profileLoading: !!userId && profileQuery.isPending,
		profileError: profileQuery.error,
		signIn: async (email, password) => {
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) throw error;
		},
		signOut: async () => {
			await supabase.auth.signOut();
		},
	};

	return <AuthContext value={value}>{children}</AuthContext>;
}
