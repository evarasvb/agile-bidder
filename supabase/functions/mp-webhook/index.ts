import { createClient } from 'jsr:@supabase/supabase-js@2';

// Webhook de Mercado Pago: al aprobarse un pago, asigna un código de acceso al
// correo del comprador.
//
// Para saber QUÉ curso entregar usa, en este orden:
//  1) external_reference del pago (si el link lo trae con el slug del curso).
//  2) el monto, SOLO para montos únicos (evita entregar el curso equivocado
//     cuando varios cursos cuestan lo mismo).
const CURSO_POR_MONTO: Record<number, string> = {
  5000: 'iniciar-en-mercado-publico',
};

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    let token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || '';
    if (!token) {
      const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
      token = sec?.value || '';
    }
    if (!token) return new Response('token no configurado', { status: 200 });

    const url = new URL(req.url);
    let paymentId = url.searchParams.get('id') || url.searchParams.get('data.id');
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    if (!paymentId) {
      try { const body = await req.json(); paymentId = body?.data?.id ? String(body.data.id) : null; } catch (_) { /* sin body */ }
    }
    if (topic && topic !== 'payment') return new Response('ignorado', { status: 200 });
    if (!paymentId) return new Response('sin id', { status: 200 });

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!mpRes.ok) return new Response('pago no encontrado', { status: 200 });
    const pago = await mpRes.json();
    if (pago.status !== 'approved') return new Response('pago no aprobado', { status: 200 });

    const monto = Math.round(Number(pago.transaction_amount || 0));
    const ref = String(pago.external_reference || '').trim();
    let cursoSlug = '';
    if (ref) {
      // Solo aceptamos la referencia si corresponde a un curso con códigos.
      const { data: existe } = await admin.from('academia_accesos').select('id').eq('curso_slug', ref).limit(1).maybeSingle();
      if (existe) cursoSlug = ref;
    }
    if (!cursoSlug) cursoSlug = CURSO_POR_MONTO[monto] || '';
    if (!cursoSlug) return new Response('curso no identificado (monto ambiguo, usar referencia)', { status: 200 });

    const email = (pago.payer?.email || '').toLowerCase();
    const mpPaymentId = String(pago.id);

    const { data: yaAsignado } = await admin.from('academia_accesos').select('id').eq('mp_payment_id', mpPaymentId).maybeSingle();
    if (yaAsignado) return new Response('ya procesado', { status: 200 });

    const { data: libre } = await admin.from('academia_accesos').select('id, codigo').eq('curso_slug', cursoSlug).eq('estado', 'disponible').limit(1).maybeSingle();
    if (!libre) return new Response('sin códigos disponibles', { status: 200 });

    await admin.from('academia_accesos').update({ estado: 'asignado', email, mp_payment_id: mpPaymentId, asignado_at: new Date().toISOString() }).eq('id', libre.id);
    return new Response(JSON.stringify({ ok: true, curso: cursoSlug }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (_e) {
    return new Response('error', { status: 200 });
  }
});
