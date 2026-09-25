// Aviso por correo de nuevas citas agendadas (Agile Bidder). Corre por cron.
// Busca en agendamientos_meet las citas con avisado=false, manda UN correo al
// fundador con todas, y las marca avisado=true. Independiente de la app y del
// Remote Control: llega al inbox (y al teléfono como notificación de correo).
import { createClient } from "jsr:@supabase/supabase-js@2";

const DESTINO = "evaras@firmavb.cl";
const FROM = "FirmaVB <notificaciones@firmavb.cl>";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function fmtFecha(iso: string | null): string {
  if (!iso) return "s/i";
  try { return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return String(iso); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND = Deno.env.get("RESEND_API_KEY");
    const sb = createClient(SUPABASE_URL, SERVICE);

    const { data: citas, error } = await sb
      .from("agendamientos_meet")
      .select("id, nombre, empresa, email, telefono, fecha_meet, temas, link_meet, fecha_agendamiento")
      .eq("avisado", false)
      .order("id");
    if (error) throw error;
    if (!citas?.length) return json({ ok: true, avisos: 0 });

    if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY no configurada" }, 500);

    const filas = (citas as any[]).map((c) => {
      const temas = Array.isArray(c.temas) ? c.temas.join(", ") : (c.temas ?? "");
      const link = c.link_meet ? `<a href="${esc(c.link_meet)}">${esc(c.link_meet)}</a>` : "—";
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${esc(c.nombre) || "—"}</strong><br><span style="color:#666">${esc(c.empresa) || ""}</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(c.email) || "—"}<br>${esc(c.telefono) || ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(fmtFecha(c.fecha_meet))}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(temas)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${link}</td>
      </tr>`;
    }).join("");

    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">
      <h2 style="color:#1e3a8a">📅 ${citas.length === 1 ? "Nueva cita agendada" : `${citas.length} nuevas citas agendadas`}</h2>
      <p>Alguien agendó una reunión desde Agile Bidder. Confírmala hoy por WhatsApp para asegurar la asistencia.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#666">
          <th style="padding:8px">Contacto</th><th style="padding:8px">Email / Tel</th><th style="padding:8px">Reunión</th><th style="padding:8px">Temas</th><th style="padding:8px">Link</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px">Aviso automático de FirmaVB · Agile Bidder</p>
    </div>`;

    const subject = citas.length === 1
      ? `📅 Nueva cita: ${(citas[0] as any).nombre ?? "sin nombre"}`
      : `📅 ${citas.length} nuevas citas agendadas`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [DESTINO], subject, html }),
    });
    if (!r.ok) return json({ ok: false, error: "resend", detalle: (await r.text()).slice(0, 300) }, 502);

    const ids = (citas as any[]).map((c) => c.id);
    await sb.from("agendamientos_meet").update({ avisado: true }).in("id", ids);

    return json({ ok: true, avisos: ids.length, ids });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
