import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
    envUrl &&
    envAnonKey &&
    !envUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
    console.warn('Supabase URL or Anon Key is missing. Please check your .env.local file.');
}

const supabaseUrl = envUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = envAnonKey || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

