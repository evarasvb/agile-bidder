import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Validador SEGURO del token de Mercado Pago: NO crea preapprovals ni cobra nada.
// Solo consulta /users/me para confirmar que el token autentica, y devuelve
// metadatos (site, nickname, live_mode). NUNCA devuelve el token.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

async function getMpToken(admin: ReturnType<typeof createClient>): Promise<string> {
  let token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || '';
  let fuente = token ? 'env' : '';
  if (!token) {
    const { data: sec } = await admin.from('app_secrets').select('value').eq('key', 'MERCADOPAGO_ACCESS_TOKEN').maybeSingle();
    token = (sec as { value?: string } | null)?.value || '';
    if (token) fuente = 'app_secrets';
  }
  return token ? `${fuente}:${token}` : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const packed = await getMpToken(admin);
    if (!packed) return json({ token_encontrado: false });
    const [fuente, token] = [packed.slice(0, packed.indexOf(':')), packed.slice(packed.indexOf(':') + 1)];
    const es_produccion = token.startsWith('APP_USR-');

    const resp = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json().catch(() => ({}));
    return json({
      token_encontrado: true,
      fuente,
      token_prefijo: token.slice(0, 8),
      es_produccion,
      valido: resp.ok,
      status_http: resp.status,
      site_id: data?.site_id ?? null,
      nickname: data?.nickname ?? null,
      live_mode: data?.live_mode ?? null,
      error: resp.ok ? null : (data?.message ?? data?.error ?? null),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
