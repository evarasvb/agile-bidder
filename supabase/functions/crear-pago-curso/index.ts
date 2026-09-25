// Crea una preferencia de Mercado Pago (Checkout Pro) para comprar un curso de
// la Academia. Pública: la Academia es pública y el comprador puede no tener
// cuenta. El precio se define en el servidor (no lo manda el cliente).
// Molde: crear-pago-experto. El webhook mp-curso-webhook confirma el pago.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

// Precio (CLP entero) por curso, autoritativo en el servidor.
const PRECIOS: Record<string, { titulo: string; monto: number }> = {
  'programa-pro-adjudica-al-estado': { titulo: 'Programa Pro: Estudia y Gana Licitaciones', monto: 45000 },
  'iniciar-en-mercado-publico': { titulo: 'Inicia en Mercado Público (Express)', monto: 5000 },
  'saga-1-fundamentos': { titulo: 'Saga 1 · Fundamentos del Sistema', monto: 45000 },
  'saga-2-oportunidades': { titulo: 'Saga 2 · Oportunidades', monto: 45000 },
  'saga-3-ofertas': { titulo: 'Saga 3 · Ofertas', monto: 45000 },
  'saga-4-ganar': { titulo: 'Saga 4 · Ganar', monto: 45000 },
  'saga-5-ejecutar': { titulo: 'Saga 5 · Ejecutar', monto: 45000 },
  'saga-6-escalar': { titulo: 'Saga 6 · Escalar', monto: 45000 },
  'saga-7-automatizacion': { titulo: 'Saga 7 · Automatización', monto: 45000 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug || '').trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const backUrl = String(body.back_url || '').replace(/\/$/, '') || 'https://firmavb.cl';

    const curso = PRECIOS[slug];
    if (!curso) return json({ error: 'Curso no disponible para compra.' }, 400);

    // Token de Mercado Pago: env o tabla app_secrets (mismo patrón del repo).
    let mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      const { data } = await db.from('app_secrets').select('value').eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
      mpToken = data?.value;
    }
    if (!mpToken) return json({ error: 'Mercado Pago no está configurado.' }, 500);

    // Registro del pago (pendiente) → su id es el external_reference.
    const { data: pago, error: pagoErr } = await db.from('academia_pagos')
      .insert({ curso_slug: slug, email, monto: curso.monto, estado: 'pendiente' })
      .select('id').single();
    if (pagoErr || !pago) return json({ error: 'No se pudo iniciar el pago.' }, 500);

    const base = `${backUrl}/academia/curso/${slug}`;
    const pref: Record<string, unknown> = {
      items: [{ id: slug, title: curso.titulo, quantity: 1, unit_price: curso.monto, currency_id: 'CLP' }],
      external_reference: pago.id,
      metadata: { pago_id: pago.id, slug },
      notification_url: `${url}/functions/v1/mp-curso-webhook`,
      back_urls: { success: `${base}?pago=ok`, pending: `${base}?pago=pendiente`, failure: `${base}?pago=error` },
      auto_return: 'approved',
      statement_descriptor: 'FIRMAVB ACADEMIA',
    };
    if (email) pref.payer = { email };

    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mpToken}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': String(pago.id) },
      body: JSON.stringify(pref),
    });
    const d = await r.json();
    if (!r.ok || !d.init_point) {
      await db.from('academia_pagos').update({ estado: 'error', raw: d, updated_at: new Date().toISOString() }).eq('id', pago.id);
      return json({ error: 'Mercado Pago rechazó la preferencia.', detalle: (typeof d?.message === 'string' ? d.message : '').slice(0, 160) }, 502);
    }
    await db.from('academia_pagos').update({ mp_preference_id: d.id, updated_at: new Date().toISOString() }).eq('id', pago.id);

    return json({ ok: true, pago_id: pago.id, url: d.init_point, monto: curso.monto });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
