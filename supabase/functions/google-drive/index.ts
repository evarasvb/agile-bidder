// Google Drive por usuario (parte autenticada). Acciones:
//   start        -> devuelve la URL de consentimiento de Google (OAuth)
//   listar       -> lista carpetas/archivos del Drive del usuario
//   descargar    -> devuelve un archivo (base64) para enviarlo al Experto
//   desconectar  -> revoca y borra la conexión
// Los tokens viven en google_drive_conexiones (solo service_role). El callback
// de Google está en la función pública google-drive-callback.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email';

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
async function hmac(msg: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return b64url(new Uint8Array(sig));
}
async function firmarState(obj: Record<string, unknown>, secret: string): Promise<string> {
  const p = b64url(new TextEncoder().encode(JSON.stringify(obj)));
  return `${p}.${await hmac(p, secret)}`;
}

async function accessToken(db: any, userId: string, clientId: string, clientSecret: string): Promise<string | null> {
  const { data: row } = await db.from('google_drive_conexiones')
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
  await db.from('google_drive_conexiones').update({
    access_token: nuevo, token_expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  return nuevo;
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
      if (!clientId || !clientSecret) return json({ error: 'Google Drive no está configurado. Falta la credencial de Google.' }, 500);
      const origin = String(body.origin || '').replace(/\/$/, '') || 'https://firmavb.cl';
      const redirectUri = `${url}/functions/v1/google-drive-callback`;
      const state = await firmarState({ u: user.id, o: origin, t: Date.now() }, service);
      const params = new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
        access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', scope: SCOPES, state,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }

    if (action === 'desconectar') {
      const { data: row } = await db.from('google_drive_conexiones').select('refresh_token, access_token').eq('user_id', user.id).maybeSingle();
      const tok = row?.refresh_token || row?.access_token;
      if (tok) await fetch(`https://oauth2.googleapis.com/revoke?token=${tok}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => {});
      await db.from('google_drive_conexiones').delete().eq('user_id', user.id);
      return json({ ok: true });
    }

    // A partir de aquí se necesita un token válido.
    if (!clientId || !clientSecret) return json({ error: 'Google Drive no está configurado.' }, 500);
    const at = await accessToken(db, user.id, clientId, clientSecret);
    if (!at) return json({ error: 'no_conectado', mensaje: 'Conecta tu Google Drive primero.' }, 409);

    if (action === 'listar') {
      const folderId = body.folderId ? String(body.folderId) : null;
      const buscar = body.buscar ? String(body.buscar).replace(/'/g, "\\'") : '';
      let q = 'trashed = false';
      if (folderId) q += ` and '${folderId.replace(/'/g, "\\'")}' in parents`;
      if (buscar) q += ` and name contains '${buscar}'`;
      const params = new URLSearchParams({
        q, pageSize: '100', orderBy: 'folder,name',
        fields: 'nextPageToken, files(id,name,mimeType,iconLink,modifiedTime,size,webViewLink)',
        supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
      });
      if (body.pageToken) params.set('pageToken', String(body.pageToken));
      const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${at}` } });
      if (!r.ok) return json({ error: 'No se pudo leer Drive.', detalle: (await r.text()).slice(0, 200) }, 502);
      const d = await r.json();
      return json({ ok: true, files: d.files ?? [], nextPageToken: d.nextPageToken ?? null });
    }

    if (action === 'descargar') {
      const fileId = String(body.fileId || '');
      if (!fileId) return json({ error: 'Falta fileId' }, 400);
      const metaR = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${at}` } });
      if (!metaR.ok) return json({ error: 'No se encontró el archivo en Drive.' }, 404);
      const meta = await metaR.json();
      let nombre = String(meta.name || 'archivo');
      let mime = String(meta.mimeType || 'application/octet-stream');
      let contentUrl: string;
      if (mime.startsWith('application/vnd.google-apps')) {
        // Documentos nativos de Google: se exportan (Sheets->xlsx, resto->pdf).
        const esSheet = mime.includes('spreadsheet');
        const exportMime = esSheet ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
        contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
        mime = exportMime;
        if (!/\.(pdf|xlsx)$/i.test(nombre)) nombre += esSheet ? '.xlsx' : '.pdf';
      } else {
        contentUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      }
      const fileR = await fetch(contentUrl, { headers: { Authorization: `Bearer ${at}` } });
      if (!fileR.ok) return json({ error: 'No se pudo descargar el archivo.' }, 502);
      const bytes = new Uint8Array(await fileR.arrayBuffer());
      if (bytes.length > 15 * 1024 * 1024) return json({ error: 'El archivo supera los 15 MB.' }, 413);
      return json({ ok: true, nombre, mimeType: mime, base64: base64Std(bytes) });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
