// soporte-ticket — canaliza un caso de soporte al equipo.
//
// Qué hace:
//  1) Guarda el ticket (con el transcript de la conversación con Evaristo) en
//     public.soporte_tickets → queda REGISTRO para seguimiento.
//  2) Envía un correo a contacto@firmavb.cl con toda la conversación + la
//     identidad del cliente. El reply_to es el correo del CLIENTE, así el equipo
//     responde directo desde su bandeja y la respuesta le llega al cliente
//     (comunicación efectiva, sin herramientas extra).
//  3) Envía al cliente un correo de confirmación con su número de ticket.
//
// Público (verify_jwt=false): lo usan clientes con sesión y también visitantes
// del landing sin cuenta. Siempre responde ok para no filtrar nada.
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

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Msg = { role?: string; content?: string };

function transcriptHtml(conv: Msg[]) {
  if (!conv?.length) return '<p style="color:#94a3b8">— sin conversación previa —</p>';
  return conv
    .filter((m) => m && m.content)
    .map((m) => {
      const esCliente = m.role === 'user';
      const quien = esCliente ? 'Cliente' : 'Evaristo';
      const bg = esCliente ? '#eff6ff' : '#f1f5f9';
      const col = esCliente ? '#1E40AF' : '#334155';
      return `<div style="margin:0 0 8px">
        <div style="font-size:11px;font-weight:700;color:${col};margin:0 0 2px">${quien}</div>
        <div style="background:${bg};border-radius:10px;padding:8px 11px;font-size:13px;color:#1e293b;white-space:pre-wrap">${esc(m.content || '')}</div>
      </div>`;
    })
    .join('');
}

function emailEquipo(t: {
  numero: number | string; nombre: string; email: string; empresa: string; telefono: string;
  canal: string; pantalla: string; mensaje: string; conv: Msg[];
}) {
  const filaDato = (k: string, v: string) =>
    v ? `<tr><td style="padding:3px 10px 3px 0;color:#64748b;font-size:12px">${k}</td><td style="padding:3px 0;font-size:13px;color:#1e293b">${esc(v)}</td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:640px;margin:0 auto;padding:28px 18px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#1E40AF;padding:18px 24px;color:#fff">
        <div style="font-size:13px;opacity:.85">FirmaVB · Soporte</div>
        <div style="font-size:19px;font-weight:700">🎫 Ticket #${t.numero}</div>
      </div>
      <div style="padding:22px 24px">
        <table style="border-collapse:collapse;margin:0 0 16px">
          ${filaDato('Cliente', t.nombre)}
          ${filaDato('Empresa', t.empresa)}
          ${filaDato('Correo', t.email)}
          ${filaDato('Teléfono', t.telefono)}
          ${filaDato('Canal', t.canal)}
          ${filaDato('Pantalla', t.pantalla)}
        </table>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin:0 0 18px">
          <div style="font-size:11px;font-weight:700;color:#92400e;margin:0 0 4px">CONSULTA / INQUIETUD</div>
          <div style="font-size:14px;color:#1e293b;white-space:pre-wrap">${esc(t.mensaje) || '—'}</div>
        </div>
        <div style="font-size:11px;font-weight:700;color:#64748b;margin:0 0 8px">CONVERSACIÓN CON EVARISTO</div>
        ${transcriptHtml(t.conv)}
        <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:20px 0 0;border-top:1px solid #e2e8f0;padding-top:14px">
          Responde este correo directamente y tu respuesta le llegará al cliente (${esc(t.email)}).
        </p>
      </div>
    </div>
  </div></body></html>`;
}

