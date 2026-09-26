import {
  getAcademyProduct,
  type AcademyProduct,
} from '../_shared/academia-products.ts';

const ACCEPTED_WEBHOOK_TOPICS = new Set([
  'payment',
  'chargebacks',
  'topic_chargebacks_wh',
]);

export type MercadoPagoHttpDisposition =
  | 'success'
  | 'retry'
  | 'configuration_error'
  | 'definitive_error';

export const ACADEMY_TERMINAL_PAYMENT_FILTER =
  '("refunded","charged_back","cancelled")';
export const ACADEMY_PROTECTED_DELIVERY_FILTER = '("revocada","notificada")';

export function academyDeliveryFailurePatch(
  assignmentCommitted: boolean,
  updatedAt: string,
) {
  return {
    entrega_estado: assignmentCommitted ? 'asignada' : 'error',
    updated_at: updatedAt,
  } as const;
}

export function isAcademyTerminalPaymentState(state: string | null | undefined): boolean {
  return state === 'refunded' || state === 'charged_back' || state === 'cancelled';
}

export interface MercadoPagoWebhookEvent {
  kind: 'payment' | 'chargeback';
  topic: string;
  paymentId: string;
  providerEventId: string | null;
  providerResourceId: string | null;
}

export function classifyMercadoPagoHttpStatus(status: number): MercadoPagoHttpDisposition {
  if (status >= 200 && status < 300) return 'success';
  if (status === 401 || status === 403) return 'configuration_error';
  if (status === 404 || status === 408 || status === 429 || status >= 500) return 'retry';
  return 'definitive_error';
}

export interface MercadoPagoWebhookSignatureInput {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}

export type MercadoPagoWebhookAuthorization =
  | 'authorized'
  | 'configuration_error'
  | 'unauthorized';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeHexMatches(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function validateMercadoPagoWebhookSignature(
  input: MercadoPagoWebhookSignatureInput,
): Promise<boolean> {
  const signature = String(input.xSignature || '').trim();
  const requestId = String(input.xRequestId || '').trim();
  const dataId = String(input.dataId || '').trim().toLowerCase();
  const secret = String(input.secret || '');
  if (
    !signature || !requestId || !dataId || !secret ||
    requestId.length > 256 || dataId.length > 256 ||
    /[\r\n]/.test(requestId) || /[\r\n]/.test(dataId)
  ) return false;

  let timestamp: string | null = null;
  let suppliedHash: string | null = null;
  for (const part of signature.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === 'ts') timestamp = value;
    if (key === 'v1') suppliedHash = value.toLowerCase();
  }
  if (
    !timestamp || !/^\d{1,20}$/.test(timestamp) ||
    !suppliedHash || !/^[0-9a-f]{64}$/.test(suppliedHash)
  ) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(manifest),
  );
  return constantTimeHexMatches(bytesToHex(new Uint8Array(digest)), suppliedHash);
}

export async function authorizeMercadoPagoChargeback(
  input: Omit<MercadoPagoWebhookSignatureInput, 'secret'> & {
    secret: string | null | undefined;
  },
): Promise<MercadoPagoWebhookAuthorization> {
  if (!input.secret) return 'configuration_error';
  return await validateMercadoPagoWebhookSignature({
      ...input,
      secret: input.secret,
    })
    ? 'authorized'
    : 'unauthorized';
}

export function parseMercadoPagoWebhookEvent(
  body: unknown,
  query: URLSearchParams,
): MercadoPagoWebhookEvent | null {
  const payload = body && typeof body === 'object'
    ? body as Record<string, unknown>
    : {};
  const data = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : {};
  const topic = String(
    payload.type || payload.topic || query.get('type') || query.get('topic') || '',
  ).trim().toLowerCase();
  if (!ACCEPTED_WEBHOOK_TOPICS.has(topic)) return null;

  const isChargeback = topic === 'chargebacks' || topic === 'topic_chargebacks_wh';
  const candidate = isChargeback
    ? data.payment_id || query.get('payment_id') || query.get('data.payment_id')
    : data.id || query.get('data.id') || query.get('id');
  const paymentId = String(candidate ?? '').trim();
  if (!/^\d{1,32}$/.test(paymentId)) return null;

  const providerEventId = String(payload.id || '').trim();
  const providerResourceId = String(
    query.get('data.id') || query.get('data_id') || data.id || '',
  ).trim();
  return {
    kind: isChargeback ? 'chargeback' : 'payment',
    topic,
    paymentId,
    providerEventId: providerEventId ? providerEventId.slice(0, 128) : null,
    providerResourceId: providerResourceId ? providerResourceId.slice(0, 256) : null,
  };
}

