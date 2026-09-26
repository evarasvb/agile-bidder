const HEX_64 = /^[0-9a-f]{64}$/;

export type AcademyRateLimitAction =
  | 'crear_checkout'
  | 'validar_codigo'
  | 'recuperar_acceso'
  | 'procesar_webhook_red'
  | 'procesar_webhook_id';

export function academyMaintenanceEnabled(value: string | null | undefined): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return !['0', 'false', 'off', 'no'].includes(normalized);
}

export function rateLimitWindowStart(
  now: Date,
  windowMs: number,
): string {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs).toISOString();
}

export function requestNetworkIdentity(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const candidate =
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    forwarded;

  if (candidate && candidate.length <= 64 && /^[0-9a-f:.]+$/i.test(candidate)) {
    return candidate.toLowerCase();
  }

  const userAgent = String(headers.get('user-agent') || 'unknown').slice(0, 160);
  return `unknown:${userAgent}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function requestRateLimitHash(
  headers: Headers,
  pepper: string,
  action: AcademyRateLimitAction,
  discriminator = '',
): Promise<string> {
  const identity = requestNetworkIdentity(headers);
  const hash = await sha256Hex(`${pepper}\0${action}\0${identity}\0${discriminator}`);
  if (!HEX_64.test(hash)) throw new Error('rate_limit_hash_failed');
  return hash;
}

export interface AcademyRateLimitInput {
  action: AcademyRateLimitAction;
  keyHash: string;
  windowStart: string;
  limit: number;
}

export async function consumeAcademyRateLimit(
  execute: (args: {
    p_accion: string;
    p_clave_hash: string;
    p_ventana_inicio: string;
    p_limite: number;
  }) => PromiseLike<{ data: boolean | null; error: unknown }>,
  input: AcademyRateLimitInput,
): Promise<boolean> {
  const { data, error } = await execute({
    p_accion: input.action,
    p_clave_hash: input.keyHash,
    p_ventana_inicio: input.windowStart,
    p_limite: input.limit,
  });
  if (error) throw new Error('rate_limit_unavailable');
  return data === true;
}
