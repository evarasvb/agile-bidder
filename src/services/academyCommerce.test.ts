import { describe, expect, it, vi } from 'vitest';
import {
  SAGA_BUNDLE_SLUG,
  SAGA_COURSE_SLUGS,
  getAcademyProduct,
} from '../../supabase/functions/_shared/academia-products';
import {
  buildAcademyPreference,
  normalizeAcademyOrigin,
} from '../../supabase/functions/crear-pago-curso/logic';
import {
  ACADEMY_PROTECTED_DELIVERY_FILTER,
  ACADEMY_TERMINAL_PAYMENT_FILTER,
  academyChargebackInboxKey,
  academyDeliveryFailurePatch,
  authorizeMercadoPagoChargeback,
  buildAcademyChargebackInboxRow,
  classifyMercadoPagoHttpStatus,
  extractMercadoPagoWebhookPaymentId,
  fulfillAcademyPayment,
  isAcademyTerminalPaymentState,
  parseMercadoPagoWebhookEvent,
  revokeAcademyPayment,
  validateAcademyPayment,
  validateMercadoPagoWebhookSignature,
  type AcademyAccess,
  type AcademyPaymentRow,
  type VerifiedMercadoPagoMerchantOrder,
  type VerifiedMercadoPagoPayment,
} from '../../supabase/functions/mp-curso-webhook/logic';
import {
  academyMaintenanceEnabled,
  consumeAcademyRateLimit,
  rateLimitWindowStart,
  requestNetworkIdentity,
  requestRateLimitHash,
} from '../../supabase/functions/_shared/academia-security';
import {
  attachPrivatePlanillasUrl,
  containsPrivatePlanillasDownload,
  PRIVATE_PLANILLAS_PLACEHOLDER,
  safeRecoveryResponse,
} from '../../supabase/functions/academia-premium/logic';
import {
  AcademyInboxProcessingError,
  academyInboxErrorDetails,
  academyInboxRetryDelaySeconds,
  processAcademyChargeback,
} from '../../supabase/functions/procesar-academia-mp-inbox/logic';
import { getAcademyPaymentReturnNotice } from './academyPaymentMessages';

const paymentId = '11111111-1111-4111-8111-111111111111';
const mercadoPagoPaymentId = '987654321';

async function mercadoPagoSignature(
  secret: string,
  dataId: string,
  requestId: string,
  timestamp: string,
): Promise<string> {
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
    new TextEncoder().encode(
      `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`,
    ),
  );
  const hash = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  return `ts=${timestamp},v1=${hash}`;
}

const bundleRow: AcademyPaymentRow = {
  id: paymentId,
  curso_slug: SAGA_BUNDLE_SLUG,
  email: null,
  monto: 250_000,
  mp_preference_id: 'pref-123',
  mp_payment_id: null,
  entrega_estado: 'no_asignada',
};

const approvedPayment: VerifiedMercadoPagoPayment = {
  id: mercadoPagoPaymentId,
  status: 'approved',
  order: { id: '24681012' },
  transaction_amount: 250_000,
  currency_id: 'CLP',
  payer: { email: 'Comprador@Ejemplo.cl' },
};

const merchantOrder: VerifiedMercadoPagoMerchantOrder = {
  id: 24681012,
  external_reference: paymentId,
  preference_id: 'pref-123',
  payments: [{ id: Number(mercadoPagoPaymentId) }],
};

