// Webhook de Mercado Pago para compras de cursos (verify_jwt=false).
// Verifica el pago consultando la API de MP; si está aprobado, asigna un código
// de academia_accesos al email del comprador y se lo envía por correo (Resend).
// Molde: mp-pago-experto-webhook. Siempre responde 200 para que MP no reintente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';

// Título legible por slug (para el correo). Debe calzar con los slugs reales de
// los cursos y con crear-pago-curso. Fallback al slug si no está mapeado.
const TITULOS: Record<string, string> = {
  'programa-pro-adjudica-al-estado': 'Programa Pro: Estudia y Gana Licitaciones',
  'iniciar-en-mercado-publico': 'Inicia en Mercado Público (Express)',
  'saga-1-fundamentos': 'Saga 1 · Fundamentos del Sistema',
  'saga-2-oportunidades': 'Saga 2 · Oportunidades',
  'saga-3-ofertas': 'Saga 3 · Ofertas',
  'saga-4-ganar': 'Saga 4 · Ganar',
  'saga-5-ejecutar': 'Saga 5 · Ejecutar',
  'saga-6-escalar': 'Saga 6 · Escalar',
  'saga-7-automatizacion': 'Saga 7 · Automatización',
};

function emailHtml(titulo: string, codigo: string, slug: string) {
  const url = `https://firmavb.cl/academia/curso/${slug}`;
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#1E40AF;padding:22px 28px;color:#fff;font-size:20px;font-weight:700">FirmaVB · Academia</div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 10px">¡Gracias por tu compra! 🎉</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 6px">Ya tienes acceso a <strong>${titulo}</strong>.</p>
        <p style="color:#475569;line-height:1.6;margin:0 0 16px">Tu código de acceso es:</p>
        <div style="font-size:22px;font-weight:700;letter-spacing:1px;background:#eff6ff;border:1px dashed #1E40AF;border-radius:10px;padding:14px;text-align:center;color:#1E40AF">${codigo}</div>
        <p style="color:#475569;line-height:1.6;margin:16px 0 22px">Entra al curso y pega tu código (o usa el mismo correo de tu compra en "¿Ya lo compraste?").</p>
        <a href="${url}" style="display:inline-block;background:#1E40AF;color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">Abrir el curso</a>
      </div>
    </div>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const db = createClient(url, service);

    let mpToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    if (!mpToken) {
      const { data } = await db.from('app_secrets').select('value').eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
      mpToken = data?.value;
    }

    // MP notifica por body {type,data.id} y/o query (?topic=payment&id=...).
    const q = new URL(req.url).searchParams;
    const body = await req.json().catch(() => ({} as any));
    const tipo = body.type || body.topic || q.get('type') || q.get('topic');
    const paymentId = body?.data?.id || q.get('data.id') || q.get('id');
    if (tipo && tipo !== 'payment') return new Response('ok', { status: 200 });
    if (!paymentId || !mpToken) return new Response('ok', { status: 200 });

    // Verificación real: consultamos el pago a MP con nuestro token.
    const pr = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${mpToken}` } });
    if (!pr.ok) return new Response('ok', { status: 200 });
    const pay = await pr.json();
    const pagoId = pay.external_reference;
    if (!pagoId) return new Response('ok', { status: 200 });

    const { data: pagoRow } = await db.from('academia_pagos').select('*').eq('id', pagoId).maybeSingle();
    if (!pagoRow) return new Response('ok', { status: 200 });

    const buyerEmail = (pay.payer?.email || pagoRow.email || '').toLowerCase() || null;
    await db.from('academia_pagos').update({
      estado: pay.status === 'approved' ? (pagoRow.codigo_entregado ? 'aprobado' : pagoRow.estado) : pay.status,
      mp_payment_id: String(paymentId), email: buyerEmail, raw: pay, updated_at: new Date().toISOString(),
    }).eq('id', pagoId);

    // Solo asignar una vez (idempotente): aprobado y sin código entregado aún.
    if (pay.status === 'approved' && !pagoRow.codigo_entregado) {
      const slug = pagoRow.curso_slug;
      const { data: libre } = await db.from('academia_accesos')
        .select('id, codigo').eq('curso_slug', slug).eq('estado', 'disponible').is('email', null)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();

      if (libre?.codigo) {
        // Reservamos el código para este comprador (guard: solo si sigue libre).
        const { data: reservado } = await db.from('academia_accesos')
          .update({ email: buyerEmail, mp_payment_id: String(paymentId), asignado_at: new Date().toISOString() })
          .eq('id', libre.id).is('email', null).select('codigo').maybeSingle();
        const codigo = reservado?.codigo || libre.codigo;
        await db.from('academia_pagos').update({ codigo_entregado: codigo, estado: 'aprobado', updated_at: new Date().toISOString() }).eq('id', pagoId);

        if (resendKey && buyerEmail) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, to: [buyerEmail], subject: 'Tu acceso al curso — FirmaVB Academia', html: emailHtml(TITULOS[slug] || slug, codigo, slug) }),
          }).catch(() => {});
        }
      } else {
        // Se agotaron los códigos de ese curso: avisamos para generar más.
        await db.from('academia_pagos').update({ estado: 'aprobado_sin_codigo', updated_at: new Date().toISOString() }).eq('id', pagoId);
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: FROM, to: ['contacto@firmavb.cl'], subject: `⚠️ Sin códigos para ${slug}`, html: `<p>Pago aprobado de <strong>${buyerEmail || 's/email'}</strong> para <strong>${slug}</strong> pero no quedan códigos 'disponible'. Genera más en academia_accesos y entrégaselo.</p>` }),
          }).catch(() => {});
        }
      }
    }

    return new Response('ok', { status: 200 });
  } catch {
    // Nunca fallamos ante MP: respondemos 200 para que no reintente en loop.
    return new Response('ok', { status: 200 });
  }
});
