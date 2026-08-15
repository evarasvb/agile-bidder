// Webhook de MercadoPago para SUSCRIPCIONES (preapproval). MP la llama cuando
// cambia el estado de la suscripción; consultamos el estado real y activamos
// (authorized -> plan pro) o desactivamos (cancelled/paused -> free) al cliente.
//
// El token se lee del secreto MERCADOPAGO_ACCESS_TOKEN o, si no está, de la tabla
// app_secrets (mismo mecanismo que la webhook de Academia).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function getMpToken(admin: ReturnType<typeof createClient>): Promise<string> {
  let token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || '';
  if (!token) {
    const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
    token = (sec as { value?: string } | null)?.value || '';
  }
  return token;
}

Deno.serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const token = await getMpToken(supabase);

    const url = new URL(req.url);
    let type = url.searchParams.get('type') || url.searchParams.get('topic') || '';
    let id = url.searchParams.get('data.id') || url.searchParams.get('id') || '';
    if (!id) {
      const body = await req.json().catch(() => ({} as any));
      type = body.type || body.topic || type;
      id = body?.data?.id || body?.id || id;
    }
    if (!id || !token) return ok();

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
