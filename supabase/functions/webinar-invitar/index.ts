// FirmaVB — envía la invitación al webinar recurrente "Véndele al Estado" DE A POCOS.
// La dispara un cron (o el admin) vía pg_net con el service_role como Bearer (verify_jwt).
//   POST { n?: number, campana?: string } -> envía las próximas n pendientes y las marca.
// Correo humano, de partner, con enlace de inscripción y opción de baja (anti-spam).
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const FROM = "Enrique de FirmaVB <notificaciones@firmavb.cl>";
const INSCRIPCION = "https://firmavb.cl/webinar/vendele-al-estado";
const SUPA = Deno.env.get("SUPABASE_URL")!;

function esc(s: string): string { return String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!)); }

function html(nombre: string | null, bajaUrl: string): string {
  const hola = nombre ? `Hola ${esc(nombre.split(" ")[0])},` : "Hola,";
  // A propósito simple y sobrio: parece un correo escrito a mano, no un newsletter.
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1e293b;max-width:560px;margin:0 auto;padding:8px 4px;">
    <p>${hola}</p>
    <p>Soy Enrique Varas, de FirmaVB. Llevo 17 años vendiéndole al Estado y conozco de memoria lo pesado que se hace a veces: los anexos, los plazos que no dan, los precios que no cierran.</p>
    <p>Estoy armando algo simple entre pares: <b>todos los martes, de 19:00 a 19:30</b>, nos juntamos por Google Meet a conversar de cómo venderle al Estado y no morir en el intento. Nada de vender humo — es una cruzada entre proveedores como tú y yo, para ayudarnos a ganar más licitaciones.</p>
    <p>Me encantaría que estuvieras. Te dejas caer el martes que puedas:</p>
    <p style="margin:22px 0;">
      <a href="${INSCRIPCION}" style="background:#1E40AF;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Sumarme a la conversación de los martes</a>
    </p>
    <p>Te inscribes una vez y te llega la cita al calendario, todas las semanas, con el enlace para entrar.</p>
    <p>Un abrazo,<br/>Enrique Varas<br/><span style="color:#64748b;">Fundador de FirmaVB · firmavb.cl</span></p>
    <p style="margin-top:26px;font-size:12px;color:#94a3b8;">Si prefieres no recibir estas invitaciones, <a href="${bajaUrl}" style="color:#94a3b8;">avísame aquí</a> y no te escribo más.</p>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const n = Math.max(1, Math.min(Number(body.n) || 25, 60)); // tope 60 por corrida
    const campana = String(body.campana || "vendele-al-estado");
    const sb = createClient(SUPA, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return json({ error: "sin_resend" }, 500);

    const { data: filas, error } = await sb
      .from("webinar_invitacion")
      .select("id, email, nombre")
      .eq("campana", campana)
      .eq("estado", "pendiente")
      .order("creado_en", { ascending: true })
      .limit(n);
    if (error) return json({ error: String(error.message) }, 500);
    if (!filas || filas.length === 0) return json({ ok: true, enviados: 0, restantes: 0, mensaje: "sin pendientes" });

    let enviados = 0, errores = 0;
    for (const f of filas) {
      const bajaUrl = `${SUPA}/functions/v1/webinar-baja?id=${f.id}`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: [f.email],
            reply_to: "contacto@firmavb.cl",
            subject: "Una invitación entre proveedores del Estado",
            html: html(f.nombre, bajaUrl),
            headers: { "List-Unsubscribe": `<${bajaUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          }),
        });
        if (r.ok) {
          await sb.from("webinar_invitacion").update({ estado: "enviado", enviado_en: new Date().toISOString() }).eq("id", f.id);
          enviados++;
        } else {
          const txt = (await r.text()).slice(0, 300);
          await sb.from("webinar_invitacion").update({ estado: "error", intentos: 0, error: `${r.status}: ${txt}` }).eq("id", f.id);
          errores++;
        }
      } catch (e) {
        await sb.from("webinar_invitacion").update({ estado: "error", error: String((e as Error)?.message) }).eq("id", f.id);
        errores++;
      }
      // Pausa breve entre correos (ritmo humano, mejor reputación).
      await new Promise((res) => setTimeout(res, 800));
    }

    const { count } = await sb.from("webinar_invitacion").select("id", { count: "exact", head: true }).eq("campana", campana).eq("estado", "pendiente");
    return json({ ok: true, enviados, errores, restantes: count ?? null });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
