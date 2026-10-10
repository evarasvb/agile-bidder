// Aviso por correo de mensajes nuevos del chat del Market de proveedores del
// Estado (mk_mensajes) que nadie contestó/vio en los últimos 10 minutos.
// Corre por cron (ver migración 20261002040000). Mismo patrón que
// alerta-documento-email: junta lo pendiente por destinatario, manda UN
// correo con todo y lo marca avisado.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { deliverGroups } from './delivery.ts';

const FROM = "FirmaVB <notificaciones@firmavb.cl>";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface MensajePorAvisar {
  id: string;
  destino_email: string | null;
  destino_nombre: string | null;
  autor_nombre: string | null;
  producto: string;
  mensaje: string;
  creado_en: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // El cron usa la credencial de servicio; una sesión de cliente no autoriza
    // procesar ni marcar la cola global de conversaciones.
    if (!SERVICE || req.headers.get('Authorization') !== `Bearer ${SERVICE}`) {
      return json({ ok: false, error: 'No autorizado' }, 403);
    }
    const RESEND = Deno.env.get("RESEND_API_KEY");
    const sb = createClient(SUPABASE_URL, SERVICE);

    const { data: filas, error } = await sb.rpc("mk_mensajes_por_avisar");
    if (error) throw error;
    const pendientes = (filas ?? []) as MensajePorAvisar[];
    if (!pendientes.length) return json({ ok: true, avisos: 0 });

    if (!RESEND) return json({ ok: false, error: "RESEND_API_KEY no configurada" }, 500);

    const resultado = await deliverGroups(pendientes, async (email, mensajes) => {
      const filasHtml = mensajes.map((m) => `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee"><strong>${esc(m.autor_nombre) || "Un proveedor/cliente"}</strong><br><span style="color:#666">${esc(m.producto)}</span></td>
          <td style="padding:8px;border-bottom:1px solid #eee">${esc(m.mensaje)}</td>
        </tr>`).join("");

      const html = `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:auto">
        <h2 style="color:#1e3a8a">💬 ${mensajes.length === 1 ? "Tienes un mensaje nuevo" : `Tienes ${mensajes.length} mensajes nuevos`} en el Market de proveedores</h2>
        <p>Nadie lo contestó todavía. Entra al ERP (Market del Estado → Mis solicitudes) para responder.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="text-align:left;color:#666"><th style="padding:8px">De</th><th style="padding:8px">Mensaje</th></tr></thead>
          <tbody>${filasHtml}</tbody>
        </table>
        <p style="color:#999;font-size:12px;margin-top:16px">Aviso automático de FirmaVB · Market de proveedores del Estado</p>
      </div>`;

      const subject = mensajes.length === 1
        ? `💬 Mensaje nuevo de ${mensajes[0].autor_nombre ?? "un contacto"}`
        : `💬 ${mensajes.length} mensajes nuevos en el Market de proveedores`;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [email], subject, html }),
      });
      return r.ok;
    }, async ids => {
      const { error } = await sb.rpc("mk_mensajes_marcar_avisados", { p_ids: ids });
      if (error) throw error;
    });
    return json({ ok: resultado.fallos === 0, ...resultado });
  } catch (e) {
    return json({ ok: false, error: String((e as any)?.message ?? e) }, 500);
  }
});
