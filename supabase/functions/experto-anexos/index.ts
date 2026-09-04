// Experto Plus — completa los anexos de una licitación con los datos reales de la empresa.
// Requiere: plan plus (o suscripción de cliente), ficha de empresa y documentos obligatorios
// completos (experto_plus_checklist) y las bases subidas (bases_licitacion) con anexos.
// Entrega borradores en Markdown: el cliente revisa, firma y sube la oferta él mismo.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELOS = [Deno.env.get("GEMINI_MODEL_INFORME"), "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.5-flash-lite"].filter(Boolean) as string[];
const NOMBRES: Record<string, string> = {
  razon_social: "razón social", rut_empresa: "RUT de la empresa", direccion: "dirección", giros: "giros",
  representante_nombre: "nombre del representante legal", representante_rut: "RUT del representante legal",
  carpeta_tributaria: "carpeta tributaria", vigencia_poderes: "certificado de vigencia de poderes", cedula_representante: "cédula del representante",
};

function rolYSub(auth: string): { role: string; sub: string | null } {
  try { const p = JSON.parse(atob(auth.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return { role: p.role ?? "", sub: p.sub ?? null }; }
  catch { return { role: "", sub: null }; }
}

const SYS = `Eres el Experto FirmaVB. Rellenas los ANEXOS de unas bases de licitación chilena con los DATOS DE LA EMPRESA, con el mismo estándar de los formatos oficiales de ChileCompra (Dirección de Compras y Contratación Pública, bases tipo): un documento por anexo, listo para pasar a Word, imprimir y firmar. Reglas:
- Un bloque por anexo, en este orden: "# ANEXO N° X" seguido del título exacto de las bases; debajo "Licitación ID [código] – [nombre]" y "Organismo: [comprador]"; si el anexo es solo para un caso, indícalo bajo el título: "(solo si postula en Unión Temporal de Proveedores)" o "(solo categoría X)".
- Cuando el anexo lo pida o sea de identificación, una tabla Markdown IDENTIFICACIÓN DEL OFERENTE con filas: Razón social | RUT | Domicilio | Comuna / Región | Correo electrónico | Teléfono | Nombre del representante legal | RUT del representante legal.
- Cuerpo con el texto exacto que exige el anexo: declaraciones juradas en primera persona del representante legal con la redacción de las bases (inhabilidades art. 4 Ley 19.886, no tener condenas, deudas previsionales, conocimiento y aceptación de bases, etc.); ofertas económicas o técnicas como tabla Markdown con las columnas que pidan; experiencia como tabla con las columnas que pidan.
- Cierre de cada anexo con estas líneas: "______________________________", "Firma del representante legal", "Nombre: [nombre]", "RUT: [rut]", "Fecha: [[FECHA]]"; si las bases lo exigen para UTP, agrega "Firma de cada integrante / apoderado de la UTP".
- Completa con los datos entregados exactamente como están. Lo que NO esté (precio, plazo, experiencia específica, garantías, firmas, fechas, montos) déjalo como campo [[EN MAYÚSCULAS]] y nunca lo inventes.
- Respeta numeración, títulos y orden de los anexos de las bases. Separa cada anexo con una línea "---".
- Al final agrega "## Documentos que debes adjuntar" con la lista que piden las bases, marcando cuáles ya están en el repositorio de FirmaVB (te lo indicamos) y cuáles faltan, y "## Antes de subir" con 3 a 5 verificaciones concretas (firma del representante, fecha, vigencia de certificados, coherencia de montos). Español chileno: formal dentro de los anexos, directo en las notas.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const { role, sub } = rolYSub(req.headers.get("Authorization") ?? "");
    const body = await req.json().catch(() => ({}));
    const userId = role === "authenticated" ? sub : role === "service_role" ? (body.user_id ?? null) : null;
    if (!userId) return json({ error: "login", mensaje: "Inicia sesión en FirmaVB para completar anexos." }, 401);
    const codigo = String(body.codigo ?? "").trim().toUpperCase();
    if (!/^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}$/.test(codigo)) return json({ error: "codigo", mensaje: "Indica el ID de la licitación (ej. 2699-35-LE26)." }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Plan
    const { data: uso } = await sb.rpc("experto_uso_mes", { p_user_id: userId, p_huella: "x" });
    const plan = String(uso?.[0]?.plan ?? "free");
    const { data: cli } = await sb.from("clientes").select("id, empresa_nombre, rut, direccion, telefono, email, region, giros, representante_nombre, representante_rut, plan, activo").eq("user_id", userId).maybeSingle();
    // Plus pagado, o suscripción FirmaVB ERP (incluye todo).
    const conPlus = plan === "plus" || (cli?.activo && ["pro", "business", "enterprise"].includes(String(cli?.plan)));
    if (!conPlus) {
      return json({ error: "plus", mensaje: "Completar anexos es parte del Experto Plus ($100.000 por 30 días) o del plan FirmaVB ERP.", plan }, 402);
    }

    // 2. Checklist de datos y documentos
    const { data: chk } = await sb.rpc("experto_plus_checklist", { p_user_id: userId });
    const faltan = (chk ?? []).filter((c: any) => c.obligatorio && !c.listo).map((c: any) => NOMBRES[c.item] ?? c.item);
    if (faltan.length) return json({ error: "datos", mensaje: "Antes de completar anexos, falta en Mi empresa: " + faltan.join(", ") + ".", faltan }, 428);
    const { data: docs } = await sb.from("cliente_documentos").select("tipo, nombre").eq("cliente_id", cli!.id);

    // 3. Bases con anexos
    const { data: bases } = await sb.rpc("experto_bases_texto", { p_codigo: codigo });
    const secciones: any[] = (bases ?? []).flatMap((b: any) => Array.isArray(b.secciones) ? b.secciones : []);
    const anexos = secciones.filter((s) => /anexo|formulario|declaraci[oó]n jurada|identificaci[oó]n del oferente|oferta econ[oó]mica/i.test(String(s.titulo) + " " + String(s.texto).slice(0, 300)));
    if (!bases?.length) return json({ error: "sin_bases", mensaje: `No hay bases cargadas para ${codigo}. Súbelas primero con "Subir bases (PDF)".` }, 404);
    if (!anexos.length) return json({ error: "sin_anexos", mensaje: "Las bases cargadas no traen anexos ni formularios reconocibles. Si vienen en un PDF aparte, súbelo también como bases." }, 404);
    const textoAnexos = anexos.map((s) => `## ${s.titulo}\n${s.texto}`).join("\n\n").slice(0, 60_000);
    const { data: ficha } = await sb.rpc("experto_ficha_licitacion", { p_codigo: codigo });

    // 4. Gemini
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "sin_ia" }, 500);
    const datos = `DATOS DE LA EMPRESA (FirmaVB):
Razón social: ${cli!.empresa_nombre} | RUT: ${cli!.rut} | Dirección: ${cli!.direccion} | Región: ${cli!.region ?? "s/i"}
Giros: ${cli!.giros} | Correo: ${cli!.email ?? "s/i"} | Teléfono: ${cli!.telefono ?? "s/i"}
Representante legal: ${cli!.representante_nombre} | RUT representante: ${cli!.representante_rut}
Documentos ya en el repositorio: ${(docs ?? []).map((d: any) => d.tipo.replace(/_/g, " ")).join(", ") || "ninguno"}

LICITACIÓN ${codigo}: ${ficha?.nombre ?? ""} | Organismo: ${ficha?.institucion ?? ""} | Cierre: ${ficha?.fecha_cierre ?? "s/i"}

ANEXOS Y FORMULARIOS DE LAS BASES:
${textoAnexos}`;
    let contenido = "";
    for (const model of MODELOS) {
      const r = await fetch(GEMINI_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.1, max_tokens: 8000, messages: [{ role: "system", content: SYS }, { role: "user", content: datos + "\n\nCompleta todos los anexos." }] }) });
      if (!r.ok) { console.error("gemini", model, r.status); continue; }
      contenido = String((await r.json()).choices?.[0]?.message?.content ?? "").trim();
      if (contenido) break;
    }
    if (!contenido) return json({ error: "ia_no_disponible" }, 502);
    const faltantes = [...new Set(contenido.match(/\[\[[^\]]+\]\]/g) ?? [])];
    const { data: fila } = await sb.from("experto_anexos").insert({ user_id: userId, codigo, contenido, faltantes }).select("id").single();
    return json({ ok: true, id: fila?.id, codigo, contenido, faltantes, anexos_detectados: anexos.length, ms: Date.now() - t0 });
  } catch (e) { return json({ error: String((e as Error)?.message ?? e) }, 500); }
});