function emailClienteConfirma(numero: number | string, nombre: string) {
  const hola = nombre ? `Hola ${esc(nombre)},` : '¡Hola!';
  return `<!doctype html><html><body style="margin:0;background:#f4f7fa;font-family:Segoe UI,Arial,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:#1E40AF;padding:22px 28px;color:#fff"><div style="font-size:20px;font-weight:700">FirmaVB</div></div>
      <div style="padding:28px">
        <h1 style="font-size:20px;margin:0 0 10px">Recibimos tu consulta ✅</h1>
        <p style="color:#475569;line-height:1.6;margin:0 0 14px">${hola} gracias por escribirnos. Registramos tu caso con el número <strong>#${numero}</strong> y nuestro equipo te responderá a este mismo correo lo antes posible.</p>
        <p style="color:#475569;line-height:1.6;margin:0 0 6px">Mientras tanto, puedes seguir usando firmavb con normalidad. Si es urgente, escríbenos por WhatsApp:</p>
        <a href="https://wa.me/56990996055" style="display:inline-block;background:#22c55e;color:#fff;text-decoration:none;font-weight:600;padding:11px 22px;border-radius:10px;margin:6px 0 0">Hablar por WhatsApp</a>
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
    const mensaje = String(body.mensaje || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Correo inválido' }, 400);
    if (!mensaje && !(Array.isArray(body.conversacion) && body.conversacion.length)) {
      return json({ error: 'Falta el mensaje' }, 400);
    }

    const conv: Msg[] = Array.isArray(body.conversacion) ? body.conversacion.slice(-40) : [];
    let cliente_id = body.cliente_id ?? null;
    let empresa = String(body.empresa || '');
    let telefono = String(body.telefono || '');
    let nombre = String(body.nombre || '');

    // Enriquecer identidad desde `clientes` si tenemos user_id (o el correo).
    try {
      let q = db.from('clientes').select('id, empresa_nombre, nombre_responsable, telefono, email').limit(1);
      if (body.user_id) q = q.eq('user_id', body.user_id);
      else q = q.eq('email', email);
      const { data: cli } = await q.maybeSingle();
      if (cli) {
        cliente_id = cliente_id ?? (cli as any).id;
        empresa = empresa || (cli as any).empresa_nombre || '';
        telefono = telefono || (cli as any).telefono || '';
        nombre = nombre || (cli as any).nombre_responsable || '';
      }
    } catch (_) { /* opcional */ }

    const asunto = String(body.asunto || '').trim() || (mensaje ? mensaje.slice(0, 80) : 'Consulta de soporte');

    const { data: inserted, error: insErr } = await db
      .from('soporte_tickets')
      .insert({
        cliente_id,
        user_id: body.user_id ?? null,
        email,
        nombre: nombre || null,
        empresa: empresa || null,
        telefono: telefono || null,
        canal: String(body.canal || 'app'),
        pantalla: String(body.pantalla || '') || null,
        asunto,
        mensaje: mensaje || null,
        conversacion: conv,
      })
      .select('numero')
      .single();

    if (insErr) {
      console.error('insert ticket error:', insErr);
      return json({ error: 'No se pudo registrar el ticket' }, 500);
    }
    const numero = (inserted as any)?.numero ?? '—';

    // Correo al equipo (reply_to = cliente) y confirmación al cliente.
    let email_equipo = false;
    let email_cliente = false;
    if (resendKey) {
      try {
        const r1 = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [CONTACTO],
            reply_to: email,
            subject: `🎫 Ticket #${numero} · ${empresa || nombre || email} — ${asunto}`.slice(0, 120),
            html: emailEquipo({ numero, nombre, email, empresa, telefono, canal: String(body.canal || 'app'), pantalla: String(body.pantalla || ''), mensaje, conv }),
          }),
        });
        email_equipo = r1.ok;
      } catch (e) { console.error('resend equipo:', e); }

      try {
        const r2 = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: FROM,
            to: [email],
            reply_to: CONTACTO,
            subject: `Recibimos tu consulta — Ticket #${numero} · FirmaVB`,
            html: emailClienteConfirma(numero, nombre),
          }),
        });
        email_cliente = r2.ok;
      } catch (e) { console.error('resend cliente:', e); }
    }

    return json({ ok: true, numero, email_equipo, email_cliente });
  } catch (e) {
    console.error('soporte-ticket error:', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
