import {
  getAcademyProduct,
  type AcademyProduct,
} from '../_shared/academia-products.ts';

export const DEFAULT_ACADEMY_ORIGIN = 'https://www.firmavb.cl';

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'https://firmavb.cl',
  'https://www.firmavb.cl',
]);

export function normalizeAcademyOrigin(
  value: unknown,
  allowedOrigins: ReadonlySet<string> = DEFAULT_ALLOWED_ORIGINS,
): string {
  try {
    const origin = new URL(String(value || DEFAULT_ACADEMY_ORIGIN)).origin;
    return allowedOrigins.has(origin) ? origin : DEFAULT_ACADEMY_ORIGIN;
  } catch {
    return DEFAULT_ACADEMY_ORIGIN;
  }
}

export interface AcademyCheckoutInput {
  paymentId: string;
  product: AcademyProduct;
  supabaseUrl: string;
  backOrigin: string;
  email?: string | null;
}

export interface MercadoPagoPreference {
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    unit_price: number;
    currency_id: 'CLP';
  }>;
  external_reference: string;
  metadata: {
    pago_id: string;
    producto_slug: string;
    cantidad_cursos: number;
  };
  notification_url: string;
  back_urls: { success: string; pending: string; failure: string };
  auto_return: 'approved';
  statement_descriptor: string;
  payer?: { email: string };
}

export function buildAcademyPreference(
  input: AcademyCheckoutInput,
): MercadoPagoPreference {
  const base = `${input.backOrigin}${input.product.returnPath}`;
  const preference: MercadoPagoPreference = {
    items: [{
      id: input.product.slug,
      title: input.product.title,
      quantity: 1,
      unit_price: input.product.amount,
      currency_id: 'CLP',
    }],
    external_reference: input.paymentId,
    metadata: {
      pago_id: input.paymentId,
      producto_slug: input.product.slug,
      cantidad_cursos: input.product.courseSlugs.length,
    },
    notification_url: `${input.supabaseUrl}/functions/v1/mp-curso-webhook`,
    back_urls: {
      success: `${base}?pago=ok`,
      pending: `${base}?pago=pendiente`,
      failure: `${base}?pago=error`,
    },
    auto_return: 'approved',
    statement_descriptor: 'FIRMAVB ACADEMIA',
  };

  if (input.email) preference.payer = { email: input.email };
  return preference;
}

export function resolveAcademyProduct(slug: unknown): AcademyProduct | undefined {
  return getAcademyProduct(String(slug || '').trim());
}
