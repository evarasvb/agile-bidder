// Checkout público de Academia. Precio, referencia y destinos se
// determinan en servidor; nunca se confía en montos o URLs del navegador.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  buildAcademyPreference,
  normalizeAcademyOrigin,
  resolveAcademyProduct,
} from './logic.ts';
import {
  academyMaintenanceEnabled,
  consumeAcademyRateLimit,
  rateLimitWindowStart,
  requestRateLimitHash,
} from '../_shared/academia-security.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  if (academyMaintenanceEnabled(Deno.env.get('ACADEMIA_CHECKOUT_MAINTENANCE'))) {
    return new Response(JSON.stringify({
      error: 'Las compras están en mantenimiento. Intenta nuevamente en unos minutos.',
    }), {
      status: 503,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Retry-After': '300',
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRole) return json({ error: 'Servicio no disponible.' }, 503);

    const db = createClient(supabaseUrl, serviceRole);
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const product = resolveAcademyProduct(body.slug);
    if (!product) return json({ error: 'Curso no disponible para compra.' }, 400);

    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return json({ error: 'Correo no válido.' }, 400);
    }
    const backOrigin = normalizeAcademyOrigin(body.back_url);

    const rateKey = await requestRateLimitHash(req.headers, serviceRole, 'crear_checkout');
    const allowed = await consumeAcademyRateLimit(
      (args) => db.rpc('academia_consumir_rate_limit', args),
      {
        action: 'crear_checkout',
        keyHash: rateKey,
        windowStart: rateLimitWindowStart(new Date(), 10 * 60 * 1_000),
        limit: 5,
      },
    ).catch(() => null);
    if (allowed === null) return json({ error: 'Servicio no disponible.' }, 503);
    if (!allowed) return json({ error: 'Demasiados intentos. Espera unos minutos.' }, 429);

    let mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      const { data } = await db.from('app_secrets').select('value')
        .eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
      mpToken = data?.value;
    }
    if (!mpToken) return json({ error: 'Mercado Pago no está configurado.' }, 503);

    const { data: payment, error: paymentError } = await db.from('academia_pagos')
      .insert({
        curso_slug: product.slug,
        email,
        monto: product.amount,
        estado: 'iniciando',
      })
      .select('id')
      .single();
    if (paymentError || !payment) return json({ error: 'No se pudo iniciar el pago.' }, 500);

    const preference = buildAcademyPreference({
      paymentId: payment.id,
      product,
      supabaseUrl,
      backOrigin,
      email,
    });

    const mercadoPagoResponse = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': String(payment.id),
        },
        body: JSON.stringify(preference),
      },
    );
    const responseBody = await mercadoPagoResponse.json().catch(() => ({})) as Record<string, unknown>;
    const preferenceId = typeof responseBody.id === 'string' ? responseBody.id : null;
    const checkoutUrl = typeof responseBody.init_point === 'string' ? responseBody.init_point : null;
    if (!mercadoPagoResponse.ok || !preferenceId || !checkoutUrl) {
      await db.from('academia_pagos').update({
        estado: 'error_preferencia',
        raw: responseBody,
        updated_at: new Date().toISOString(),
      }).eq('id', payment.id);
      await db.from('academia_eventos').upsert({
        pago_id: payment.id,
        clave_idempotencia: `preferencia-error:${payment.id}`,
        tipo: 'preferencia_mp_error',
        severidad: 'error',
        detalle: { status_http: mercadoPagoResponse.status },
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      return json({ error: 'Mercado Pago rechazó la preferencia.' }, 502);
    }

    const { data: persisted, error: persistError } = await db.from('academia_pagos')
      .update({
        mp_preference_id: preferenceId,
        estado: 'pendiente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .eq('estado', 'iniciando')
      .select('id, mp_preference_id')
      .maybeSingle();

    let persistedPreferenceId = persisted?.mp_preference_id || null;
    if (persistError || persistedPreferenceId !== preferenceId) {
      const { data: readBack, error: readBackError } = await db.from('academia_pagos')
        .select('mp_preference_id')
        .eq('id', payment.id)
        .maybeSingle();
      if (!readBackError) persistedPreferenceId = readBack?.mp_preference_id || null;
    }

    if (persistedPreferenceId !== preferenceId) {
      await db.from('academia_eventos').upsert({
        pago_id: payment.id,
        clave_idempotencia: `preferencia-no-persistida:${payment.id}`,
        tipo: 'preferencia_mp_no_persistida',
        severidad: 'critical',
        detalle: {},
      }, { onConflict: 'clave_idempotencia', ignoreDuplicates: true });
      return json({ error: 'No pudimos confirmar el inicio del pago. Intenta nuevamente.' }, 503);
    }

    return json({
      ok: true,
      pago_id: payment.id,
      url: checkoutUrl,
      monto: product.amount,
    });
  } catch {
    return json({ error: 'No se pudo iniciar el pago.' }, 500);
  }
});
