// Crea una SUSCRIPCIÓN mensual (preapproval) en MercadoPago para el cliente FirmaVB ERP.
// La llama el frontend con el JWT del usuario logueado. Devuelve el init_point
// (URL de checkout de MercadoPago) al que se redirige al usuario.
//
// El token de MercadoPago se lee del secreto MERCADOPAGO_ACCESS_TOKEN y, si no
// está en el entorno, de la tabla app_secrets (mismo mecanismo que la webhook de
// Academia). Así reutiliza el token ya configurado en cualquiera de los dos
// lugares. NUNCA va escrito en el código.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const WEBHOOK_URL = 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/mp-suscripcion-webhook';
const MONTO_CLP = Number(Deno.env.get("FIRMAVB_ERP_CLP") ?? 159000);

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function getMpToken(admin: ReturnType<typeof createClient>): Promise<string> {
  let token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || '';
  if (!token) {
    const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
    token = (sec as { value?: string } | null)?.value || '';
  }
  return token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = await getMpToken(supabase);
    if (!token) {
      return json({ error: 'Falta MERCADOPAGO_ACCESS_TOKEN (ni en secretos ni en app_secrets).' }, 500);
    }

    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: userData, error: uerr } = await supabase.auth.getUser(jwt);
    if (uerr || !userData?.user) return json({ error: 'No autenticado' }, 401);
    const user = userData.user;

    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, email')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!cliente) return json({ error: 'Cliente no encontrado' }, 404);

    const body = await req.json().catch(() => ({}));
    const backUrl: string = body.back_url || 'https://firmavb.cl/cuenta/facturacion';
    const payerEmail: string = (cliente as { email?: string }).email || user.email || '';

    const resp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'FirmaVB ERP — Suscripción mensual',
        external_reference: (cliente as { id: string }).id,
        payer_email: payerEmail,
        notification_url: WEBHOOK_URL,
        back_url: backUrl,
        status: 'pending',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: MONTO_CLP,
          currency_id: 'CLP',
        },
      }),
    });
    const data = await resp.json();
    if (!resp.ok) return json({ error: 'MercadoPago rechazó la suscripción', details: data }, 502);

    await supabase.from('suscripciones').upsert({
      cliente_id: (cliente as { id: string }).id,
      mp_preapproval_id: data.id,
      estado: data.status,
      monto: MONTO_CLP,
      raw: data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mp_preapproval_id' });

    return json({ init_point: data.init_point, id: data.id });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
