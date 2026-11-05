import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '../lib/database.types';

export interface AuthState {
	/** undefined — сессия ещё загружается */
	session: Session | null | undefined;
	profile: Profile | null;
	profileLoading: boolean;
	profileError: unknown;
	signIn: (email: string, password: string) => Promise<void>;
	signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
	return ctx;
}

/** Профиль текущего пользователя. Использовать только внутри защищённых маршрутов. */
export function useProfile(): Profile {
	const { profile } = useAuth();
	if (!profile) throw new Error('useProfile used outside of an authenticated route');
	return profile;
}