describe('checkout de Academia', () => {
  it('activa mantenimiento de forma conservadora y no por ausencia', () => {
    expect(academyMaintenanceEnabled(undefined)).toBe(false);
    expect(academyMaintenanceEnabled('false')).toBe(false);
    expect(academyMaintenanceEnabled('0')).toBe(false);
    expect(academyMaintenanceEnabled('true')).toBe(true);
    expect(academyMaintenanceEnabled('typo')).toBe(true);
  });

  it('mantiene el precio autoritativo del pack y sus siete cursos', () => {
    const product = getAcademyProduct(SAGA_BUNDLE_SLUG);

    expect(product).toMatchObject({
      slug: SAGA_BUNDLE_SLUG,
      amount: 250_000,
      returnPath: '/academia',
    });
    expect(product?.courseSlugs).toEqual(SAGA_COURSE_SLUGS);
    expect(new Set(product?.courseSlugs).size).toBe(7);
  });

  it('crea la referencia desde el pago registrado y no acepta un retorno externo', () => {
    const product = getAcademyProduct(SAGA_BUNDLE_SLUG)!;
    const origin = normalizeAcademyOrigin('https://sitio-falso.example/robar');
    const preference = buildAcademyPreference({
      paymentId,
      product,
      supabaseUrl: 'https://proyecto.supabase.co',
      backOrigin: origin,
      email: null,
    });

    expect(origin).toBe('https://www.firmavb.cl');
    expect(preference.external_reference).toBe(paymentId);
    expect(preference.items).toEqual([
      expect.objectContaining({ id: SAGA_BUNDLE_SLUG, unit_price: 250_000, currency_id: 'CLP' }),
    ]);
    expect(preference.metadata).toMatchObject({ pago_id: paymentId, cantidad_cursos: 7 });
    expect(preference.back_urls.success).toBe('https://www.firmavb.cl/academia?pago=ok');
  });

  it('rechaza referencias, precios o monedas que no coinciden con el registro', () => {
    expect(validateAcademyPayment(
      approvedPayment,
      { ...merchantOrder, external_reference: '22222222-2222-4222-8222-222222222222' },
      bundleRow,
    )).toEqual({ ok: false, code: 'invalid_reference' });

    expect(validateAcademyPayment(
      { ...approvedPayment, transaction_amount: 1 },
      merchantOrder,
      bundleRow,
    )).toEqual({ ok: false, code: 'amount_mismatch' });

    expect(validateAcademyPayment(
      { ...approvedPayment, currency_id: 'USD' },
      merchantOrder,
      bundleRow,
    )).toEqual({ ok: false, code: 'currency_mismatch' });
  });

  it('vincula el pago a su orden comercial y exige que esté incluido en ella', () => {
    expect(validateAcademyPayment(
      { ...approvedPayment, order: null },
      merchantOrder,
      bundleRow,
    )).toEqual({ ok: false, code: 'invalid_order' });

    expect(validateAcademyPayment(
      approvedPayment,
      { ...merchantOrder, id: 999 },
      bundleRow,
    )).toEqual({ ok: false, code: 'invalid_order' });

    expect(validateAcademyPayment(
      approvedPayment,
      { ...merchantOrder, payments: [{ id: 111 }] },
      bundleRow,
    )).toEqual({ ok: false, code: 'payment_not_in_order' });
  });

  it('falla cerrado si la preferencia no fue persistida o cambia el payment id', () => {
    expect(validateAcademyPayment(approvedPayment, merchantOrder, {
      ...bundleRow,
      mp_preference_id: null,
    })).toEqual({ ok: false, code: 'missing_preference' });

    expect(validateAcademyPayment(
      approvedPayment,
      { ...merchantOrder, preference_id: 'otra-preferencia' },
      bundleRow,
    )).toEqual({ ok: false, code: 'invalid_preference' });

    expect(validateAcademyPayment(approvedPayment, merchantOrder, {
      ...bundleRow,
      mp_payment_id: 'otro-payment-id',
    })).toEqual({ ok: false, code: 'invalid_payment_id' });
  });

});

