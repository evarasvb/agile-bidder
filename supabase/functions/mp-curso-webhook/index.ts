// Webhook público de Mercado Pago. Cada evento se verifica consultando la API
// de MP y se vincula fail-closed a la referencia y preferencia persistidas.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ACADEMY_PROTECTED_DELIVERY_FILTER,
  ACADEMY_TERMINAL_PAYMENT_FILTER,
  academyDeliveryFailurePatch,
  authorizeMercadoPagoChargeback,
  buildAcademyChargebackInboxRow,
  classifyMercadoPagoHttpStatus,
  fulfillAcademyPayment,
  isAcademyReversalStatus,
  isAcademyTerminalPaymentState,
  parseMercadoPagoWebhookEvent,
  revokeAcademyPayment,
  validateAcademyPayment,
  validateAcademyPaymentIdentity,
  type AcademyAccess,
  type AcademyPaymentRow,
  type VerifiedMercadoPagoMerchantOrder,
  type VerifiedMercadoPagoPayment,
} from './logic.ts';
import type { AcademyProduct } from '../_shared/academia-products.ts';
import {
  academyMaintenanceEnabled,
  consumeAcademyRateLimit,
  rateLimitWindowStart,
  requestRateLimitHash,
} from '../_shared/academia-security.ts';

const FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';
const PAYMENT_ID_PATTERN = /^\d{1,32}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function accessEmailHtml(product: AcademyProduct, accesses: AcademyAccess[]) {
  const accessBlocks = accesses.map(({ curso_slug, codigo }) => {
    const courseUrl = `https://www.firmavb.cl/academia/curso/${encodeURIComponent(curso_slug)}`;
    return `<div style="margin:0 0 18px;padding:16px;border:1px solid #dbeafe;border-radius:12px">
      <p style="margin:0 0 8px;font-weight:700;color:#1e3a8a">${escapeHtml(curso_slug)}</p>
      <div style="font-size:20px;font-weight:700;letter-spacing:1px;background:#eff6ff;border:1px dashed #1E40AF;border-radius:10px;padding:12px;text-align:center;color:#1E40AF">${escapeHtml(codigo)}</div>
      <p style="margin:12px 0 0"><a href="${courseUrl}" style="color:#1E40AF;font-weight:600">Abrir este curso</a></p>
    </div>`;
  }).join('');

  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#1E40AF;padding:22px 28px;color:#fff;font-size:20px;font-weight:700">FirmaVB · Academia</div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 10px">¡Gracias por tu compra! 🎉</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 18px">Ya tienes acceso a <strong>${escapeHtml(product.title)}</strong>. Guarda estos códigos: son personales.</p>
        ${accessBlocks}
        <p style="color:#64748b;font-size:13px;line-height:1.5;margin:18px 0 0">Si vuelves más adelante, puedes pedir que reenviemos el código al mismo correo usado en la compra.</p>
      </div>
    </div>
  </div></body></html>`;
}

async function sendResendEmail(
  resendKey: string,
  input: { to: string[]; subject: string; html: string; idempotencyKey: string },
) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({ from: FROM, to: input.to, subject: input.subject, html: input.html }),
  });
  if (!response.ok) throw new Error('email_delivery_failed');
}

Deno.serve(async (req) => {
  let trackedPaymentId: string | null = null;
  try {
    if (req.method !== 'POST') {
      return new Response('method not allowed', {
        status: 405,
        headers: { Allow: 'POST' },
      });
    }
    // Durante el corte de una migración se responde 503 para que Mercado Pago
    // reintente el aviso una vez que la entrega nueva esté completamente activa.
    if (academyMaintenanceEnabled(Deno.env.get('ACADEMIA_WEBHOOK_MAINTENANCE'))) {
      return new Response('maintenance', {
        status: 503,
        headers: { 'Retry-After': '300' },
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceRole) return new Response('error', { status: 503 });

    const db = createClient(supabaseUrl, serviceRole);
    const query = new URL(req.url).searchParams;
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const event = parseMercadoPagoWebhookEvent(body, query);
    if (!event || !PAYMENT_ID_PATTERN.test(event.paymentId)) {
      return new Response('ok', { status: 200 });
    }
    const paymentId = event.paymentId;
    if (event.kind === 'chargeback') {
      const authorization = await authorizeMercadoPagoChargeback({
        xSignature: req.headers.get('x-signature'),
        xRequestId: req.headers.get('x-request-id'),
        dataId: query.get('data.id'),
        secret: Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET'),
      });
      if (authorization === 'configuration_error') {
        return new Response('error', { status: 503 });
      }
      if (authorization !== 'authorized') {
        return new Response('unauthorized', { status: 401 });
      }
      if (!event.providerEventId || !event.providerResourceId) {
        return new Response('invalid event', { status: 400 });
      }
    }

    const rateWindow = rateLimitWindowStart(new Date(), 10 * 60 * 1_000);
    const [networkRateKey, paymentRateKey] = await Promise.all([
      requestRateLimitHash(req.headers, serviceRole, 'procesar_webhook_red'),
      requestRateLimitHash(req.headers, serviceRole, 'procesar_webhook_id', paymentId),
    ]);
    const rateResults = await Promise.all([
      consumeAcademyRateLimit(
        (args) => db.rpc('academia_consumir_rate_limit', args),
        {
          action: 'procesar_webhook_red',
          keyHash: networkRateKey,
          windowStart: rateWindow,
          limit: 60,
        },
      ),
      consumeAcademyRateLimit(
        (args) => db.rpc('academia_consumir_rate_limit', args),
        {
          action: 'procesar_webhook_id',
          keyHash: paymentRateKey,
          windowStart: rateWindow,
          limit: 20,
        },
      ),
    ]).catch(() => null);
    if (!rateResults) return new Response('error', { status: 503 });
    if (rateResults.some((result) => !result)) {
      return new Response('rate limited', { status: 429 });
    }

    // La cola solo recibe contracargos firmados. Una repetición del mismo id
    // de notificación confirma 200 sin crear una segunda fila.
    if (event.kind === 'chargeback') {
      const { error } = await db.from('academia_mp_inbox').upsert(
        buildAcademyChargebackInboxRow(event),
        { onConflict: 'event_key', ignoreDuplicates: true },
      );
      return new Response(error ? 'error' : 'ok', { status: error ? 503 : 200 });
    }

    let mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      const { data } = await db.from('app_secrets').select('value')
        .eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
      mpToken = data?.value;
    }
    if (!mpToken) return new Response('error', { status: 503 });

    const mercadoPagoResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
      { headers: { Authorization: `Bearer ${mpToken}` } },
    );
    const paymentDisposition = classifyMercadoPagoHttpStatus(mercadoPagoResponse.status);
    if (paymentDisposition === 'retry') return new Response('error', { status: 503 });
    if (paymentDisposition === 'configuration_error') {
      return new Response('error', { status: 503 });
    }
    if (paymentDisposition === 'definitive_error') {
      const { error } = await db.from('academia_eventos').upsert({
        clave_idempotencia: `mp-http:payment:${paymentId}:${mercadoPagoResponse.status}`,
        tipo: 'mercadopago_http_definitivo',
        severidad: 'error',
        detalle: {
          recurso: 'payment',
          payment_id: paymentId,
          status_http: mercadoPagoResponse.status,
        },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      return new Response(error ? 'error' : 'ok', { status: error ? 503 : 200 });
    }

    const payment = await mercadoPagoResponse.json() as VerifiedMercadoPagoPayment;
    const orderId = String(payment.order?.id ?? '');
    if (!PAYMENT_ID_PATTERN.test(orderId)) {
      const { error } = await db.from('academia_eventos').upsert({
        clave_idempotencia: `mp-payment-sin-order:${paymentId}`,
        tipo: 'mercadopago_payment_sin_order',
        severidad: 'critical',
        detalle: { payment_id: paymentId },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      return new Response(error ? 'error' : 'ok', { status: error ? 503 : 200 });
    }

    const merchantOrderResponse = await fetch(
      `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(orderId)}`,
      { headers: { Authorization: `Bearer ${mpToken}` } },
    );
    const orderDisposition = classifyMercadoPagoHttpStatus(merchantOrderResponse.status);
    if (orderDisposition === 'retry') return new Response('error', { status: 503 });
    if (orderDisposition === 'configuration_error') {
      return new Response('error', { status: 503 });
    }
    if (orderDisposition === 'definitive_error') {
      const { error } = await db.from('academia_eventos').upsert({
        clave_idempotencia: `mp-http:merchant-order:${orderId}:${merchantOrderResponse.status}`,
        tipo: 'mercadopago_http_definitivo',
        severidad: 'error',
        detalle: {
          recurso: 'merchant_order',
          order_id: orderId,
          payment_id: paymentId,
          status_http: merchantOrderResponse.status,
        },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      return new Response(error ? 'error' : 'ok', { status: error ? 503 : 200 });
    }
    const merchantOrder = await merchantOrderResponse.json() as VerifiedMercadoPagoMerchantOrder;

    const paymentReference = String(merchantOrder.external_reference || '');
    if (!UUID_PATTERN.test(paymentReference)) return new Response('ok', { status: 200 });
    trackedPaymentId = paymentReference;

    const { data: paymentRow, error: paymentReadError } = await db
      .from('academia_pagos')
      .select('id, curso_slug, email, monto, mp_preference_id, mp_payment_id, estado, entrega_estado')
      .eq('id', paymentReference)
      .maybeSingle();
    if (paymentReadError) throw new Error('payment_read_failed');
    if (!paymentRow) return new Response('ok', { status: 200 });

    const row = paymentRow as AcademyPaymentRow;
    const identity = validateAcademyPaymentIdentity(payment, merchantOrder, row);
    if (!identity.ok) {
      await db.from('academia_eventos').upsert({
        pago_id: paymentReference,
        clave_idempotencia: `webhook-rechazado:${paymentReference}:${paymentId}:${identity.code}`,
        tipo: 'webhook_rechazado',
        severidad: 'critical',
        detalle: { motivo: identity.code, estado_mp: payment.status },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });

      if (resendKey) {
        await sendResendEmail(resendKey, {
          to: ['contacto@firmavb.cl'],
          subject: `⚠️ Webhook de Academia rechazado: ${identity.code}`,
          html: `<p>Un evento de Mercado Pago no coincidió con la referencia persistida: ${escapeHtml(identity.code)}.</p>`,
          idempotencyKey: `academia-webhook-rechazado-${paymentReference}-${paymentId}-${identity.code}`,
        }).catch(() => undefined);
      }
      return new Response('ok', { status: 200 });
    }

    // Una notificación atrasada de aprobación no puede reabrir una compra que
    // ya fue revertida. La identidad ya se verificó, por lo que se confirma sin
    // tocar estado ni volver a entregar accesos.
    if (
      !isAcademyReversalStatus(payment.status) &&
      (
        isAcademyTerminalPaymentState(row.estado) ||
        row.entrega_estado === 'revocada'
      )
    ) {
      return new Response('ok', { status: 200 });
    }

    const buyerEmail = String(payment.payer?.email || paymentRow.email || '').trim().toLowerCase() || null;
    const observation: Record<string, unknown> = {
      email: buyerEmail,
      raw: payment,
      updated_at: new Date().toISOString(),
    };
    if (payment.status !== 'approved' && !isAcademyReversalStatus(payment.status)) {
      observation.estado = payment.status;
    }
    const { error: observationError } = await db.from('academia_pagos')
      .update(observation)
      .eq('id', paymentReference)
      .not('estado', 'in', ACADEMY_TERMINAL_PAYMENT_FILTER)
      .neq('entrega_estado', 'revocada');
    if (observationError) throw new Error('payment_update_failed');

    if (isAcademyReversalStatus(payment.status)) {
      await revokeAcademyPayment(payment, merchantOrder, row, {
        revokeAccesses: async ({ paymentId: pagoId, mercadoPagoPaymentId, status }) => {
          const { data, error } = await db.rpc('academia_revocar_accesos_pago', {
            p_pago_id: pagoId,
            p_mp_payment_id: mercadoPagoPaymentId,
            p_estado: status,
          });
          if (error) throw new Error('access_revocation_failed');
          return Number(data || 0);
        },
      });

      if (resendKey) {
        await sendResendEmail(resendKey, {
          to: ['contacto@firmavb.cl'],
          subject: `Academia: accesos revocados por ${payment.status}`,
          html: `<p>Se procesó una reversa verificada y se revocaron sus accesos vinculados.</p>`,
          idempotencyKey: `academia-reversa-${paymentReference}-${paymentId}-${payment.status}`,
        }).catch(() => undefined);
      }
      return new Response('ok', { status: 200 });
    }

    if (payment.status !== 'approved') return new Response('ok', { status: 200 });

    const validation = validateAcademyPayment(payment, merchantOrder, row);
    if (!validation.ok) {
      await db.from('academia_pagos').update({
        estado: validation.code === 'missing_email' ? 'aprobado_sin_email' : 'pago_invalido',
        entrega_estado: 'error',
        updated_at: new Date().toISOString(),
      })
        .eq('id', paymentReference)
        .not('estado', 'in', ACADEMY_TERMINAL_PAYMENT_FILTER)
        .not('entrega_estado', 'in', ACADEMY_PROTECTED_DELIVERY_FILTER);
      await db.from('academia_eventos').upsert({
        pago_id: paymentReference,
        clave_idempotencia: `entrega-rechazada:${paymentReference}:${paymentId}:${validation.code}`,
        tipo: 'entrega_rechazada',
        severidad: 'critical',
        detalle: { motivo: validation.code },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      return new Response('ok', { status: 200 });
    }

    const fulfillment = {
      stage: 'assignment' as 'assignment' | 'notification' | 'mark_notified',
      assignmentCommitted: false,
    };
    try {
      await fulfillAcademyPayment(validation.plan, {
        assignAccesses: async ({ paymentId: pagoId, mercadoPagoPaymentId, buyerEmail: email, courseSlugs }) => {
          fulfillment.stage = 'assignment';
          const { data, error } = await db.rpc('academia_asignar_accesos_pago', {
            p_pago_id: pagoId,
            p_email: email,
            p_mp_payment_id: mercadoPagoPaymentId,
            p_cursos: [...courseSlugs],
          });
          if (error) throw new Error('access_assignment_failed');
          fulfillment.assignmentCommitted = true;
          return (data || []) as AcademyAccess[];
        },
        sendAccessEmail: async ({ buyerEmail: email, product, accesses, idempotencyKey }) => {
          fulfillment.stage = 'notification';
          if (!resendKey) throw new Error('email_not_configured');
          await sendResendEmail(resendKey, {
            to: [email],
            subject: accesses.length === 1
              ? 'Tu acceso al curso — FirmaVB Academia'
              : 'Tus 7 accesos — Saga FirmaVB Academia',
            html: accessEmailHtml(product, accesses),
            idempotencyKey,
          });
        },
        markNotified: async ({ paymentId: pagoId, mercadoPagoPaymentId }) => {
          fulfillment.stage = 'mark_notified';
          const now = new Date().toISOString();
          const { data, error } = await db.from('academia_pagos').update({
            entrega_estado: 'notificada',
            notificado_at: now,
            entrega_completada_at: now,
            updated_at: now,
          })
            .eq('id', pagoId)
            .eq('mp_payment_id', mercadoPagoPaymentId)
            .eq('entrega_estado', 'asignada')
            .not('estado', 'in', ACADEMY_TERMINAL_PAYMENT_FILTER)
            .select('id')
            .maybeSingle();
          if (error || !data) throw new Error('payment_notification_state_failed');
        },
      });
    } catch {
      const accessWasAssigned = fulfillment.assignmentCommitted;
      await db.from('academia_pagos').update(
        academyDeliveryFailurePatch(accessWasAssigned, new Date().toISOString()),
      )
        .eq('id', paymentReference)
        .not('estado', 'in', ACADEMY_TERMINAL_PAYMENT_FILTER)
        .not('entrega_estado', 'in', ACADEMY_PROTECTED_DELIVERY_FILTER);
      await db.from('academia_eventos').upsert({
        pago_id: paymentReference,
        clave_idempotencia: `entrega-error:${paymentReference}:${paymentId}:${fulfillment.stage}`,
        tipo: accessWasAssigned ? 'notificacion_accesos_error' : 'asignacion_accesos_error',
        severidad: 'critical',
        detalle: { etapa: fulfillment.stage, producto_slug: paymentRow.curso_slug },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });

      if (resendKey) {
        await sendResendEmail(resendKey, {
          to: ['contacto@firmavb.cl'],
          subject: `⚠️ Entrega de Academia pendiente: ${fulfillment.stage}`,
          html: `<p>Un pago aprobado requiere intervención en la etapa ${escapeHtml(fulfillment.stage)}.</p>`,
          idempotencyKey: `academia-entrega-error-${paymentReference}-${paymentId}-${fulfillment.stage}`,
        }).catch(() => undefined);
      }
      return new Response('error', { status: 503 });
    }

    return new Response('ok', { status: 200 });
  } catch {
    if (trackedPaymentId) console.error(`academy_payment_retry_required:${trackedPaymentId}`);
    return new Response('error', { status: 503 });
  }
});
