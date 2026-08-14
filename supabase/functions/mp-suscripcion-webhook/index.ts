// Webhook de MercadoPago para suscripciones (preapproval). MercadoPago lo llama
// cuando cambia el estado de una suscripción. Consulta el estado real en la API y
// activa/desactiva el Pro del cliente en consecuencia.
//
// verify_jwt = false (lo llama MercadoPago, no un usuario). Siempre responde 200
// para que MercadoPago no reintente en bucle.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  try {
    const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const url = new URL(req.url);
    let type = url.searchParams.get('type') || url.searchParams.get('topic') || '';
    let id = url.searchParams.get('data.id') || url.searchParams.get('id') || '';
    if (!id) {
      const body = await req.json().catch(() => ({} as any));
      type = body.type || body.topic || type;
      id = body?.data?.id || body?.id || id;
    }
    if (!id || !token) return ok();

    // Sólo suscripciones (preapproval). Ignoramos otros topics (payment, etc.).
    if (type && !`${type}`.includes('preapproval') && !`${type}`.includes('subscription')) {
      return ok();
    }

    const resp = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return ok();
    const data = await resp.json();

    const clienteId: string | null = data.external_reference ?? null;
    const estado: string = data.status ?? '';

    await supabase.from('suscripciones').upsert({
      cliente_id: clienteId,
      mp_preapproval_id: String(id),
      estado,
      monto: data?.auto_recurring?.transaction_amount ?? null,
      proximo_cobro: data?.next_payment_date ?? null,
      raw: data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mp_preapproval_id' });

    // Sólo cambiamos el plan en estados definitivos (evita bajar a free durante
    // "pending").
    let nuevoPlan: string | null = null;
    if (estado === 'authorized') nuevoPlan = 'pro';
    else if (estado === 'cancelled' || estado === 'paused') nuevoPlan = 'free';

    if (clienteId && nuevoPlan) {
      await supabase.from('clientes').update({ plan: nuevoPlan }).eq('id', clienteId);
    }

    return ok();
  } catch (_e) {
    return ok();
  }
});