describe('entrada del webhook de Mercado Pago', () => {
  it('extrae payment y chargebacks sin confundir el id del contracargo', () => {
    expect(extractMercadoPagoWebhookPaymentId(
      { type: 'payment', data: { id: 123 } },
      new URLSearchParams(),
    )).toBe('123');
    expect(extractMercadoPagoWebhookPaymentId(
      { type: 'Chargebacks', data: { id: 999, payment_id: 456 } },
      new URLSearchParams(),
    )).toBe('456');
    expect(extractMercadoPagoWebhookPaymentId(
      { topic: 'topic_chargebacks_wh', data: { payment_id: '789' } },
      new URLSearchParams(),
    )).toBe('789');
    expect(extractMercadoPagoWebhookPaymentId(
      { type: 'merchant_order', data: { id: 123 } },
      new URLSearchParams(),
    )).toBeNull();

    const chargebackEvent = parseMercadoPagoWebhookEvent(
      { type: 'Chargebacks', id: 'cb-1', data: { id: 999, payment_id: 456 } },
      new URLSearchParams(),
    );
    expect(chargebackEvent).toEqual({
      kind: 'chargeback',
      topic: 'chargebacks',
      paymentId: '456',
      providerEventId: 'cb-1',
      providerResourceId: '999',
    });
    expect(academyChargebackInboxKey('chargebacks', '999'))
      .toBe('chargeback:chargebacks:999');
    expect(buildAcademyChargebackInboxRow(chargebackEvent!)).toEqual({
      event_key: 'chargeback:chargebacks:999',
      event_type: 'chargeback',
      payment_id: '456',
      provider_topic: 'chargebacks',
      provider_event_id: 'cb-1',
      provider_resource_id: '999',
      signature_verified: true,
    });

    const laterEvent = parseMercadoPagoWebhookEvent(
      { type: 'Chargebacks', id: 'cb-2', data: { id: 999, payment_id: 456 } },
      new URLSearchParams(),
    );
    expect(buildAcademyChargebackInboxRow(laterEvent!).event_key)
      .toBe('chargeback:chargebacks:999');
  });

  it('valida x-signature de Mercado Pago y liga data.id al request', async () => {
    const secret = 'mp-secret-de-prueba';
    const requestId = 'request-abc';
    const dataId = 'ABC123';
    const signature = await mercadoPagoSignature(secret, dataId, requestId, '1704908010');

    await expect(validateMercadoPagoWebhookSignature({
      xSignature: signature,
      xRequestId: requestId,
      dataId,
      secret,
    })).resolves.toBe(true);
    await expect(validateMercadoPagoWebhookSignature({
      xSignature: signature,
      xRequestId: 'otro-request',
      dataId,
      secret,
    })).resolves.toBe(false);
    await expect(validateMercadoPagoWebhookSignature({
      xSignature: null,
      xRequestId: requestId,
      dataId,
      secret,
    })).resolves.toBe(false);
  });

  it('falla cerrado cuando falta configuración o firma del contracargo', async () => {
    const secret = 'mp-secret-de-prueba';
    const requestId = 'request-fail-closed';
    const dataId = 'CB123';
    const signature = await mercadoPagoSignature(secret, dataId, requestId, '1704908010');

    await expect(authorizeMercadoPagoChargeback({
      xSignature: signature,
      xRequestId: requestId,
      dataId,
      secret: null,
    })).resolves.toBe('configuration_error');
    await expect(authorizeMercadoPagoChargeback({
      xSignature: null,
      xRequestId: null,
      dataId,
      secret,
    })).resolves.toBe('unauthorized');
    await expect(authorizeMercadoPagoChargeback({
      xSignature: signature,
      xRequestId: 'request-adulterado',
      dataId,
      secret,
    })).resolves.toBe('unauthorized');
    await expect(authorizeMercadoPagoChargeback({
      xSignature: signature,
      xRequestId: requestId,
      dataId,
      secret,
    })).resolves.toBe('authorized');
  });

  it('un replay conserva la misma clave idempotente de notificación', () => {
    const event = {
      kind: 'chargeback' as const,
      topic: 'topic_chargebacks_wh',
      paymentId: '456',
      providerEventId: 'notification-123',
      providerResourceId: 'chargeback-999',
    };
    const original = buildAcademyChargebackInboxRow(event);
    const replay = buildAcademyChargebackInboxRow({ ...event });

    expect(replay.event_key).toBe(original.event_key);
    expect(replay.provider_event_id).toBe(original.provider_event_id);
  });

  it('separa errores temporales, de credencial y definitivos', () => {
    expect(classifyMercadoPagoHttpStatus(200)).toBe('success');
    expect(classifyMercadoPagoHttpStatus(401)).toBe('configuration_error');
    expect(classifyMercadoPagoHttpStatus(403)).toBe('configuration_error');
    expect(classifyMercadoPagoHttpStatus(404)).toBe('retry');
    expect(classifyMercadoPagoHttpStatus(408)).toBe('retry');
    expect(classifyMercadoPagoHttpStatus(429)).toBe('retry');
    expect(classifyMercadoPagoHttpStatus(500)).toBe('retry');
    expect(classifyMercadoPagoHttpStatus(503)).toBe('retry');
    expect(classifyMercadoPagoHttpStatus(400)).toBe('definitive_error');
  });
});

