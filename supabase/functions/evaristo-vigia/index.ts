// Vigía de cambios: cuando una licitación o compra ágil con la que un cliente ya
// interactuó cambia (se mueve el cierre, cambia el presupuesto/estado, o le
// agregan un anexo nuevo), Don Evaristo estudia el impacto y le avisa —por email
// y en su memoria de chat— antes de que el cliente se dé cuenta solo.
// Corre por cron (evaristo-vigia, cada 10 min) sobre public.licitaciones_cambios,
// que llenan los triggers registrar_cambio_licitacion_bi/registrar_cambio_compra_agil/registrar_cambio_adjunto.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchClaudeComoOpenAI } from "../_shared/claudeFallback.ts";
import { guardarAvisoProactivo } from "../_shared/evaristoMemoria.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELOS = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];
const CLAUDE_MODELO = "claude-haiku-4-5-20251001";

const NOMBRE_CAMPO: Record<string, string> = {
  fecha_cierre: "la fecha de cierre",
  fecha_cierre_segundo_llamado: "la fecha de cierre del segundo llamado",
  monto_estimado: "el presupuesto/monto estimado",
  estado: "el estado del proceso",
  anexo_nuevo: "hay un anexo nuevo",
};

interface Cambio {
  id: string;
  tipo_proceso: "licitacion" | "compra_agil";
  codigo: string;
  campo: string;
  valor_anterior: string | null;
  valor_nuevo: string | null;
}

function textoCambios(cambios: Cambio[]): string {
  return cambios.map((c) => {
    if (c.campo === "anexo_nuevo") return `- Se agregó un anexo/adjunto nuevo: "${c.valor_nuevo}".`;
    const nombre = NOMBRE_CAMPO[c.campo] ?? c.campo;
    return `- Cambió ${nombre}: de "${c.valor_anterior ?? "s/i"}" a "${c.valor_nuevo ?? "s/i"}".`;
  }).join("\n");
}

