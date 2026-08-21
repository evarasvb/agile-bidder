// notificar-ticket-resuelto — avisa al cliente por correo cuando su ticket de
// soporte pasa a "resuelto". Lo llama el panel admin al cambiar el estado.
//
// Body: { ticket_id }
// Carga el ticket con service role, y si está resuelto envía un correo al
// cliente (reply_to = contacto@firmavb.cl para que pueda responder si sigue
// con la duda). Siempre responde ok.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const FROM = 'FirmaVB <notificaciones@notifications.firmavb.cl>';
const CONTACTO = 'contacto@firmavb.cl';
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function emailHtml(numero: number | string, nombre: string, asunto: string) {
  const hola = nombre ? `Hola ${esc(nombre)},` : '¡Hola!';
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#16a34a;padding:22px 28px;color:#fff"><div style="font-size:20px;font-weight:700">FirmaVB</div></div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 10px">Tu consulta quedó resuelta ✅</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 14px">${hola} marcamos como <strong>resuelta</strong> tu consulta <strong>#${numero}</strong>${asunto ? ` (“${esc(asunto)}”)` : ''}.</p>
        <p style="color:#475569;line-height:1.6;margin:0 0 6px">Si el tema quedó resuelto, ¡genial! Y si todavía tienes dudas, solo responde este correo y seguimos ayudándote.</p>
        <a href="https://wa.me/56990996055" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:10px;margin:10px 0 0">Escríbenos por WhatsApp</a>
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
    const ticketId = String(body.ticket_id || '').trim();
    if (!ticketId) return json({ error: 'Falta ticket_id' }, 400);

    const { data: t, error } = await db
      .from('soporte_tickets')
      .select('numero, email, nombre, asunto, estado')
      .eq('id', ticketId)
      .maybeSingle();
    if (error || !t) return json({ ok: true, email_enviado: false, motivo: 'no encontrado' });
    if ((t as any).estado !== 'resuelto') return json({ ok: true, email_enviado: false, motivo: 'no resuelto' });

    const email = String((t as any).email || '').trim();
    if (!email) return json({ ok: true, email_enviado: false, motivo: 'sin correo' });

    let email_enviado = false;
    if (resendKey) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [email],
            reply_to: CONTACTO,
            subject: `Tu consulta #${(t as any).numero} está resuelta · FirmaVB`,
            html: emailHtml((t as any).numero, String((t as any).nombre || ''), String((t as any).asunto || '')),
          }),
        });
        email_enviado = r.ok;
      } catch (e) { console.error('resend resuelto:', e); }
    }

    return json({ ok: true, email_enviado });
  } catch (e) {
    console.error('notificar-ticket-resuelto error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
