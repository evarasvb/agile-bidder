// Aviso por correo cuando un cliente sube un documento (Agile Bidder).
// Corre por cron. Busca en cliente_documentos los que tienen avisado=false
// (vía RPC), manda UN correo al fundador con todos y los marca avisado=true.
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

    const { data: docs, error } = await sb.rpc("documentos_por_avisar");
    if (error) throw error;
    if (!docs?.length) return json({ ok: true, avisos: 0 });

    if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY no configurada" }, 500);

    const filas = (docs as any[]).map((d) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #eee"><strong>${esc(d.nombre) || "Documento"}</strong>${d.tipo ? `<br><span style="color:#666">${esc(d.tipo)}</span>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(d.empresa) || "—"}<br><span style="color:#666">${esc(d.email) || ""}</span></td>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(fmtFecha(d.subido_en))}</td>
      </tr>`).join("");

    const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">
      <h2 style="color:#1e3a8a">📎 ${docs.length === 1 ? "Un cliente subió un documento" : `${docs.length} documentos subidos`}</h2>
      <p>Revisa el documento en el ERP para avanzar con su postulación.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr style="text-align:left;color:#666">
          <th style="padding:8px">Documento</th><th style="padding:8px">Cliente</th><th style="padding:8px">Subido</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p style="color:#999;font-size:12px;margin-top:16px">Aviso automático de FirmaVB · Agile Bidder</p>
    </div>`;

    const subject = docs.length === 1
      ? `📎 Documento subido: ${(docs[0] as any).empresa ?? (docs[0] as any).nombre ?? "cliente"}`
      : `📎 ${docs.length} documentos subidos`;

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [DESTINO], subject, html }),
    });
    if (!r.ok) return json({ ok: false, error: "resend", detalle: (await r.text()).slice(0, 300) }, 502);

    const ids = (docs as any[]).map((d) => d.id);
    await sb.from("cliente_documentos").update({ avisado: true }).in("id", ids);

    return json({ ok: true, avisos: ids.length });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
