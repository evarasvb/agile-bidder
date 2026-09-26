import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ADMIN_EMAIL = 'evaras@firmavb.cl';
const cors = {
  'Access-Control-Allow-Origin': 'https://www.firmavb.cl',
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
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('authorization') ?? '';
    const jwt = authorization.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return json({ error: 'unauthorized' }, 401);

    const admin = createClient(url, serviceRole);
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || authData.user?.email?.toLowerCase() !== ADMIN_EMAIL) {
      return json({ error: 'forbidden' }, 403);
    }

    let token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || '';
    if (!token) {
      const { data: secret } = await admin
        .from('app_secrets')
        .select('value')
        .eq('key', 'MERCADOPAGO_ACCESS_TOKEN')
        .maybeSingle();
      token = (secret as { value?: string } | null)?.value || '';
    }
    if (!token) return json({ token_encontrado: false });

    const response = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    return json({
      token_encontrado: true,
      valido: response.ok,
      status_http: response.status,
      site_id: data?.site_id ?? null,
      live_mode: data?.live_mode ?? null,
      error: response.ok ? null : (data?.message ?? data?.error ?? null),
    });
  } catch (_error) {
    return json({ error: 'unexpected_error' }, 500);
  }
});