describe('bandeja durable de contracargos', () => {
  it('reconcilia con Payment y Merchant Order antes de revocar', async () => {
    const revokeAccesses = vi.fn(async () => 7);
    const result = await processAcademyChargeback(mercadoPagoPaymentId, {
      fetchPayment: async () => ({ ...approvedPayment, status: 'charged_back' }),
      fetchMerchantOrder: async () => merchantOrder,
      findPaymentRow: async () => ({ ...bundleRow, mp_payment_id: mercadoPagoPaymentId }),
      revokeAccesses,
    });

    expect(result).toEqual({ paymentReference: paymentId, revoked: 7 });
    expect(revokeAccesses).toHaveBeenCalledWith({
      paymentId,
      mercadoPagoPaymentId,
      status: 'charged_back',
    });
  });

  it('reintenta si el contracargo aún no aparece en Payment', async () => {
    const revokeAccesses = vi.fn(async () => 0);
    await expect(processAcademyChargeback(mercadoPagoPaymentId, {
      fetchPayment: async () => approvedPayment,
      fetchMerchantOrder: async () => merchantOrder,
      findPaymentRow: async () => bundleRow,
      revokeAccesses,
    })).rejects.toMatchObject({
      code: 'reversal_status_pending',
      retryable: true,
    });
    expect(revokeAccesses).not.toHaveBeenCalled();
  });

  it('falla definitivamente ante una identidad que no coincide', async () => {
    const error = await processAcademyChargeback(mercadoPagoPaymentId, {
      fetchPayment: async () => ({ ...approvedPayment, status: 'charged_back' }),
      fetchMerchantOrder: async () => ({ ...merchantOrder, preference_id: 'otra' }),
      findPaymentRow: async () => bundleRow,
      revokeAccesses: async () => 0,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AcademyInboxProcessingError);
    expect(academyInboxErrorDetails(error)).toEqual({
      code: 'invalid_preference',
      retryable: false,
      haltsBatch: false,
    });
  });

  it('una falla de credenciales pausa el lote sin agotar sus eventos', () => {
    expect(academyInboxErrorDetails(
      new AcademyInboxProcessingError('payment_http_401', true, true),
    )).toEqual({
      code: 'payment_http_401',
      retryable: true,
      haltsBatch: true,
    });
  });

  it('aplica backoff exponencial acotado para la reconciliación', () => {
    expect(academyInboxRetryDelaySeconds(1)).toBe(30);
    expect(academyInboxRetryDelaySeconds(2)).toBe(60);
    expect(academyInboxRetryDelaySeconds(8)).toBe(3_600);
    expect(academyInboxRetryDelaySeconds(99)).toBe(3_600);
  });
});

describe('entrega del webhook', () => {
  it('una notificación repetida conserva exactamente los mismos siete accesos', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, bundleRow);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    let allocations = 0;
    const deliveries = new Map<string, AcademyAccess[]>();
    const notification = vi.fn(async () => undefined);
    const email = vi.fn(async () => undefined);
    const dependencies = {
      assignAccesses: async (input: { paymentId: string; courseSlugs: readonly string[] }) => {
        const existing = deliveries.get(input.paymentId);
        if (existing) return existing;
        const created = input.courseSlugs.map((curso_slug, index) => ({
          curso_slug,
          codigo: `SAGA-${index + 1}`,
        }));
        allocations += created.length;
        deliveries.set(input.paymentId, created);
        return created;
      },
      sendAccessEmail: email,
      markNotified: notification,
    };

    const first = await fulfillAcademyPayment(validation.plan, dependencies);
    const repeated = await fulfillAcademyPayment(validation.plan, dependencies);

    expect(first).toHaveLength(7);
    expect(repeated).toEqual(first);
    expect(allocations).toBe(7);
    expect(new Set(first.map(({ curso_slug }) => curso_slug))).toEqual(new Set(SAGA_COURSE_SLUGS));
    expect(notification).toHaveBeenCalledTimes(2);
    expect(email).toHaveBeenCalledTimes(2);
    expect(email.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      `academia-pago-${paymentId}`,
      `academia-pago-${paymentId}`,
    ]);
  });

  it('no marca el pago ni envía correo si faltara uno de los siete accesos', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, bundleRow);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const markNotified = vi.fn(async () => undefined);
    const sendAccessEmail = vi.fn(async () => undefined);

    await expect(fulfillAcademyPayment(validation.plan, {
      assignAccesses: async ({ courseSlugs }) => courseSlugs.slice(0, 6).map((curso_slug, index) => ({
        curso_slug,
        codigo: `SAGA-${index + 1}`,
      })),
      sendAccessEmail,
      markNotified,
    })).rejects.toThrow('incomplete_access_delivery');

    expect(markNotified).not.toHaveBeenCalled();
    expect(sendAccessEmail).not.toHaveBeenCalled();
  });

  it('solo completa la entrega después de que el correo fue aceptado', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, bundleRow);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const order: string[] = [];
    const accesses = SAGA_COURSE_SLUGS.map((curso_slug, index) => ({
      curso_slug,
      codigo: `SAGA-${index + 1}`,
    }));

    await fulfillAcademyPayment(validation.plan, {
      assignAccesses: async () => {
        order.push('assign');
        return accesses;
      },
      sendAccessEmail: async () => { order.push('email'); },
      markNotified: async () => { order.push('mark-notified'); },
    });

    expect(order).toEqual(['assign', 'email', 'mark-notified']);
  });

  it('no marca la entrega como notificada si falla el correo', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, bundleRow);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const markNotified = vi.fn(async () => undefined);
    await expect(fulfillAcademyPayment(validation.plan, {
      assignAccesses: async ({ courseSlugs }) => courseSlugs.map((curso_slug, index) => ({
        curso_slug,
        codigo: `SAGA-${index + 1}`,
      })),
      sendAccessEmail: async () => { throw new Error('email_failed'); },
      markNotified,
    })).rejects.toThrow('email_failed');

    expect(markNotified).not.toHaveBeenCalled();
  });

  it('no reenvía si la entrega ya quedó notificada', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, {
      ...bundleRow,
      entrega_estado: 'notificada',
    });
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const sendAccessEmail = vi.fn(async () => undefined);
    const markNotified = vi.fn(async () => undefined);
    await fulfillAcademyPayment(validation.plan, {
      assignAccesses: async ({ courseSlugs }) => courseSlugs.map((curso_slug, index) => ({
        curso_slug,
        codigo: `SAGA-${index + 1}`,
      })),
      sendAccessEmail,
      markNotified,
    });

    expect(sendAccessEmail).not.toHaveBeenCalled();
    expect(markNotified).not.toHaveBeenCalled();
  });

  it('si una reversa gana el bloqueo, no envía ni completa la entrega', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, bundleRow);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    const sendAccessEmail = vi.fn(async () => undefined);
    const markNotified = vi.fn(async () => undefined);
    await expect(fulfillAcademyPayment(validation.plan, {
      assignAccesses: async () => {
        throw new Error('access_assignment_failed');
      },
      sendAccessEmail,
      markNotified,
    })).rejects.toThrow('access_assignment_failed');

    expect(sendAccessEmail).not.toHaveBeenCalled();
    expect(markNotified).not.toHaveBeenCalled();
  });

  it('una reversa intercalada nunca se rebaja a asignada ni notificada', async () => {
    const validation = validateAcademyPayment(approvedPayment, merchantOrder, bundleRow);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    let paymentState = 'aprobado';
    let deliveryState = 'asignada';
    const accesses = SAGA_COURSE_SLUGS.map((curso_slug, index) => ({
      curso_slug,
      codigo: `SAGA-${index + 1}`,
    }));

    await expect(fulfillAcademyPayment(validation.plan, {
      assignAccesses: async () => accesses,
      sendAccessEmail: async () => {
        // Simula el worker de reversa entrando después de asignar y antes de
        // marcar el correo como notificado.
        paymentState = 'charged_back';
        deliveryState = 'revocada';
      },
      markNotified: async () => {
        if (
          ACADEMY_TERMINAL_PAYMENT_FILTER.includes(paymentState) ||
          ACADEMY_PROTECTED_DELIVERY_FILTER.includes(deliveryState)
        ) throw new Error('payment_notification_state_failed');
        deliveryState = 'notificada';
      },
    })).rejects.toThrow('payment_notification_state_failed');

    const failurePatch = academyDeliveryFailurePatch(true, '2026-09-26T12:00:00.000Z');
    const canApplyFailurePatch =
      !ACADEMY_TERMINAL_PAYMENT_FILTER.includes(paymentState) &&
      !ACADEMY_PROTECTED_DELIVERY_FILTER.includes(deliveryState);
    if (canApplyFailurePatch) deliveryState = failurePatch.entrega_estado;

    expect(paymentState).toBe('charged_back');
    expect(deliveryState).toBe('revocada');
    expect(isAcademyTerminalPaymentState(paymentState)).toBe(true);
    expect(failurePatch).not.toHaveProperty('estado');
  });

  it('la asignación repetida no degrada una entrega ya notificada', async () => {
    const patch = academyDeliveryFailurePatch(true, '2026-09-26T12:00:00.000Z');
    const deliveryState = 'notificada';
    const canApply = !ACADEMY_PROTECTED_DELIVERY_FILTER.includes(deliveryState);

    expect(canApply).toBe(false);
    expect(patch.entrega_estado).toBe('asignada');
    expect(deliveryState).toBe('notificada');
  });

  it.each(['refunded', 'charged_back', 'cancelled'] as const)(
    'revoca los siete accesos ante %s',
    async (status) => {
      const revokeAccesses = vi.fn(async () => 7);
      const result = await revokeAcademyPayment(
        { ...approvedPayment, status },
        merchantOrder,
        { ...bundleRow, mp_payment_id: mercadoPagoPaymentId },
        { revokeAccesses },
      );

      expect(result).toEqual({ handled: true, revoked: 7 });
      expect(revokeAccesses).toHaveBeenCalledWith({
        paymentId,
        mercadoPagoPaymentId,
        status,
      });
    },
  );
});

