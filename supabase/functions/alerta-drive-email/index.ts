// Aviso por correo cuando un cliente conecta su Google Drive (Agile Bidder).
// Corre por cron. Busca conexiones con avisado=false (vía RPC que NO expone
// tokens), manda UN correo al fundador con todas y las marca avisado=true.
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

    const { data: conexiones, error } = await sb.rpc("drive_conexiones_por_avisar");
    if (error) throw error;
    if (!conexiones?.length) return json({ ok: true, avisos: 0 });

    if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY no configurada" }, 500);

    const filas = (conexiones as any[]).map((c) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${esc(c.nombre) || "Cliente"}</strong><br><span style="color:#666">${esc(c.email_app) || ""}</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(c.google_email) || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(fmtFecha(c.conectado_en))}</td>
      </tr>`).join("");

    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">
      <h2 style="color:#1e3a8a">🔗 ${conexiones.length === 1 ? "Un cliente conectó su Google Drive" : `${conexiones.length} clientes conectaron su Google Drive`}</h2>
      <p>Ya puedes leer sus documentos desde el ERP para completar sus postulaciones.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#666">
          <th style="padding:8px">Cliente</th><th style="padding:8px">Cuenta Google</th><th style="padding:8px">Conectado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px">Aviso automático de FirmaVB · Agile Bidder</p>
    </div>`;

    const subject = conexiones.length === 1
      ? `🔗 ${(conexiones[0] as any).nombre ?? "Un cliente"} conectó su Google Drive`
      : `🔗 ${conexiones.length} clientes conectaron su Google Drive`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [DESTINO], subject, html }),
    });
    if (!r.ok) return json({ ok: false, error: "resend", detalle: (await r.text()).slice(0, 300) }, 502);

    const ids = (conexiones as any[]).map((c) => c.user_id);
    await sb.from("google_drive_conexiones").update({ avisado: true }).in("user_id", ids);

    return json({ ok: true, avisos: ids.length });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
