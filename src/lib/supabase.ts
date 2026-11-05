import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error(
		'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local.'
	);
}

// Во фронтенде — только публичный (publishable) ключ. Доступ к данным
// ограничивается политиками RLS в базе, а не этим ключом.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