async function generarAnalisis(ficha: { codigo: string; nombre: string | null; organismo: string | null }, cambios: Cambio[]): Promise<string> {
  const sysPrompt = `Eres Don Evaristo, 17 años vendiéndole al Estado chileno por Mercado Público. Le avisas a un proveedor, con serenidad y experiencia, que algo cambió en un proceso al que le está poniendo ojo. Habla de tú, cercano, sin alarmismo pero sin minimizar si el cambio importa de verdad. Responde SOLO con lo que dice la lista de cambios entregada, no inventes hechos nuevos ni supongas causas. Estructura: 1) qué cambió, en una frase clara; 2) qué significa para su postulación (ej: hay que ajustar el plazo, revisar el anexo nuevo, recalcular el precio); 3) el siguiente paso concreto que darías hoy. Máximo 80 palabras, sin saludos ni firma.`;
  const userMsg = `Proceso ${ficha.codigo}${ficha.nombre ? `: "${ficha.nombre}"` : ""}${ficha.organismo ? ` (${ficha.organismo})` : ""}.\nCambios detectados:\n${textoCambios(cambios)}`;
  const messages = [{ role: "system", content: sysPrompt }, { role: "user", content: userMsg }];

  const key = Deno.env.get("GEMINI_API_KEY");
  if (key) {
    for (const mdl of MODELOS) {
      try {
        const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: mdl, messages, temperature: 0.4, max_tokens: 300, reasoning_effort: "low" }),
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          const data = await r.json();
          const texto = data?.choices?.[0]?.message?.content;
          if (texto) return String(texto).trim();
        }
      } catch { /* probar el siguiente modelo */ }
    }
  }
  // Respaldo determinista (sin IA): la lista de cambios tal cual, sin redactar.
  const claude = await fetchClaudeComoOpenAI(messages, { modelo: CLAUDE_MODELO, maxTokens: 300, temperature: 0.4 }).catch(() => null);
  if (claude?.resp) {
    try {
      const texto = await claude.resp.text();
      const partes = texto.split("\n").filter((l) => l.startsWith("data:") && !l.includes("[DONE]"))
        .map((l) => { try { return JSON.parse(l.slice(5).trim())?.choices?.[0]?.delta?.content ?? ""; } catch { return ""; } }).join("");
      if (partes.trim()) return partes.trim();
    } catch { /* usar respaldo */ }
  }
  return `Hubo novedades en ${ficha.codigo}:\n${textoCambios(cambios)}\nRevísalo antes de seguir con tu postulación.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const t0 = Date.now();
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Solo el cron (que llama con la service-role key, ver vault.decrypted_secrets en
    // la migración) puede disparar este escaneo: revisa todo el sistema, gasta cuota
    // de IA y manda notificaciones a clientes ajenos al llamador — ningún cliente
    // autenticado normal debe poder ejecutarlo por su cuenta.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token || token !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "no_autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: pendientes, error } = await sb
      .from("licitaciones_cambios")
      .select("id, tipo_proceso, codigo, campo, valor_anterior, valor_nuevo")
      .eq("procesado", false)
      .order("codigo")
      .limit(200);
    if (error) throw error;
    if (!pendientes?.length) {
      return new Response(JSON.stringify({ ok: true, codigos: 0, avisos: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Agrupar por código: varios cambios del mismo proceso se avisan juntos, en un solo análisis.
    const porCodigo = new Map<string, Cambio[]>();
    for (const c of pendientes as Cambio[]) {
      const arr = porCodigo.get(c.codigo) ?? [];
      arr.push(c);
      porCodigo.set(c.codigo, arr);
    }

    let avisos = 0;
    for (const [codigo, cambios] of porCodigo) {
      const idsProcesados = cambios.map((c) => c.id);
      // Si algo del bloque falla (RPC, ficha, IA), el catch de abajo deja procesado=false
      // para que el próximo cron reintente este código en vez de perder el aviso.
      let ok = true;
      try {
        const { data: interesados } = await sb.rpc("vigia_clientes_interesados", { p_codigo: codigo });
        if (!interesados?.length) {
          await sb.from("licitaciones_cambios").update({ procesado: true }).in("id", idsProcesados);
          continue;
        }

        // Las licitaciones viven en licitaciones_bi (la tabla que de verdad alimenta
        // matches/bases/adjuntos/Libro del Experto); las compras ágiles no tienen
        // tabla "_bi", siguen en compras_agiles. Ver 20260926151500_vigia_cambios_usa_licitaciones_bi.sql.
        const esCompraAgil = cambios[0].tipo_proceso === "compra_agil";
        const tabla = esCompraAgil ? "compras_agiles" : "licitaciones_bi";
        const colOrganismo = esCompraAgil ? "nombre_organismo" : "institucion_nombre";
        const { data: ficha } = await sb.from(tabla).select(`codigo, nombre, ${colOrganismo}`).eq("codigo", codigo).maybeSingle();
        const fichaTxt = { codigo, nombre: (ficha as any)?.nombre ?? null, organismo: (ficha as any)?.[colOrganismo] ?? null };

        const analisis = await generarAnalisis(fichaTxt, cambios);

        for (const cli of interesados as Array<{ cliente_id: string; email: string; empresa_nombre: string | null }>) {
          try {
            // Memoria del chat (busca el user_id real del cliente para escribir con su RLS vía service role).
            const { data: clienteRow } = await sb.from("clientes").select("user_id").eq("id", cli.cliente_id).maybeSingle();
            if (clienteRow?.user_id) {
              await guardarAvisoProactivo(sb, {
                userId: clienteRow.user_id,
                canal: "vigia",
                titulo: `Cambios en ${codigo}`,
                contenido: analisis,
                meta: { codigo, campos: cambios.map((c) => c.campo) },
              });
            }
            await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
              body: JSON.stringify({
                cliente_id: cli.cliente_id,
                tipo: "cambio_licitacion",
                data: {
                  licitacion_id: codigo,
                  licitacion_codigo: codigo,
                  licitacion_titulo: fichaTxt.nombre ?? codigo,
                  organismo: fichaTxt.organismo ?? undefined,
                  resumen: analisis,
                },
              }),
            });
            avisos++;
          } catch (e) {
            console.error("evaristo-vigia aviso", codigo, cli.cliente_id, String(e).slice(0, 160));
          }
        }
      } catch (e) {
        console.error("evaristo-vigia codigo", codigo, String(e).slice(0, 160));
        ok = false;
      }
      if (ok) {
        await sb.from("licitaciones_cambios").update({ procesado: true }).in("id", idsProcesados);
      }
    }

    return new Response(JSON.stringify({ ok: true, codigos: porCodigo.size, avisos, ms: Date.now() - t0 }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: cors });
  }
});