export function extractMercadoPagoWebhookPaymentId(
  body: unknown,
  query: URLSearchParams,
): string | null {
  return parseMercadoPagoWebhookEvent(body, query)?.paymentId ?? null;
}

export function academyChargebackInboxKey(topic: string, providerResourceId: string): string {
  const normalizedTopic = topic.trim().toLowerCase();
  const normalizedResourceId = providerResourceId.trim().toLowerCase();
  if (
    !ACCEPTED_WEBHOOK_TOPICS.has(normalizedTopic) ||
    normalizedTopic === 'payment'
  ) throw new Error('invalid_chargeback_topic');
  if (
    !normalizedResourceId || normalizedResourceId.length > 256 ||
    [...normalizedResourceId].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) throw new Error('invalid_provider_resource_id');
  return `chargeback:${normalizedTopic}:${encodeURIComponent(normalizedResourceId)}`;
}

export function buildAcademyChargebackInboxRow(event: MercadoPagoWebhookEvent) {
  if (event.kind !== 'chargeback') throw new Error('not_chargeback_event');
  if (!event.providerEventId) throw new Error('missing_provider_event_id');
  if (!event.providerResourceId) throw new Error('missing_provider_resource_id');
  return {
    // data.id forma parte de la firma HMAC; payload.id no. Deduplicar por el
    // recurso firmado impide reutilizar una firma capturada con variantes del
    // cuerpo para llenar la cola.
    event_key: academyChargebackInboxKey(event.topic, event.providerResourceId),
    event_type: 'chargeback' as const,
    payment_id: event.paymentId,
    provider_topic: event.topic,
    provider_event_id: event.providerEventId,
    provider_resource_id: event.providerResourceId,
    signature_verified: true,
  };
}

export interface AcademyPaymentRow {
  id: string;
  curso_slug: string;
  email: string | null;
  monto: number;
  mp_preference_id: string | null;
  mp_payment_id?: string | null;
  entrega_estado?: string | null;
  estado?: string;
}

export interface VerifiedMercadoPagoPayment {
  id: string | number;
  status: string;
  order?: { id?: string | number | null } | null;
  transaction_amount?: number | string | null;
  currency_id?: string | null;
  payer?: { email?: string | null } | null;
}

export interface VerifiedMercadoPagoMerchantOrder {
  id?: string | number | null;
  external_reference?: string | null;
  preference_id?: string | null;
  payments?: Array<{ id?: string | number | null }> | null;
}

export interface AcademyAccess {
  curso_slug: string;
  codigo: string;
}

export interface AcademyFulfillmentPlan {
  paymentId: string;
  mercadoPagoPaymentId: string;
  buyerEmail: string;
  product: AcademyProduct;
  notificationCompleted: boolean;
}

export type AcademyPaymentValidation =
  | { ok: true; plan: AcademyFulfillmentPlan }
  | {
      ok: false;
      code:
        | 'not_approved'
        | 'invalid_order'
        | 'invalid_reference'
        | 'missing_preference'
        | 'invalid_preference'
        | 'payment_not_in_order'
        | 'invalid_payment_id'
        | 'unknown_product'
        | 'amount_mismatch'
        | 'currency_mismatch'
        | 'missing_email';
    };

export type AcademyPaymentIdentityValidation =
  | { ok: true; product: AcademyProduct }
  | {
      ok: false;
      code:
        | 'invalid_order'
        | 'invalid_reference'
        | 'missing_preference'
        | 'invalid_preference'
        | 'payment_not_in_order'
        | 'invalid_payment_id'
        | 'unknown_product'
        | 'amount_mismatch'
        | 'currency_mismatch';
    };

export function validateAcademyPaymentIdentity(
  payment: VerifiedMercadoPagoPayment,
  merchantOrder: VerifiedMercadoPagoMerchantOrder,
  row: AcademyPaymentRow,
): AcademyPaymentIdentityValidation {
  const paymentOrderId = String(payment.order?.id ?? '');
  const merchantOrderId = String(merchantOrder.id ?? '');
  if (!paymentOrderId || !merchantOrderId || paymentOrderId !== merchantOrderId) {
    return { ok: false, code: 'invalid_order' };
  }
  if (merchantOrder.external_reference !== row.id) {
    return { ok: false, code: 'invalid_reference' };
  }
  if (!row.mp_preference_id || !merchantOrder.preference_id) {
    return { ok: false, code: 'missing_preference' };
  }
  if (merchantOrder.preference_id !== row.mp_preference_id) {
    return { ok: false, code: 'invalid_preference' };
  }
  if (
    !Array.isArray(merchantOrder.payments) ||
    !merchantOrder.payments.some(({ id }) => String(id ?? '') === String(payment.id))
  ) {
    return { ok: false, code: 'payment_not_in_order' };
  }
  if (row.mp_payment_id && String(payment.id) !== row.mp_payment_id) {
    return { ok: false, code: 'invalid_payment_id' };
  }

  const product = getAcademyProduct(row.curso_slug);
  if (!product) return { ok: false, code: 'unknown_product' };
  if (Number(payment.transaction_amount) !== row.monto || row.monto !== product.amount) {
    return { ok: false, code: 'amount_mismatch' };
  }
  if (payment.currency_id !== 'CLP') return { ok: false, code: 'currency_mismatch' };

  return { ok: true, product };
}

