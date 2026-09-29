// Worker privado para reconciliar contracargos persistidos por el webhook.
// Está preparado para invocación periódica, pero esta migración no crea cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  classifyMercadoPagoHttpStatus,
  type AcademyPaymentRow,
  type VerifiedMercadoPagoMerchantOrder,
  type VerifiedMercadoPagoPayment,
} from '../mp-curso-webhook/logic.ts';
import {
  AcademyInboxProcessingError,
  academyInboxErrorDetails,
  processAcademyChargeback,
} from './logic.ts';

interface ClaimedInboxEvent {
  evento_id: number;
  payment_id: string;
  intentos: number;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  ));
}

async function secretMatches(provided: string, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    sha256(provided),
    sha256(expected),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

async function fetchMercadoPagoJson<T>(
  resource: 'payment' | 'merchant_order',
  id: string,
  token: string,
): Promise<T> {
  const path = resource === 'payment'
    ? `/v1/payments/${encodeURIComponent(id)}`
    : `/merchant_orders/${encodeURIComponent(id)}`;
  let response: Response;
  try {
    response = await fetch(`https://api.mercadopago.com${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AcademyInboxProcessingError(`${resource}_network_error`, true);
  }

  const disposition = classifyMercadoPagoHttpStatus(response.status);
  if (disposition === 'retry') {
    throw new AcademyInboxProcessingError(`${resource}_http_retry`, true);
  }
  if (disposition === 'configuration_error') {
    throw new AcademyInboxProcessingError(
      `${resource}_http_${response.status}`,
      true,
      true,
    );
  }
  if (disposition === 'definitive_error') {
    throw new AcademyInboxProcessingError(`${resource}_http_${response.status}`, false);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new AcademyInboxProcessingError(`${resource}_invalid_json`, true);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return new Response('unavailable', { status: 503 });
  const authorization = req.headers.get('authorization') || '';
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (
    !providedSecret ||
    !(await secretMatches(providedSecret, serviceRole))
  ) {
    return new Response('unauthorized', { status: 401 });
  }

  const db = createClient(supabaseUrl, serviceRole);

  let mercadoPagoToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
  if (!mercadoPagoToken) {
    const { data } = await db.from('app_secrets').select('value')
      .eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
    mercadoPagoToken = data?.value;
  }
  if (!mercadoPagoToken) return new Response('unavailable', { status: 503 });

  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const requestedLimit = Number((payload as Record<string, unknown>).limit ?? 10);
  const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 20
    ? requestedLimit
    : 10;

  const { data: claimed, error: claimError } = await db.rpc(
    'academia_reclamar_eventos_mp',
    { p_limite: limit },
  );
  if (claimError) return new Response('unavailable', { status: 503 });

  const claimedEvents = (claimed || []) as ClaimedInboxEvent[];
  const results = { claimed: 0, completed: 0, retried: 0, dead: 0 };
  for (const event of claimedEvents) {
    results.claimed += 1;
    try {
      await processAcademyChargeback(event.payment_id, {
        fetchPayment: (id) => fetchMercadoPagoJson<VerifiedMercadoPagoPayment>(
          'payment', id, mercadoPagoToken!,
        ),
        fetchMerchantOrder: (id) => fetchMercadoPagoJson<VerifiedMercadoPagoMerchantOrder>(
          'merchant_order', id, mercadoPagoToken!,
        ),
        findPaymentRow: async (reference) => {
          const { data, error } = await db.from('academia_pagos')
            .select('id, curso_slug, email, monto, mp_preference_id, mp_payment_id, estado, entrega_estado')
            .eq('id', reference)
            .maybeSingle();
          if (error) throw new AcademyInboxProcessingError('payment_read_failed', true);
          return data as AcademyPaymentRow | null;
        },
        revokeAccesses: async ({ paymentId, mercadoPagoPaymentId, status }) => {
          const { data, error } = await db.rpc('academia_revocar_accesos_pago', {
            p_pago_id: paymentId,
            p_mp_payment_id: mercadoPagoPaymentId,
            p_estado: status,
          });
          if (error) throw new AcademyInboxProcessingError('access_revocation_failed', true);
          return Number(data || 0);
        },
      });

      const { error } = await db.rpc('academia_finalizar_evento_mp', {
        p_evento_id: event.evento_id,
        p_exito: true,
        p_reintentar: false,
        p_error_code: null,
      });
      if (error) return new Response('unavailable', { status: 503 });
      results.completed += 1;
    } catch (error) {
      const details = academyInboxErrorDetails(error);
      const willRetry = details.haltsBatch || (details.retryable && event.intentos < 8);
      const { error: auditError } = await db.from('academia_eventos').upsert({
        clave_idempotencia: `mp-inbox:${event.evento_id}:${event.intentos}:${details.code}`,
        tipo: 'contracargo_reconciliacion_error',
        severidad: willRetry ? 'warning' : 'critical',
        detalle: {
          inbox_event_id: event.evento_id,
          payment_id: event.payment_id,
          intento: event.intentos,
          motivo: details.code,
          reintentar: willRetry,
        },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      if (auditError) return new Response('unavailable', { status: 503 });

      // Una credencial de Mercado Pago vencida o mal configurada es global, no
      // un defecto del evento. Libera todo el lote sin consumir sus intentos.
      if (details.haltsBatch) {
        const { error: releaseError } = await db.rpc('academia_pausar_eventos_mp', {
          p_eventos: claimedEvents.map(({ evento_id }) => evento_id),
          p_error_code: details.code,
        });
        if (releaseError) return new Response('unavailable', { status: 503 });
        return new Response('provider unavailable', { status: 503 });
      }

      const { error: finishError } = await db.rpc('academia_finalizar_evento_mp', {
        p_evento_id: event.evento_id,
        p_exito: false,
        p_reintentar: details.retryable,
        p_error_code: details.code,
      });
      if (finishError) return new Response('unavailable', { status: 503 });
      if (willRetry) results.retried += 1;
      else results.dead += 1;
    }
  }

  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
