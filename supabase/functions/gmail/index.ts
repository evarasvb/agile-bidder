// Gmail por usuario (parte autenticada). Acciones:
//   start          -> URL de consentimiento de Google (OAuth, scope gmail.compose)
//   crear_borrador -> crea un BORRADOR en el Gmail del usuario, con cuerpo HTML y
//                     adjuntos (PDFs enviados en base64 + archivos del bucket
//                     documentos-empresa indicados por su path)
//   desconectar    -> revoca y borra la conexión
// Los tokens viven en gmail_conexiones (solo service_role). El callback de Google
// está en la función pública gmail-callback. Reutiliza la credencial de Google
// del repo (GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

// gmail.compose permite crear/editar borradores (y enviar) en la cuenta del usuario.
const SCOPES = 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/userinfo.email';

function b64url(bytes: Uint8Array): string {
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64Std(bytes: Uint8Array): string {
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}
// Base64 en líneas de 76 caracteres (requisito MIME para Content-Transfer-Encoding: base64).
function base64Mime(bytes: Uint8Array): string {
  return (base64Std(bytes).match(/.{1,76}/g) || []).join('\r\n');
}
async function hmac(msg: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return b64url(new Uint8Array(sig));
}
async function firmarState(obj: Record<string, unknown>, secret: string): Promise<string> {
  const p = b64url(new TextEncoder().encode(JSON.stringify(obj)));
  return `${p}.${await hmac(p, secret)}`;
}

// Codifica un header con caracteres no-ASCII como encoded-word MIME (RFC 2047).
function encHeader(s: string): string {
  // deno-lint-ignore no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${base64Std(new TextEncoder().encode(s))}?=`;
}

async function accessToken(db: any, userId: string, clientId: string, clientSecret: string): Promise<string | null> {
  const { data: row } = await db.from('gmail_conexiones')
    .select('access_token, refresh_token, token_expiry').eq('user_id', userId).maybeSingle();
  if (!row?.refresh_token) return null;
  const exp = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  if (row.access_token && exp > Date.now() + 60_000) return row.access_token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: row.refresh_token, grant_type: 'refresh_token' }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  const nuevo = t.access_token as string;
  await db.from('gmail_conexiones').update({
    access_token: nuevo, token_expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return nuevo;
}

interface Adjunto { filename: string; mimeType?: string; base64: string; }
interface AdjuntoStorage { path: string; filename?: string; }

// Arma el mensaje MIME (multipart/mixed) y lo devuelve base64url para Gmail.
function construirRaw(opts: { to: string; from?: string | null; subject: string; bodyHtml: string; adjuntos: { filename: string; mimeType: string; bytes: Uint8Array }[] }): string {
  const boundary = `b_${crypto.randomUUID().replace(/-/g, '')}`;
  const nl = '\r\n';
  const cabeceras = [
    `To: ${opts.to}`,
    opts.from ? `From: ${opts.from}` : null,
    `Subject: ${encHeader(opts.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].filter(Boolean).join(nl);

  const partes: string[] = [];
  // Cuerpo HTML (en base64 para no romper con acentos / líneas largas).
  partes.push(
    `--${boundary}${nl}` +
    `Content-Type: text/html; charset="UTF-8"${nl}` +
    `Content-Transfer-Encoding: base64${nl}${nl}` +
    base64Mime(new TextEncoder().encode(opts.bodyHtml)),
  );
  for (const a of opts.adjuntos) {
    partes.push(
      `--${boundary}${nl}` +
      `Content-Type: ${a.mimeType}; name="${a.filename}"${nl}` +
      `Content-Disposition: attachment; filename="${a.filename}"${nl}` +
      `Content-Transfer-Encoding: base64${nl}${nl}` +
      base64Mime(a.bytes),
    );
  }
  const mensaje = cabeceras + nl + nl + partes.join(nl) + nl + `--${boundary}--${nl}`;
  return b64url(new TextEncoder().encode(mensaje));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

    const authHeader = req.headers.get('Authorization') || '';
    const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'No autenticado' }, 401);

    const db = createClient(url, service);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === 'start') {
      if (!clientId || !clientSecret) return json({ error: 'Gmail no está configurado. Falta la credencial de Google.' }, 500);
      const origin = String(body.origin || '').replace(/\/$/, '') || 'https://firmavb.cl';
      const redirectUri = `${url}/functions/v1/gmail-callback`;
      const state = await firmarState({ u: user.id, o: origin, t: Date.now() }, service);
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
        access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: SCOPES, state,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    if (action === 'desconectar') {
      const { data: row } = await db.from('gmail_conexiones').select('refresh_token, access_token').eq('user_id', user.id).maybeSingle();
      const tok = row?.refresh_token || row?.access_token;
      if (tok) await fetch(`https://oauth2.googleapis.com/revoke?token=${tok}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => {});
      await db.from('gmail_conexiones').delete().eq('user_id', user.id);
      return json({ ok: true });
    }

    if (!clientId || !clientSecret) return json({ error: 'Gmail no está configurado.' }, 500);
    const at = await accessToken(db, user.id, clientId, clientSecret);
    if (!at) return json({ error: 'no_conectado', mensaje: 'Conecta tu Gmail primero en Integraciones.' }, 409);

    if (action === 'crear_borrador') {
      const to = String(body.to || '').trim();
      const subject = String(body.subject || '(sin asunto)');
      const bodyHtml = String(body.bodyHtml || '');
      if (!to) return json({ error: 'Falta el correo del destinatario (to).' }, 400);

      const adjuntos: { filename: string; mimeType: string; bytes: Uint8Array }[] = [];
      let total = 0;
      for (const a of (Array.isArray(body.adjuntos) ? body.adjuntos : []) as Adjunto[]) {
        if (!a?.base64) continue;
        const bytes = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
        total += bytes.length;
        adjuntos.push({ filename: a.filename || 'adjunto.pdf', mimeType: a.mimeType || 'application/pdf', bytes });
      }
      // Archivos del bucket privado (factura / guía): los baja el service_role.
      for (const s of (Array.isArray(body.storage) ? body.storage : []) as AdjuntoStorage[]) {
        if (!s?.path) continue;
        const dl = await db.storage.from('documentos-empresa').download(s.path);
        if (dl.error || !dl.data) continue;
        const bytes = new Uint8Array(await dl.data.arrayBuffer());
        total += bytes.length;
        const mime = dl.data.type || (s.path.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
        adjuntos.push({ filename: s.filename || s.path.split('/').pop() || 'archivo', mimeType: mime, bytes });
      }
      if (total > 30 * 1024 * 1024) return json({ error: 'Los adjuntos superan los 30 MB.' }, 413);

      const from = body.from ? String(body.from) : null;
      const raw = construirRaw({ to, from, subject, bodyHtml, adjuntos });
      const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST', headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw } }),
      });
      if (!r.ok) return json({ error: 'No se pudo crear el borrador en Gmail.', detalle: (await r.text()).slice(0, 300) }, 502);
      const d = await r.json();
      const draftId = d?.id as string | undefined;
      const link = draftId ? `https://mail.google.com/mail/u/0/#drafts` : null;
      return json({ ok: true, draftId, messageId: d?.message?.id ?? null, link });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
