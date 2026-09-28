// Aviso importante por WhatsApp (Meta WhatsApp Cloud API) con una plantilla
// aprobada. Lo llama send-notification para los únicos avisos que salen de la
// plataforma: adjudicación ganada y novedades de FirmaVB. Solo service_role.
// Body: { cliente_id?: string, telefono?: string, empresa?: string, texto: string }
// Variables de entorno (Supabase → Edge Functions → Secrets):
//   WHATSAPP_TOKEN      token permanente del sistema (Meta Business)
//   WHATSAPP_PHONE_ID   ID del número de teléfono de la cuenta de WhatsApp Business
//   WHATSAPP_PLANTILLA  nombre de la plantilla aprobada (por defecto firmavb_aviso)
//   WHATSAPP_IDIOMA     código de idioma de la plantilla (por defecto es)
// Plantilla esperada (categoría Utilidad, 2 variables en el cuerpo):
//   "Hola {{1}}, {{2}} Entra a firmavb.cl para ver el detalle."
// Sin las variables configuradas responde { ok:false, motivo:'no_configurado' } sin fallar.
import { createClient } from "jsr:@supabase/supabase-js@2";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function rol(auth: string): string {
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (token && token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return "service_role";
  try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role ?? ""; } catch { return ""; }
}

// Número chileno a formato internacional sin "+": 9 dígitos → 569XXXXXXXX; acepta +56 9 ....
export function normalizarTelefono(t: string | null | undefined): string | null {
  const d = String(t ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 9 && d.startsWith("9")) return "56" + d;
  if (d.length === 8) return "569" + d;
  if (d.length === 11 && d.startsWith("569")) return d;
  if (d.length >= 10 && d.length <= 15) return d;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (rol(req.headers.get("authorization") ?? "") !== "service_role") return json({ error: "no autorizado" }, 401);

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  const plantilla = Deno.env.get("WHATSAPP_PLANTILLA") || "firmavb_aviso";
  const idioma = Deno.env.get("WHATSAPP_IDIOMA") || "es";

  const body = await req.json().catch(() => ({}));
  const texto = String(body.texto ?? "").trim();
  if (!texto) return json({ ok: false, motivo: "sin_texto" }, 400);

  let telefono: string | null = normalizarTelefono(body.telefono);
  let empresa: string = String(body.empresa ?? "").trim();
  if (!telefono && body.cliente_id) {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: c } = await sb.from("clientes").select("whatsapp, empresa_nombre").eq("id", body.cliente_id).maybeSingle();
    telefono = normalizarTelefono(c?.whatsapp);
    empresa = empresa || String(c?.empresa_nombre ?? "");
  }
  if (!telefono) return json({ ok: false, motivo: "sin_whatsapp" });
  if (!token || !phoneId) return json({ ok: false, motivo: "no_configurado" });

  // Las variables de plantilla no admiten saltos de línea ni más de ~1000 caracteres.
  const limpio = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 900);
  const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: telefono,
      type: "template",
      template: {
        name: plantilla,
        language: { code: idioma },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: limpio(empresa || "proveedor") },
            { type: "text", text: limpio(texto) },
          ],
        }],
      },
    }),
    signal: AbortSignal.timeout(10000),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) } as Response));

  const cuerpo = await r.text().catch(() => "");
  if (!r.ok) {
    console.error("enviar-whatsapp", r.status, cuerpo.slice(0, 300));
    return json({ ok: false, motivo: "meta", status: r.status, detalle: cuerpo.slice(0, 300) }, 502);
  }
  let id: string | null = null;
  try { id = JSON.parse(cuerpo)?.messages?.[0]?.id ?? null; } catch { /* sin id */ }
  return json({ ok: true, id, telefono });
});
