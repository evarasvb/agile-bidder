/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { mismoCodigoMatriz } from './matrizReadiness';

/** Supabase resolves RPC failures; React Query needs them thrown to retain its error state. */
export function readLibroResult<T extends { codigo?: string }>(
  result: { data: unknown; error: unknown }, codigo: string,
): T | null {
  if (result.error) throw result.error;
  if (result.data === null) return null;
  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)
    || !mismoCodigoMatriz((result.data as { codigo?: string }).codigo, codigo)) {
    throw new Error('No se pudo verificar el libro de esta licitación.');
  }
  return result.data as T;
}

export function readSavedPptx(payload: unknown, codigo: string): { slides: number } {
  const value = payload as Record<string, unknown> | null;
  if (!value || value.ok !== true || value.codigo !== codigo
    || typeof value.documento_id !== 'string'
    || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value.documento_id)
    || value.nombre !== `Matriz_${codigo}.pptx`
    || !Number.isInteger(value.slides) || Number(value.slides) < 1) {
    throw new Error('No se pudo confirmar que el PowerPoint quedó guardado. Reintenta la generación.');
  }
  return { slides: Number(value.slides) };
}

export interface LibroDownload { url: string; nombre: string }

/** Only retain the authenticated endpoint's short-lived private Storage URL in this view. */
export function readLibroDownload(payload: unknown, supabaseUrl: string): LibroDownload {
  const value = payload as Record<string, unknown> | null;
  try {
    if (!value || value.ok !== true || typeof value.url !== 'string') throw new Error();
    const url = new URL(value.url);
    const base = new URL(supabaseUrl);
    if (url.origin !== base.origin || !['https:', 'http:'].includes(url.protocol)
      || url.username || url.password
      || !url.pathname.startsWith('/storage/v1/object/sign/documentos-trabajo/')
      || !url.searchParams.get('token')) throw new Error();
    return { url: url.href, nombre: typeof value.nombre === 'string' ? value.nombre : 'Documento' };
  } catch {
    throw new Error('No pude preparar la descarga. Intenta nuevamente.');
  }
}

/** A synchronous lock whose completions cannot affect a newer view or a restarted action. */
export function createLibroActionScope() {
  let active = true;
  const pending = new Map<string, { controller: AbortController; timer?: ReturnType<typeof setTimeout> }>();
  return {
    activate() { active = true; },
    close() {
      active = false;
      for (const task of pending.values()) {
        clearTimeout(task.timer);
        task.controller.abort();
      }
      pending.clear();
    },
    start(key: string, timeoutMs?: number) {
      if (!active || pending.has(key)) return null;
      const task = { controller: new AbortController(), timer: undefined as ReturnType<typeof setTimeout> | undefined };
      if (timeoutMs) task.timer = setTimeout(() => task.controller.abort(), timeoutMs);
      pending.set(key, task);
      const isCurrent = () => active && pending.get(key) === task;
      return {
        signal: task.controller.signal,
        isCurrent,
        finish() {
          clearTimeout(task.timer);
          if (!isCurrent()) return false;
          pending.delete(key);
          return true;
        },
      };
    },
  };
}
