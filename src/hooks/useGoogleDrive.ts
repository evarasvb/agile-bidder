import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export const CARPETA_MIME = 'application/vnd.google-apps.folder';

// invoke() se traga el cuerpo de las respuestas no-2xx; recuperamos el mensaje real.
async function invokeDrive(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('google-drive', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = error.message;
    if (ctx && typeof ctx.json === 'function') {
      try { const b = await ctx.json(); if (b?.mensaje || b?.error) msg = b.mensaje || b.error; } catch { /* no-JSON */ }
    }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.mensaje || data.error);
  return data;
}

export function useDriveEstado() {
  return useQuery({
    queryKey: ['drive-estado'],
    queryFn: async (): Promise<{ conectado: boolean; email: string | null }> => {
      // rpc casteado: los tipos generados de Supabase aún no incluyen esta función nueva.
      const { data, error } = await (supabase.rpc as any)('google_drive_estado');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return { conectado: !!row?.conectado, email: row?.email ?? null };
    },
  });
}

// Inicia el OAuth: pide la URL de consentimiento y redirige a Google.
export async function driveConectar(): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const d = await invokeDrive({ action: 'start', origin });
  if (d?.url) window.location.href = d.url;
}

export function useDriveDesconectar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => invokeDrive({ action: 'desconectar' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drive-estado'] }),
  });
}

export async function driveListar(folderId?: string | null, buscar?: string): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  const d = await invokeDrive({ action: 'listar', folderId: folderId ?? null, buscar: buscar ?? '' });
  return { files: (d.files ?? []) as DriveFile[], nextPageToken: d.nextPageToken ?? null };
}

export async function driveDescargar(fileId: string): Promise<{ nombre: string; mimeType: string; base64: string }> {
  return invokeDrive({ action: 'descargar', fileId });
}

// Envía un archivo de Drive al Experto (documentos de trabajo de una licitación).
// Reutiliza el pipeline de extracción/lectura existente (experto-documentos), que
// ya aplica cupo por plan. En la UI se ofrece solo a usuarios Pro.
export async function driveEnviarAlExperto(fileId: string, codigo: string): Promise<any> {
  const d = await driveDescargar(fileId);
  const bytes = Uint8Array.from(atob(d.base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: d.mimeType });
  const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  const r = await fetch(`${SUPA}/functions/v1/experto-documentos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': d.mimeType || 'application/octet-stream',
      'X-Codigo': codigo,
      'X-Nombre': encodeURIComponent(d.nombre),
      'X-Destino': 'auto',
    },
    body: blob,
  });
  const res = await r.json().catch(() => ({}));
  if (!r.ok || res?.error) throw new Error(res?.mensaje || res?.error || 'No se pudo enviar al Experto');
  return res;
}
