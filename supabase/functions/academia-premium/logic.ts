export const GENERIC_RECOVERY_MESSAGE =
  'Si existe una compra para ese correo, enviaremos el código de acceso. Revisa también spam.';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

export const PRIVATE_ACADEMY_BUCKET = 'academia-premium';
export const PRIVATE_PLANILLAS_OBJECT_PATH = 'planillas-programa-pro.xlsx';
export const PRIVATE_PLANILLAS_PLACEHOLDER =
  'private://academia-premium/planillas-programa-pro.xlsx';

export function normalizeRecoveryEmail(value: unknown): string | null {
  const email = String(value || '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function normalizeCourseSlug(value: unknown): string | null {
  const slug = String(value || '').trim();
  return SLUG_PATTERN.test(slug) ? slug : null;
}

export function safeRecoveryResponse() {
  return { ok: true as const, message: GENERIC_RECOVERY_MESSAGE };
}

export function recoveryWindowStart(now = new Date()): string {
  const fifteenMinutes = 15 * 60 * 1_000;
  return new Date(Math.floor(now.getTime() / fifteenMinutes) * fifteenMinutes).toISOString();
}

export function containsPrivatePlanillasDownload(value: unknown): boolean {
  if (value === PRIVATE_PLANILLAS_PLACEHOLDER) return true;
  if (Array.isArray(value)) return value.some(containsPrivatePlanillasDownload);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .some(containsPrivatePlanillasDownload);
  }
  return false;
}

export function attachPrivatePlanillasUrl<T>(value: T, signedUrl: string): T {
  if (!/^https:\/\//.test(signedUrl)) throw new Error('invalid_signed_url');
  if (value === PRIVATE_PLANILLAS_PLACEHOLDER) return signedUrl as T;
  if (Array.isArray(value)) {
    return value.map((item) => attachPrivatePlanillasUrl(item, signedUrl)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, attachPrivatePlanillasUrl(item, signedUrl)]),
    ) as T;
  }
  return value;
}
