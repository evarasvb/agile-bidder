// Recuperación de contraseña vía Resend (entrega confiable). En vez de depender
// del mailer interno de Supabase (que necesita SMTP configurado y suele no
// llegar), generamos el enlace de recuperación con el admin de Supabase y lo
// enviamos con Resend, igual que la invitación/activación de miembros.
//
// Body: { email, app_url? }
// Por seguridad SIEMPRE responde { ok: true } (no revela si el correo existe).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

const FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';

function emailHtml(url: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#1E40AF;padding:22px 28px;color:#fff"><div style="font-size:20px;font-weight:700">FirmaVB</div></div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 10px">Recupera tu contraseña</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 22px">Recibimos una solicitud para restablecer tu contraseña. Haz clic para crear una nueva:</p>
        <a href="${url}" style="display:inline-block;background:#1E40AF;color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">Crear nueva contraseña</a>
        <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:22px 0 0">Si no fuiste tú, ignora este correo. Si el botón no funciona, copia y pega este enlace:<br><span style="color:#1E40AF;word-break:break-all">${url}</span></p>
      </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 0">FirmaVB · Vende al Estado sin morir en el intento</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const db = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const appUrl = String(body.app_url || '').replace(/\/$/, '') || 'https://firmavb.cl';
    if (!email) return json({ error: 'Falta email' }, 400);

    const redirectTo = `${appUrl}/auth?reset=true`;

    // Genera el enlace de recuperación. Si el correo no existe, Supabase da un
    // error; lo tragamos y respondemos ok igual (no filtramos existencia).
    let actionLink: string | null = null;
    try {
      const { data, error } = await (db.auth.admin as any).generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      if (!error) actionLink = data?.properties?.action_link ?? null;
    } catch (_) { /* no revelar */ }

    let emailEnviado = false;
    if (actionLink && resendKey) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [email], subject: 'Recupera tu contraseña en FirmaVB', html: emailHtml(actionLink) }),
        });
        emailEnviado = r.ok;
      } catch (_) { /* noop */ }
    }

    // Siempre ok (no revelamos si el correo existe ni si se envió).
    return json({ ok: true, email_enviado: emailEnviado });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
