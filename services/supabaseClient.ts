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

export const REMEMBER_SESSION_KEY = 'horium_remember_session';

const memoryStorage = new Map<string, string>();

const browserStorageAvailable = typeof window !== 'undefined'
    && typeof localStorage !== 'undefined'
    && typeof sessionStorage !== 'undefined';

const isAuthTokenKey = (key: string) => key.startsWith('sb-') && key.includes('auth-token');

const removeAuthTokens = (storage: Storage) => {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && isAuthTokenKey(key)) keys.push(key);
    }
    keys.forEach(key => storage.removeItem(key));
};

export const remembersSession = () => {
    if (!browserStorageAvailable) return false;
    return localStorage.getItem(REMEMBER_SESSION_KEY) === '1';
};

export const setRememberSession = (remember: boolean) => {
    if (!browserStorageAvailable) return;
    if (remember) {
        localStorage.setItem(REMEMBER_SESSION_KEY, '1');
        return;
    }
    localStorage.removeItem(REMEMBER_SESSION_KEY);
    removeAuthTokens(localStorage);
};

if (browserStorageAvailable && !remembersSession()) {
    removeAuthTokens(localStorage);
}

const authStorage = {
    getItem(key: string) {
        if (!browserStorageAvailable) return memoryStorage.get(key) ?? null;
        return (remembersSession() ? localStorage : sessionStorage).getItem(key);
    },
    setItem(key: string, value: string) {
        if (!browserStorageAvailable) {
            memoryStorage.set(key, value);
            return;
        }
        const persistent = remembersSession();
        (persistent ? localStorage : sessionStorage).setItem(key, value);
        removeAuthTokens(persistent ? sessionStorage : localStorage);
    },
    removeItem(key: string) {
        memoryStorage.delete(key);
        if (!browserStorageAvailable) return;
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: authStorage,
    },
});

