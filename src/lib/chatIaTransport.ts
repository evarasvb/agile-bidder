import { supabase } from '@/integrations/supabase/client';

// Legacy ChatIA tables are not part of the verified generated schema.
// Keep this optional REST boundary untyped until responses are validated by callers.
// This does not assert that either table exists or activate any backend resource.
export const CHAT_IA_UNAVAILABLE = 'Chat IA no está disponible. No se pudieron cargar los documentos o la conversación. Intenta nuevamente más tarde.';
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function chatIaRequest(
  table: 'documentos_licitacion' | 'chat_licitacion',
  parameters: Record<string, string>,
  options: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, unknown> } = {},
): Promise<unknown> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error('No autenticado');
  const url = new URL(`/rest/v1/${table}`, import.meta.env.VITE_SUPABASE_URL);
  url.search = new URLSearchParams(parameters).toString();
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session.access_token}`,
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = 'return=representation';
  }
  const response = await fetch(url.toString(), {
    method: options.method || 'GET', headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  if (response.status === 204 && response.ok) return null;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 404 || isRecord(data) && (data.code === 'PGRST205' || data.code === '42P01')) {
      throw new Error(CHAT_IA_UNAVAILABLE);
    }
    throw new Error('No se pudo completar la operación de Chat IA. Intenta nuevamente.');
  }
  return data;
}
