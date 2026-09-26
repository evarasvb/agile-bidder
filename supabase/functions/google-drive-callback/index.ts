// Callback público de Google OAuth (verify_jwt = false: Google redirige sin JWT).
// Verifica el `state` firmado, intercambia el code por tokens y guarda la
// conexión (service_role). Luego redirige de vuelta a la app.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function fromB64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}
function b64url(bytes: Uint8Array): string {
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hmac(msg: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return b64url(new Uint8Array(sig));
}
async function verificarState(state: string, secret: string): Promise<{ u: string; o: string; t: number } | null> {
  const [p, s] = state.split('.');
  if (!p || !s) return null;
  if (await hmac(p, secret) !== s) return null;
  try {
    const obj = JSON.parse(new TextDecoder().decode(fromB64url(p)));
    if (!obj?.u || !obj?.t || Date.now() - obj.t > 10 * 60_000) return null;
    return obj;
  } catch { return null; }
}
function redirect(to: string) { return new Response(null, { status: 302, headers: { Location: to } }); }

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state');
  const errParam = reqUrl.searchParams.get('error');

  const st = state ? await verificarState(state, service) : null;
  const base = (st?.o || 'https://firmavb.cl') + '/configuracion/integraciones';

  if (errParam || !code || !st || !clientId || !clientSecret) return redirect(`${base}?drive=error`);

  try {
    const redirectUri = `${url}/functions/v1/google-drive-callback`;
    const tr = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const t = await tr.json();
    if (!tr.ok || !t.refresh_token) return redirect(`${base}?drive=error`);

    let email: string | null = null;
    try {
      const ui = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${t.access_token}` } });
      if (ui.ok) email = (await ui.json()).email ?? null;
    } catch { /* email es opcional */ }

    const db = createClient(url, service);
    await db.from('google_drive_conexiones').upsert({
      user_id: st.u, google_email: email, access_token: t.access_token, refresh_token: t.refresh_token,
      token_expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
      scope: t.scope ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return redirect(`${base}?drive=ok`);
  } catch {
    return redirect(`${base}?drive=error`);
  }
});