describe('protección contra abuso', () => {
  it('genera una huella estable sin persistir la IP en claro', async () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.42',
      'user-agent': 'Vitest',
    });

    const first = await requestRateLimitHash(headers, 'pepper-secreto', 'crear_checkout');
    const repeated = await requestRateLimitHash(headers, 'pepper-secreto', 'crear_checkout');
    const otherAction = await requestRateLimitHash(headers, 'pepper-secreto', 'validar_codigo');
    const recovery = await requestRateLimitHash(headers, 'pepper-secreto', 'recuperar_acceso');
    const webhookNetworkOne = await requestRateLimitHash(
      headers,
      'pepper-secreto',
      'procesar_webhook_red',
    );
    const webhookNetworkAfterRotatingId = await requestRateLimitHash(
      headers,
      'pepper-secreto',
      'procesar_webhook_red',
    );
    const webhookIdOne = await requestRateLimitHash(
      headers,
      'pepper-secreto',
      'procesar_webhook_id',
      '1001',
    );
    const webhookIdTwo = await requestRateLimitHash(
      headers,
      'pepper-secreto',
      'procesar_webhook_id',
      '1002',
    );

    expect(requestNetworkIdentity(headers)).toBe('203.0.113.42');
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(repeated);
    expect(otherAction).not.toBe(first);
    expect(recovery).not.toBe(first);
    expect(webhookNetworkOne).toBe(webhookNetworkAfterRotatingId);
    expect(webhookIdOne).not.toBe(webhookIdTwo);
    expect(first).not.toContain('203.0.113.42');
  });

  it('agrupa intentos en ventanas deterministas', () => {
    expect(rateLimitWindowStart(new Date('2026-09-26T12:14:59.000Z'), 15 * 60 * 1_000))
      .toBe('2026-09-26T12:00:00.000Z');
  });

  it('bloquea durablemente al superar el límite de la misma clave y ventana', async () => {
    let attempts = 0;
    const execute = vi.fn(async () => {
      attempts += 1;
      return { data: attempts <= 5, error: null };
    });
    const input = {
      action: 'crear_checkout' as const,
      keyHash: 'a'.repeat(64),
      windowStart: '2026-09-26T12:00:00.000Z',
      limit: 5,
    };

    const results = await Promise.all(
      Array.from({ length: 6 }, () => consumeAcademyRateLimit(execute, input)),
    );

    expect(results).toEqual([true, true, true, true, true, false]);
    expect(execute).toHaveBeenCalledTimes(6);
    expect(execute).toHaveBeenLastCalledWith({
      p_accion: 'crear_checkout',
      p_clave_hash: 'a'.repeat(64),
      p_ventana_inicio: '2026-09-26T12:00:00.000Z',
      p_limite: 5,
    });
  });

  it('mantiene el límite global de red aunque el atacante rote payment ids', async () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.77' });
    const networkKey = await requestRateLimitHash(
      headers,
      'pepper-secreto',
      'procesar_webhook_red',
    );
    const counters = new Map<string, number>();
    const execute = async (args: {
      p_accion: string;
      p_clave_hash: string;
      p_ventana_inicio: string;
      p_limite: number;
    }) => {
      const key = `${args.p_accion}:${args.p_clave_hash}:${args.p_ventana_inicio}`;
      const attempts = (counters.get(key) || 0) + 1;
      counters.set(key, attempts);
      return { data: attempts <= args.p_limite, error: null };
    };
    const globalResults: boolean[] = [];
    const perIdResults: boolean[] = [];

    for (let index = 0; index < 61; index += 1) {
      const paymentKey = await requestRateLimitHash(
        headers,
        'pepper-secreto',
        'procesar_webhook_id',
        String(10_000 + index),
      );
      globalResults.push(await consumeAcademyRateLimit(execute, {
        action: 'procesar_webhook_red',
        keyHash: networkKey,
        windowStart: '2026-09-26T12:00:00.000Z',
        limit: 60,
      }));
      perIdResults.push(await consumeAcademyRateLimit(execute, {
        action: 'procesar_webhook_id',
        keyHash: paymentKey,
        windowStart: '2026-09-26T12:00:00.000Z',
        limit: 20,
      }));
    }

    expect(globalResults.slice(0, 60).every(Boolean)).toBe(true);
    expect(globalResults[60]).toBe(false);
    expect(perIdResults.every(Boolean)).toBe(true);
  });
});

