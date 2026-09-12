// FirmaVB — baja de la invitación al webinar (unsubscribe). Público: el enlace va en cada
// correo. GET ?id=<uuid> marca la fila como 'baja' para que no reciba más invitaciones.
import { createClient } from "jsr:@supabase/supabase-js@2";

const pagina = (titulo: string, texto: string) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
   <title>${titulo}</title>
   <div style="font-family:system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 24px;text-align:center;color:#1e293b">
     <div style="font-size:40px">✅</div>
     <h1 style="font-size:20px;margin:12px 0 8px">${titulo}</h1>
     <p style="color:#475569;line-height:1.5">${texto}</p>
     <p style="margin-top:24px"><a href="https://firmavb.cl" style="color:#1E40AF">Ir a FirmaVB</a></p>
   </div>`,
  { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
);

Deno.serve(async (req) => {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return pagina("Enlace inválido", "No pudimos identificar tu correo. Si quieres darte de baja, respóndenos y lo hacemos nosotros.");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await sb.from("webinar_invitacion").update({ estado: "baja" }).eq("id", id);
    return pagina("Listo, no recibirás más", "Te sacamos de la lista de invitaciones. Igual quedas invitado cuando quieras volver. ¡Gracias!");
  } catch {
    return pagina("Listo", "Procesamos tu solicitud. Si sigues recibiendo correos, respóndenos y lo arreglamos.");
  }
});
