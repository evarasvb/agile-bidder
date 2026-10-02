import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// invoke() se traga el cuerpo de las respuestas no-2xx; recuperamos el mensaje real
// (y el código 'no_conectado' cuando falta la conexión de Gmail).
async function invokeGmail(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('gmail', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    let code: string | undefined;
    if (ctx && typeof ctx.json === 'function') {
      try { const b = await ctx.json(); if (b?.error) code = b.error; if (b?.mensaje || b?.error) msg = b.mensaje || b.error; } catch { /* no-JSON */ }
    }
    throw Object.assign(new Error(msg), { code });
  }
  if (data?.error) throw Object.assign(new Error(data.mensaje || data.error), { code: data.error });
  return data;
}

export function useGmailEstado() {
  return useQuery({
    queryKey: ['gmail-estado'],
    queryFn: async (): Promise<{ conectado: boolean; email: string | null }> => {
      const { data, error } = await (supabase.rpc as any)('gmail_estado');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return { conectado: !!row?.conectado, email: row?.email ?? null };
    },
  });
}

// Inicia el OAuth: pide la URL de consentimiento y redirige a Google.
export async function gmailConectar(): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const d = await invokeGmail({ action: 'start', origin });
  if (d?.url) window.location.href = d.url;
}

export function useGmailDesconectar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => invokeGmail({ action: 'desconectar' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-estado'] }),
  });
}

export interface AdjuntoCorreo { filename: string; mimeType?: string; base64: string; }
export interface AdjuntoStorage { path: string; filename?: string; }

// Crea un borrador en el Gmail del usuario con cuerpo HTML y adjuntos.
export async function gmailCrearBorrador(input: {
  to: string;
  subject: string;
  bodyHtml: string;
  adjuntos?: AdjuntoCorreo[];
  storage?: AdjuntoStorage[];
}): Promise<{ draftId?: string; link?: string | null }> {
  return invokeGmail({ action: 'crear_borrador', ...input });
}
