// FirmaVB — confirma una inscripción al webinar y envía la invitación con el evento (.ics +
// enlace a Google Calendar), más una invitación a probar el Experto FirmaVB.
// Se llama sola: la dispara un trigger en `webinar_inscripciones` al insertar una fila.
//   POST {id} (service_role) -> envía el correo y marca notificado=true
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Evento fijo (webinar único). Si algún día hay más de uno, esto se vuelve parámetro por evento_slug.
const EVENTO = {
  titulo: "Cómo postular al Convenio Marco de SaaS y no morir en el intento",
  inicioUtc: "20260908T220000Z", // martes 8-sep-2026, 19:00 hrs Chile (UTC-3)
  finUtc: "20260908T233000Z",    // 20:30 hrs Chile
  inicioLocalIcs: "20260908T190000",
  finLocalIcs: "20260908T203000",
  tzid: "America/Santiago",
  lugarTexto: "Online (Google Meet) — el enlace de acceso llega por correo un día antes",
  descripcion: "Webinar en vivo de FirmaVB: cómo postular al Convenio Marco de Desarrollo de Software, Servicios Profesionales TI y Cloud Computing (2239-2-LR26) sin quedar fuera por un anexo mal completado. Con Enrique Varas.",
};

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function construirIcs(nombre: string): string {
  const uid = crypto.randomUUID();
  const ahora = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FirmaVB//Webinar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}@firmavb.cl`,
    `DTSTAMP:${ahora}`,
    `DTSTART;TZID=${EVENTO.tzid}:${EVENTO.inicioLocalIcs}`,
    `DTEND;TZID=${EVENTO.tzid}:${EVENTO.finLocalIcs}`,
    `SUMMARY:${icsEscape(EVENTO.titulo)}`,
    `DESCRIPTION:${icsEscape(`Hola ${nombre}, ` + EVENTO.descripcion)}`,
    `LOCATION:${icsEscape(EVENTO.lugarTexto)}`,
    "ORGANIZER;CN=FirmaVB:mailto:notificaciones@firmavb.cl",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// firmavb.cl es el dominio verificado en Resend; notifications.firmavb.cl (usado por
// send-notification) NO está verificado y devuelve 403 — por eso las alertas de esa función
// (nuevo match, cierre próximo) probablemente tampoco se están enviando hoy.
const FIRMAVB_FROM = "FirmaVB <notificaciones@firmavb.cl>";
const AZUL = "#1E40AF";

function construirHtml(nombre: string, linkGoogleCalendar: string): string {
  return `
  <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#f4f7fa; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e2e8f0;">
      <div style="background:${AZUL}; padding:24px; text-align:center;">
        <p style="color:#fff; font-size:12px; letter-spacing:.08em; text-transform:uppercase; margin:0 0 6px;">Webinar gratuito · FirmaVB</p>
        <h1 style="color:#fff; font-size:20px; margin:0; line-height:1.3;">${EVENTO.titulo}</h1>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px; color:#1e293b;">Hola ${icsEscape(nombre)}, quedaste inscrito 🎉</p>
        <table style="width:100%; background:#f8fafc; border-radius:10px; padding:16px; margin:16px 0; font-size:14px; color:#1e293b;">
          <tr><td style="padding:4px 0;"><b>📅 Cuándo</b></td><td style="padding:4px 0;">Martes 8 de septiembre, 19:00 hrs (Chile)</td></tr>
          <tr><td style="padding:4px 0;"><b>📍 Dónde</b></td><td style="padding:4px 0;">${EVENTO.lugarTexto}</td></tr>
          <tr><td style="padding:4px 0;"><b>🎤 Con</b></td><td style="padding:4px 0;">Enrique Varas, fundador de FirmaVB</td></tr>
        </table>
        <p style="font-size:14px; color:#475569;">Te dejamos adjunto el evento (.ics) para que lo agregues a tu calendario, o usa este acceso directo:</p>
        <p style="text-align:center; margin:20px 0;">
          <a href="${linkGoogleCalendar}" style="background:${AZUL}; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">Agregar a Google Calendar</a>
        </p>
        <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
        <p style="font-size:14px; color:#1e293b; font-weight:600;">¿No quieres esperar al martes?</p>
        <p style="font-size:14px; color:#475569;">El Experto FirmaVB ya lee las bases de este Convenio Marco, arma tu matriz de postulación y completa tus anexos con los datos de tu empresa. Pruébalo ahora:</p>
        <p style="text-align:center; margin:16px 0;">
          <a href="https://firmavb.cl/auth" style="background:#10B981; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:600;">Probar el Experto FirmaVB</a>
        </p>
        <p style="font-size:12px; color:#94a3b8; margin-top:24px;">FirmaVB · firmavb.cl</p>
      </div>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) return json({ error: "id" }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: fila, error } = await sb.from("webinar_inscripciones").select("id, nombre, email, notificado").eq("id", id).maybeSingle();
    if (error || !fila) return json({ error: "no_encontrado" }, 404);
    if (fila.notificado) return json({ ok: true, ya_notificado: true });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "sin_resend" }, 500);

    const gcalParams = new URLSearchParams({
      action: "TEMPLATE",
      text: EVENTO.titulo,
      dates: `${EVENTO.inicioUtc}/${EVENTO.finUtc}`,
      details: EVENTO.descripcion + "\n\nPrueba el Experto FirmaVB: https://firmavb.cl/auth",
      location: EVENTO.lugarTexto,
    });
    const linkGoogleCalendar = `https://calendar.google.com/calendar/render?${gcalParams.toString()}`;

    const ics = construirIcs(fila.nombre);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FIRMAVB_FROM,
        to: [fila.email],
        subject: `✅ Confirmado: Webinar Convenio Marco SaaS · martes 19:00`,
        html: construirHtml(fila.nombre, linkGoogleCalendar),
        attachments: [{ filename: "webinar-convenio-marco-saas.ics", content: base64(ics) }],
      }),
    });
    if (!r.ok) { console.error("resend", r.status, await r.text()); return json({ error: "resend" }, 502); }
    await sb.from("webinar_inscripciones").update({ notificado: true }).eq("id", id);
    return json({ ok: true });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
