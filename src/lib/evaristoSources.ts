/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
export interface EvaristoSource {
  n: number;
  fuente: string;
  seccion: string | null;
  url: string | null;
}

export interface EvaristoSourceState {
  estado: "ok" | "empty" | "error";
  cantidad?: number;
}

const RESPONSE_STATES = [
  "ok", "answered_with_sources", "needs_evidence", "access_denied", "incomplete",
  "clarification", "model_error", "action_only",
] as const;
export type EvaristoResponseState = typeof RESPONSE_STATES[number];

export interface EvaristoEvidence {
  fuentes?: EvaristoSource[];
  estados_fuentes?: Record<string, EvaristoSourceState>;
  estado_respuesta?: EvaristoResponseState;
}

const MAX_SOURCES = 64;
const MAX_SOURCE_STATES = 20;
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function shortText(value: unknown, limit: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex -- Descarta controles en texto externo.
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

// Las referencias persistidas no deben conservar credenciales ni enlaces
// firmados que caducan. Si no hay un enlace público seguro, conservamos el título.
export function safeEvaristoSourceUrl(value: unknown): string | null {
  // eslint-disable-next-line no-control-regex -- Rechaza controles antes de interpretar URLs externas.
  if (typeof value !== "string" || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // No convertimos una cita en un enlace a la red local o al dispositivo.
    if (!host.includes(".") || host.includes(":") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
        || (a === 100 && b >= 64 && b <= 127)) return null;
    }
    if (/\/storage\/v1\/object\/(sign|authenticated)(\/|$)/i.test(url.pathname)) return null;
    const sensitiveKey = /^(?:x-amz-|x-goog-)|(?:token|signature|credential|password|secret)|^(?:sig|key|api_?key|authorization|auth|jwt|awsaccesskeyid|googleaccessid|key-pair-id|policy)$/i;
    if ([...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some((key) => sensitiveKey.test(key))) return null;
    return url.href;
  } catch { return null; }
}

export function readEvaristoSources(value: unknown): EvaristoSource[] {
  if (!Array.isArray(value)) return [];
  const sources: EvaristoSource[] = [];
  const numbers = new Set<number>();
  for (const entry of value.slice(0, MAX_SOURCES)) {
    const source = asRecord(entry);
    if (!source || !hasOwn(source, "n") || !hasOwn(source, "fuente")) continue;
    const { n } = source;
    const fuente = shortText(source.fuente, 240);
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 999 || numbers.has(n) || !fuente) continue;
    numbers.add(n);
    sources.push({
      n, fuente,
      seccion: hasOwn(source, "seccion") ? shortText(source.seccion, 320) : null,
      url: hasOwn(source, "url") ? safeEvaristoSourceUrl(source.url) : null,
    });
  }
  return sources;
}

// Mismo contrato para la respuesta, meta del historial y caché local.
// Selecciona campos conocidos; nunca propaga metadatos internos del servidor.
export function readEvaristoEvidence(value: unknown): EvaristoEvidence {
  const data = asRecord(value);
  if (!data) return {};
  const evidence: EvaristoEvidence = {};
  const sources = hasOwn(data, "fuentes") ? readEvaristoSources(data.fuentes) : [];
  if (sources.length) evidence.fuentes = sources;
  if (hasOwn(data, "estado_respuesta") && RESPONSE_STATES.some((state) => state === data.estado_respuesta)) {
    evidence.estado_respuesta = data.estado_respuesta as EvaristoResponseState;
  }
  const states = hasOwn(data, "estados_fuentes") ? asRecord(data.estados_fuentes) : null;
  if (states) {
    const valid: Record<string, EvaristoSourceState> = {};
    for (const [name, value] of Object.entries(states).slice(0, MAX_SOURCE_STATES)) {
      const state = asRecord(value);
      if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(name) || ["__proto__", "constructor", "prototype"].includes(name)
        || !state || !hasOwn(state, "estado") || typeof state.estado !== "string" || !["ok", "empty", "error"].includes(state.estado)) continue;
      valid[name] = { estado: state.estado as EvaristoSourceState["estado"] };
      if (hasOwn(state, "cantidad") && typeof state.cantidad === "number" && Number.isSafeInteger(state.cantidad) && state.cantidad >= 0 && state.cantidad <= 1_000_000) {
        valid[name].cantidad = state.cantidad;
      }
    }
    if (Object.keys(valid).length) evidence.estados_fuentes = valid;
  }
  return evidence;
}

// Supabase devuelve las denegaciones del Experto como FunctionsHttpError.
// Solo se acepta el mensaje previsto por soporte, nunca error.message ni HTML.
export async function readEvaristoAccessDeniedResponse(error: unknown): Promise<Record<string, unknown> | null> {
  const context = asRecord(error)?.context;
  if (!(context instanceof Response) || ![401, 402, 403, 429, 503].includes(context.status)) return null;
  try {
    const data = asRecord(await context.clone().json());
    if (!data || typeof data.reply !== "string" || !data.reply.trim() || data.reply.length > 12_000
      || data.estado_respuesta !== "access_denied") return null;
    return data;
  } catch { return null; }
}
