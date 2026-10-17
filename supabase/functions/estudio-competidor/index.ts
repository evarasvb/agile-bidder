// "Modo estudio de la competencia" (pedido de Evaristo): análisis de IA sobre
// UN proveedor competidor — fortalezas, debilidades y cómo competirle. Mismo
// patrón que postulacion-analisis (hechos reales -> Gemini una vez -> se
// cachea), pero los hechos los junta proveedor_zoom() en vez de armarse acá.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

interface Estudio { resumen: string; fortalezas: string[]; debilidades: string[]; recomendacion: string }

async function pedirEstudioIA(hechos: Record<string, unknown>): Promise<Estudio | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) return null;
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const candidatos = [Deno.env.get('GEMINI_MODEL') || '', 'gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-flash-latest'].filter(Boolean);

  const systemPrompt = `Eres un analista comercial experto en licitaciones y compras públicas de Mercado Público (Chile).
Te paso los hechos reales de UN proveedor competidor: identidad, tendencia mensual, productos que vende, instituciones que le compran, qué parte de su negocio es trato directo (trato_directo: compras sin licitación abierta — si ordenes_td/monto_td es alto respecto al total, dilo como señal, no lo sobre-interpretes como irregular por sí solo), su historial en licitaciones (cuántas veces ofertó, cuántas ganó), "cara_a_cara_contra_nosotros": las licitaciones donde ESTE competidor y NOSOTROS (el usuario) ofertamos ambos, con quién ganó cada una — este es el dato más valioso para explicar por qué perdemos o ganamos contra él específicamente (si total es 0, dilo explícitamente en vez de inventar un historial); y "negocios_que_dejamos_pasar_y_el_gano": licitaciones de nuestro propio rubro (por palabras clave de nuestras propias licitaciones) que NO postulamos y que este competidor sí se adjudicó — si la lista no está vacía, menciónala como oportunidad concreta que se nos escapó.
Escribe un estudio breve para que otro proveedor sepa a qué se enfrenta. Usa SIEMPRE condicional ("probablemente", "parece") cuando el dato no es 100% certero. No inventes nada que no esté en los hechos: si falta un dato dilo en vez de inventarlo.
Responde SOLO un JSON válido, sin texto extra, con esta forma EXACTA:
{ "resumen": "3-5 frases: quién es, en qué rubro compite, qué tan grande/activo es", "fortalezas": ["punto corto 1", "..."], "debilidades": ["punto corto 1", "..."], "recomendacion": "1-2 frases: cómo competirle (precio, nicho, instituciones donde no es fuerte, etc.)" }
fortalezas y debilidades: máximo 4 cada una, frases cortas (menos de 14 palabras). Si no hay suficiente evidencia para debilidades, dilo ahí mismo ("sin señales claras de debilidad con estos datos") en vez de inventar una.`;

  const userPrompt = `Hechos:\n${JSON.stringify(hechos, null, 2)}`;

  for (const model of candidatos) {
    try {
      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3, max_tokens: 900 }),
      });
      if (!resp.ok) continue;
      const j = await resp.json();
      const content = j.choices?.[0]?.message?.content;
      if (!content) continue;
      const limpio = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(limpio);
      if (typeof parsed?.resumen !== 'string' || !parsed.resumen.trim()) continue;
      return {
        resumen: parsed.resumen.trim().slice(0, 1200),
        fortalezas: Array.isArray(parsed.fortalezas) ? parsed.fortalezas.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [],
        debilidades: Array.isArray(parsed.debilidades) ? parsed.debilidades.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [],
        recomendacion: typeof parsed.recomendacion === 'string' ? parsed.recomendacion.trim().slice(0, 400) : '',
      };
    } catch (_e) { /* siguiente modelo */ }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Falta autenticación' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: 'No autorizado' }, 401);

    const body = await req.json().catch(() => ({})) as { nombre?: string; rut?: string };
    const nombre = (body.nombre || '').trim();
    if (!nombre) return json({ error: 'Falta el nombre del competidor' }, 400);
    const rutInput = (body.rut || '').trim() || null;

    const { data: ownerId, error: errOwnerId } = await supabase.rpc('cliente_owner_id');
    if (errOwnerId) throw errOwnerId;
    if (!ownerId) return json({ error: 'Tu cuenta todavía se está configurando, intenta de nuevo en un momento' }, 409);
    const clienteId = ownerId as string;

    const { data: zoom, error: errZoom } = await supabase.rpc('proveedor_zoom', { p_nombre: nombre, p_rut: rutInput });
    if (errZoom) throw errZoom;
    const hechos = (zoom as any)?.identidad;
    if (!hechos?.rut_norm) return json({ error: 'No encontramos RUT para este proveedor — no hay suficientes datos para estudiarlo' }, 404);

    const { data: h2h } = await supabase.rpc('proveedor_head_to_head', { p_rut_competidor: hechos.rut_norm });
    const { data: perdidas } = await supabase.rpc('oportunidades_perdidas_ante', { p_rut_competidor: hechos.rut_norm });
    const hechosCompletos = {
      ...(zoom as Record<string, unknown>),
      cara_a_cara_contra_nosotros: h2h ?? null,
      negocios_que_dejamos_pasar_y_el_gano: perdidas ?? [],
    };

    const estudio = await pedirEstudioIA(hechosCompletos);
    if (!estudio) return json({ error: 'La IA no está disponible ahora, intenta de nuevo en un rato' }, 503);

    const { data: guardado, error: errUpsert } = await supabase
      .from('estudio_competidor')
      .upsert({
        cliente_id: clienteId,
        proveedor_rut: hechos.rut_norm,
        proveedor_nombre: hechos.nombre || nombre,
        resumen: estudio.resumen,
        fortalezas: estudio.fortalezas,
        debilidades: estudio.debilidades,
        recomendacion: estudio.recomendacion,
        generado_en: new Date().toISOString(),
      }, { onConflict: 'cliente_id,proveedor_rut' })
      .select()
      .maybeSingle();
    if (errUpsert) throw errUpsert;

    return json(guardado);
  } catch (e) {
    console.error('estudio-competidor error:', e);
    return json({ error: 'Error generando el estudio' }, 500);
  }
});