describe('retorno desde Mercado Pago', () => {
  it('no afirma un pago solo por el query string manipulable', () => {
    const notice = getAcademyPaymentReturnNotice('ok');

    expect(notice?.tone).toBe('info');
    expect(notice?.message.toLowerCase()).toContain('verificando');
    expect(notice?.message.toLowerCase()).not.toContain('pago recibido');
    expect(notice?.message.toLowerCase()).not.toContain('pago confirmado');
  });
});

describe('recuperación segura', () => {
  it('nunca devuelve el código ni el contenido premium en la respuesta pública', () => {
    const response = safeRecoveryResponse();

    expect(response.ok).toBe(true);
    expect(Object.keys(response).sort()).toEqual(['message', 'ok']);
    expect(response).not.toHaveProperty('codigo');
    expect(response).not.toHaveProperty('modulos');
  });

  it('inyecta la planilla privada solo con una URL firmada HTTPS', () => {
    const premiumContent = [{
      bloques: [{ tipo: 'descarga', url: PRIVATE_PLANILLAS_PLACEHOLDER }],
    }];
    const signedUrl =
      'https://proyecto.supabase.co/storage/v1/object/sign/academia-premium/planillas-programa-pro.xlsx?token=firma';

    expect(containsPrivatePlanillasDownload(premiumContent)).toBe(true);
    const authorized = attachPrivatePlanillasUrl(premiumContent, signedUrl);
    expect(containsPrivatePlanillasDownload(authorized)).toBe(false);
    expect(authorized[0].bloques[0].url).toBe(signedUrl);
    expect(JSON.stringify(authorized)).not.toContain('/media/academia/');
    expect(() => attachPrivatePlanillasUrl(premiumContent, '/public/planilla.xlsx'))
      .toThrow('invalid_signed_url');
  });
});
