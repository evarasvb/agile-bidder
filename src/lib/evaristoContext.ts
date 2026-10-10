/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
// El servidor resuelve el proceso. La ruta solo es una pista nueva al navegar;
// nunca se vuelve a deducir un proceso desde los mensajes del asistente.
export interface EvaristoContext {
  conversationId: string | null;
  activeCode: string | null;
  lastRoute: string | null;
}

export const emptyEvaristoContext = (): EvaristoContext => ({
  conversationId: null, activeCode: null, lastRoute: null,
});

export function normalizeProcessCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/.test(code) ? code : null;
}

export function processCodeInRoute(path: string): string | null {
  for (const part of path.split("/")) {
    try {
      const code = normalizeProcessCode(decodeURIComponent(part));
      if (code) return code;
    } catch { /* Una URL mal codificada no debe romper el chat. */ }
  }
  return null;
}

export function processContextForRequest(context: EvaristoContext, path: string) {
  return {
    codigo: path !== context.lastRoute ? processCodeInRoute(path) : null,
    codigo_activo: context.activeCode,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function contextAfterResponse(context: EvaristoContext, response: unknown, path: string): EvaristoContext {
  const data = asRecord(response) ?? {};
  const conversationId = typeof data.conversacion_id === "string" && data.conversacion_id
    ? data.conversacion_id : context.conversationId;
  return {
    conversationId,
    activeCode: data.contexto_ambiguo === true ? context.activeCode
      : Object.prototype.hasOwnProperty.call(data, "codigo_activo") ? normalizeProcessCode(data.codigo_activo)
      : conversationId === context.conversationId ? context.activeCode : null,
    lastRoute: path,
  };
}

// Filas de más reciente a más antigua. Un null explícito en el nuevo campo
// limpia el contexto; el viejo meta.codigo=null solo significaba «sin ruta».
export function processCodeFromHistory(rows: readonly { meta?: unknown }[]): string | null {
  for (const row of rows) {
    const meta = asRecord(row.meta);
    if (!meta || meta.contexto_ambiguo === true) continue;
    if (Object.prototype.hasOwnProperty.call(meta, "codigo_activo")) {
      if (meta.codigo_activo === null) return null;
      const active = normalizeProcessCode(meta.codigo_activo);
      if (active) return active;
    }
    const legacy = normalizeProcessCode(meta.codigo);
    if (legacy) return legacy;
  }
  return null;
}

export function evaristoStorageKey(userId: string | null): string {
  return `fvb_evaristo_session:${userId ?? "anonymous"}`;
}

export function readEvaristoContext(value: unknown): EvaristoContext {
  const data = asRecord(value) ?? {};
  return {
    conversationId: typeof data.conversationId === "string" && data.conversationId ? data.conversationId : null,
    activeCode: normalizeProcessCode(data.activeCode),
    lastRoute: typeof data.lastRoute === "string" ? data.lastRoute : null,
  };
}
