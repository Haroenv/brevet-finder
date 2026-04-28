import { createClient } from '@supabase/supabase-js';

const { VITE_SUPABASE_URL = '', VITE_SUPABASE_ANON_KEY = '' } = import.meta.env;

export const missingSupabaseEnv = [
  !VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : null,
  !VITE_SUPABASE_ANON_KEY ? 'VITE_SUPABASE_ANON_KEY' : null,
].filter(Boolean) as string[];

export const isSupabaseConfigured = missingSupabaseEnv.length === 0;

export const supabase = isSupabaseConfigured
  ? createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null;
