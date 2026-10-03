import { createClient } from '@supabase/supabase-js';
export const supabase = createClient('http://127.0.0.1:5187/test-supabase', 'isolated-public-test-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