export function validateAcademyPayment(
  payment: VerifiedMercadoPagoPayment,
  merchantOrder: VerifiedMercadoPagoMerchantOrder,
  row: AcademyPaymentRow,
): AcademyPaymentValidation {
  const identity = validateAcademyPaymentIdentity(payment, merchantOrder, row);
  if (!identity.ok) return identity;
  if (payment.status !== 'approved') return { ok: false, code: 'not_approved' };

  const buyerEmail = String(payment.payer?.email || row.email || '').trim().toLowerCase();
  if (!buyerEmail) return { ok: false, code: 'missing_email' };

  return {
    ok: true,
    plan: {
      paymentId: row.id,
      mercadoPagoPaymentId: String(payment.id),
      buyerEmail,
      product: identity.product,
      notificationCompleted: row.entrega_estado === 'notificada',
    },
  };
}

export interface AcademyFulfillmentDependencies {
  assignAccesses(input: {
    paymentId: string;
    mercadoPagoPaymentId: string;
    buyerEmail: string;
    courseSlugs: readonly string[];
  }): Promise<AcademyAccess[]>;
  sendAccessEmail(input: {
    paymentId: string;
    buyerEmail: string;
    product: AcademyProduct;
    accesses: AcademyAccess[];
    idempotencyKey: string;
  }): Promise<void>;
  markNotified(input: {
    paymentId: string;
    mercadoPagoPaymentId: string;
  }): Promise<void>;
}

export async function fulfillAcademyPayment(
  plan: AcademyFulfillmentPlan,
  dependencies: AcademyFulfillmentDependencies,
): Promise<AcademyAccess[]> {
  const accesses = await dependencies.assignAccesses({
    paymentId: plan.paymentId,
    mercadoPagoPaymentId: plan.mercadoPagoPaymentId,
    buyerEmail: plan.buyerEmail,
    courseSlugs: plan.product.courseSlugs,
  });

  const expected = [...plan.product.courseSlugs].sort();
  const delivered = accesses.map(({ curso_slug }) => curso_slug).sort();
  if (
    accesses.length !== expected.length ||
    new Set(delivered).size !== expected.length ||
    delivered.some((slug, index) => slug !== expected[index])
  ) {
    throw new Error('incomplete_access_delivery');
  }

  if (plan.notificationCompleted) return accesses;

  await dependencies.sendAccessEmail({
    paymentId: plan.paymentId,
    buyerEmail: plan.buyerEmail,
    product: plan.product,
    accesses,
    idempotencyKey: `academia-pago-${plan.paymentId}`,
  });

  await dependencies.markNotified({
    paymentId: plan.paymentId,
    mercadoPagoPaymentId: plan.mercadoPagoPaymentId,
  });

  return accesses;
}

export const REVERSAL_STATUSES = ['refunded', 'charged_back', 'cancelled'] as const;
export type AcademyReversalStatus = typeof REVERSAL_STATUSES[number];

export function isAcademyReversalStatus(status: string): status is AcademyReversalStatus {
  return (REVERSAL_STATUSES as readonly string[]).includes(status);
}

export interface AcademyRevocationDependencies {
  revokeAccesses(input: {
    paymentId: string;
    mercadoPagoPaymentId: string;
    status: AcademyReversalStatus;
  }): Promise<number>;
}

export async function revokeAcademyPayment(
  payment: VerifiedMercadoPagoPayment,
  merchantOrder: VerifiedMercadoPagoMerchantOrder,
  row: AcademyPaymentRow,
  dependencies: AcademyRevocationDependencies,
): Promise<{ handled: boolean; revoked: number }> {
  if (!isAcademyReversalStatus(payment.status)) {
    return { handled: false, revoked: 0 };
  }

  const identity = validateAcademyPaymentIdentity(payment, merchantOrder, row);
  if (!identity.ok) throw new Error(identity.code);

  const revoked = await dependencies.revokeAccesses({
    paymentId: row.id,
    mercadoPagoPaymentId: String(payment.id),
    status: payment.status,
  });
  return { handled: true, revoked };
}
