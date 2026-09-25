// Aviso por correo cuando un cliente completa el onboarding (Agile Bidder).
// Corre por cron. Busca en clientes los onboarding_completado con
// aviso_onboarding=false (vía RPC), manda UN correo al fundador y los marca.
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

    const { data: clientes, error } = await sb.rpc("onboardings_por_avisar");
    if (error) throw error;
    if (!clientes?.length) return json({ ok: true, avisos: 0 });

    if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY no configurada" }, 500);

    const filas = (clientes as any[]).map((c) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${esc(c.empresa) || esc(c.nombre) || "Cliente"}</strong>${c.nombre ? `<br><span style="color:#666">${esc(c.nombre)}</span>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(c.email) || "—"}${c.telefono ? `<br>${esc(c.telefono)}` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(c.rut) || "—"}${c.region ? `<br>${esc(c.region)}` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(c.plan) || "—"}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(fmtFecha(c.completado_en))}</td>
      </tr>`).join("");

    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:660px;margin:auto">
      <h2 style="color:#1e3a8a">✅ ${clientes.length === 1 ? "Un cliente completó su onboarding" : `${clientes.length} clientes completaron su onboarding`}</h2>
      <p>Ya está listo para recibir oportunidades. Buen momento para un mensaje de bienvenida y confirmar sus rubros.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#666">
          <th style="padding:8px">Empresa</th><th style="padding:8px">Contacto</th><th style="padding:8px">RUT / Región</th><th style="padding:8px">Plan</th><th style="padding:8px">Completado</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px">Aviso automático de FirmaVB · Agile Bidder</p>
    </div>`;

    const subject = clientes.length === 1
      ? `✅ Onboarding completo: ${(clientes[0] as any).empresa ?? (clientes[0] as any).nombre ?? "cliente"}`
      : `✅ ${clientes.length} clientes completaron su onboarding`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [DESTINO], subject, html }),
    });
    if (!r.ok) return json({ ok: false, error: "resend", detalle: (await r.text()).slice(0, 300) }, 502);

    const ids = (clientes as any[]).map((c) => c.id);
    await sb.from("clientes").update({ aviso_onboarding: true }).in("id", ids);

    return json({ ok: true, avisos: ids.length });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
