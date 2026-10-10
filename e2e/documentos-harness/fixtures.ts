import { createClient } from '@supabase/supabase-js';

// Synthetic identity only. The browser runner intercepts this local API and
// blocks all external requests; no real account, JWT or documents are used.
export const supabase = createClient('http://127.0.0.1:4194/test-supabase', 'synthetic-public-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
export function useCliente() {
  return { data: { id: '00000000-0000-0000-0000-000000000003', user_id: '00000000-0000-0000-0000-000000000001' } };
}
