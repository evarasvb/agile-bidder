// Aviso por correo cuando alguien se registra en la app (Agile Bidder).
// Corre por cron. Busca en profiles los registros con avisado=false (vía RPC
// que también trae empresa/plan del cliente), manda UN correo al fundador con
// todos y los marca avisado=true.
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

    const { data: registros, error } = await sb.rpc("registros_por_avisar");
    if (error) throw error;
    if (!registros?.length) return json({ ok: true, avisos: 0 });

    if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY no configurada" }, 500);

    const filas = (registros as any[]).map((r) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${esc(r.nombre) || "Nuevo usuario"}</strong>${r.empresa ? `<br><span style="color:#666">${esc(r.empresa)}</span>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(r.email) || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(r.plan) || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(fmtFecha(r.creado_en))}</td>
      </tr>`).join("");

    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">
      <h2 style="color:#1e3a8a">🎉 ${registros.length === 1 ? "Nuevo registro en Agile Bidder" : `${registros.length} nuevos registros en Agile Bidder`}</h2>
      <p>Dale la bienvenida y confirma que complete su perfil para empezar a recibir oportunidades.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#666">
          <th style="padding:8px">Usuario</th><th style="padding:8px">Email</th><th style="padding:8px">Plan</th><th style="padding:8px">Registro</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px">Aviso automático de FirmaVB · Agile Bidder</p>
    </div>`;

    const subject = registros.length === 1
      ? `🎉 Nuevo registro: ${(registros[0] as any).nombre ?? (registros[0] as any).email ?? "usuario"}`
      : `🎉 ${registros.length} nuevos registros en Agile Bidder`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [DESTINO], subject, html }),
    });
    if (!r.ok) return json({ ok: false, error: "resend", detalle: (await r.text()).slice(0, 300) }, 502);

    const ids = (registros as any[]).map((x) => x.id);
    await sb.from("profiles").update({ avisado: true }).in("id", ids);

    return json({ ok: true, avisos: ids.length });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
