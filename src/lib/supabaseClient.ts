import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Cliente Supabase conectado al proyecto correcto con los datos reales
const SUPABASE_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZCzPf6mv7zy44vnoTsBKgQ_f0gUrhH9';

export const supabaseClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
