// Post-mortem de IA para una oportunidad del histórico de Postulaciones
// (pedido de Evaristo): por qué se ganó, por qué se perdió, o (si no se
// postuló) quién se la adjudicó y qué tan competitivos hubiéramos sido.
// Mismo patrón que veredicto-oportunidad (resumen de hechos reales -> IA ->
// se cachea en una tabla), pero sin exigir plan Pro: esto es parte del
// histórico normal de Postulaciones, no un análisis previo a postular.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(b: unknown, s = 200) { return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } }); }

type Tipo = 'licitacion' | 'compra_agil';
type Resultado = 'ganada' | 'perdida' | 'sin_tomar';

interface Analisis { resumen: string; factores: string[] }

// Mismos hechos que ya se le muestran al cliente en el histórico/detalle:
// organismo, montos, cobertura de inventario, comprador. Se arma una vez acá
// para no tener que pedirle a la IA que adivine con menos información de la
// que el propio cliente ya tiene a la vista.
async function armarHechos(supabase: ReturnType<typeof createClient>, tipo: Tipo, codigo: string, clienteId: string, rutLimpio: string | null, resultado: Resultado) {
  const PISO_MATCH = 40;
  const tablaMatches = tipo === 'compra_agil' ? 'ca_item_matches' : 'lic_item_matches';
  const columnaCodigo = tipo === 'compra_agil' ? 'compra_agil_codigo' : 'licitacion_codigo';

  let nombre = ''; let organismo = ''; let rutOrganismo: string | null = null;
  let monto: number | null = null; let fechaCierre: string | null = null; let descripcion: string | null = null;
  let itemsCount = 0;

  if (tipo === 'compra_agil') {
    const { data } = await supabase.from('compras_agiles')
      .select('nombre, nombre_organismo, organismo_rut, monto_estimado, fecha_cierre, descripcion, compras_agiles_items(id)')
      .eq('codigo', codigo).maybeSingle();
    if (!data) return null;
    nombre = (data as any).nombre || 'Sin título';
    organismo = (data as any).nombre_organismo || 'Sin organismo';
    rutOrganismo = (data as any).organismo_rut || null;
    monto = (data as any).monto_estimado ?? null;
    fechaCierre = (data as any).fecha_cierre ?? null;
    descripcion = (data as any).descripcion ?? null;
    itemsCount = ((data as any).compras_agiles_items || []).length;
  } else {
    const { data } = await supabase.from('licitaciones_bi')
      .select('nombre, institucion_nombre, institucion_rut, presupuesto_estimado, fecha_cierre, descripcion, licitaciones_bi_items(id)')
      .eq('codigo', codigo).maybeSingle();
    if (!data) return null;
    nombre = (data as any).nombre || 'Sin título';
    organismo = (data as any).institucion_nombre || 'Sin organismo';
    rutOrganismo = (data as any).institucion_rut || null;
    monto = (data as any).presupuesto_estimado ?? null;
    fechaCierre = (data as any).fecha_cierre ?? null;
    descripcion = (data as any).descripcion ?? null;
    itemsCount = ((data as any).licitaciones_bi_items || []).length;
  }

  const { data: matchesRaw } = await supabase.from(tablaMatches)
    .select('nombre_solicitado, nombre_producto, score')
    .eq(columnaCodigo, codigo).eq('cliente_id', clienteId).gte('score', PISO_MATCH);
  const matches = (matchesRaw || []) as { nombre_solicitado: string | null; nombre_producto: string | null; score: number | null }[];
  const itemsMatched = matches.filter((m) => m.nombre_producto).length;
  const coberturaInventario = itemsCount > 0 ? Math.round((itemsMatched / itemsCount) * 100) : null;

  // Proceso OCDS: solo para licitaciones (compras ágiles no publican
  // oferentes/adjudicación por API pública — mismo límite que ya documenta
  // 20261002000000_historico_postulaciones.sql).
  let numOferentes: number | null = null;
  let ganadorNombre: string | null = null;
  let montoAdjudicado: number | null = null;
  if (tipo === 'licitacion') {
    const { data: proceso } = await supabase.from('ocds_procesos')
      .select('num_oferentes, adjudicatarios, monto_adjudicado, estado_award')
      .eq('codigo', codigo).maybeSingle();
    if (proceso) {
      numOferentes = (proceso as any).num_oferentes ?? null;
      montoAdjudicado = (proceso as any).monto_adjudicado ?? null;
      const adj = (proceso as any).adjudicatarios;
      if (Array.isArray(adj)) ganadorNombre = adj.map((a: any) => a?.nombre).filter(Boolean).join(', ') || null;
    }
  }

  let scorePago: number | null = null; let diasPromedioPago: number | null = null;
  const { data: institucion } = rutOrganismo
    ? await supabase.from('instituciones').select('rut, pago_promedio_dias').eq('rut', rutOrganismo).maybeSingle()
    : await supabase.from('instituciones').select('rut, pago_promedio_dias').ilike('nombre', `%${organismo}%`).maybeSingle();
  if (institucion) {
    diasPromedioPago = (institucion as any).pago_promedio_dias ?? null;
    const { data: pago } = await supabase.from('conducta_pago')
      .select('porcentaje_morosidad, dias_promedio_pago')
      .eq('rut_institucion', (institucion as any).rut)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (pago) {
      scorePago = (pago as any).porcentaje_morosidad != null ? Math.round(100 - (pago as any).porcentaje_morosidad) : null;
      diasPromedioPago = (pago as any).dias_promedio_pago ?? diasPromedioPago;
    }
  }

  // Si la postuló (ganada/perdida), sus propias notas del pipeline dan
  // contexto que ningún dato público tiene (ej. "cotizamos muy justo").
  let notasPropias: string | null = null;
  if (resultado !== 'sin_tomar') {
    const tipoPipeline = tipo === 'compra_agil' ? 'compra_agil' : 'licitacion';
    const { data: item } = await supabase.from('pipeline')
      .select('notas, monto_estimado')
      .eq('oportunidad_id', codigo).eq('oportunidad_tipo', tipoPipeline).maybeSingle();
    if (item) notasPropias = (item as any).notas || null;
  }

  const { data: tasaExito } = await supabase.rpc('pipeline_tasa_exito_equipo');

  return {
    resultado,
    nombre, organismo, monto, fecha_cierre: fechaCierre,
    descripcion: descripcion ? descripcion.slice(0, 500) : null,
    items_count: itemsCount, items_matched: itemsMatched, cobertura_inventario_pct: coberturaInventario,
    num_oferentes: numOferentes, ganador_nombre: ganadorNombre, monto_adjudicado: montoAdjudicado,
    comprador: { score_pago_0_100: scorePago, dias_promedio_pago: diasPromedioPago },
    notas_propias: notasPropias,
    tasa_exito_equipo_pct: (tasaExito as number | null) ?? null,
    somos_oferente_identificado: !!rutLimpio,
  };
}

async function pedirAnalisisIA(hechos: Record<string, unknown>): Promise<Analisis | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) return null;
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const candidatos = [Deno.env.get('GEMINI_MODEL') || '', 'gemini-3.6-flash', 'gemini-2.0-flash', 'gemini-flash-latest'].filter(Boolean);

  const systemPrompt = `Eres un analista comercial experto en licitaciones y compras públicas de Mercado Público (Chile).
Te paso los hechos de un proceso ya resuelto (resultado: "ganada", "perdida" o "sin_tomar" = no se postuló).
Explica en 2-4 frases concretas y directas, en español, por qué probablemente se dio ese resultado. Usa SIEMPRE condicional ("probablemente", "posiblemente") cuando el dato no es 100% certero (ej. no sabemos el precio de la competencia).
- Si "ganada": qué jugó a favor (cobertura de inventario, pocos oferentes, buen comprador).
- Si "perdida": compara contra quién ganó si el dato está, y qué pudo faltar (cobertura baja, muchos competidores).
- Si "sin_tomar": nombra quién ganó si se sabe, y evalúa qué tan competitivos hubiéramos sido según la cobertura de inventario.
Responde SOLO un JSON válido, sin texto extra, con esta forma EXACTA:
{ "resumen": "2 a 4 frases", "factores": ["factor corto 1", "factor corto 2", "..."] }
factores: máximo 4, frases muy cortas (menos de 12 palabras), concretas. Si faltan datos clave dilo en el resumen en vez de inventar.`;

  const userPrompt = `Hechos:\n${JSON.stringify(hechos, null, 2)}`;

  for (const model of candidatos) {
    try {
      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], temperature: 0.3, max_tokens: 600 }),
      });
      if (!resp.ok) continue;
      const j = await resp.json();
      const content = j.choices?.[0]?.message?.content;
      if (!content) continue;
      const limpio = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(limpio);
      if (typeof parsed?.resumen !== 'string' || !parsed.resumen.trim()) continue;
      return {
        resumen: parsed.resumen.trim().slice(0, 800),
        factores: Array.isArray(parsed.factores) ? parsed.factores.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [],
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

    const body = await req.json().catch(() => ({})) as { tipo?: string; codigo?: string; resultado?: string };
    const tipo = body.tipo;
    const codigo = (body.codigo || '').trim();
    const resultado = body.resultado;
    if ((tipo !== 'licitacion' && tipo !== 'compra_agil') || !codigo) return json({ error: 'Falta tipo o codigo válidos' }, 400);
    if (resultado !== 'ganada' && resultado !== 'perdida' && resultado !== 'sin_tomar') return json({ error: 'Falta resultado válido' }, 400);

    const { data: ownerId, error: errOwnerId } = await supabase.rpc('cliente_owner_id');
    if (errOwnerId) throw errOwnerId;
    if (!ownerId) return json({ error: 'Tu cuenta todavía se está configurando, intenta de nuevo en un momento' }, 409);
    const clienteId = ownerId as string;

    const { data: cliente } = await supabase.from('clientes').select('rut').eq('id', clienteId).maybeSingle();
    const { data: rutLimpio } = (cliente as any)?.rut ? await supabase.rpc('rut_limpio', { p: (cliente as any).rut }) : { data: null };

    const hechos = await armarHechos(supabase, tipo, codigo, clienteId, rutLimpio as string | null, resultado);
    if (!hechos) return json({ error: 'Oportunidad no encontrada' }, 404);

    const analisis = await pedirAnalisisIA(hechos);
    if (!analisis) return json({ error: 'La IA no está disponible ahora, intenta de nuevo en un rato' }, 503);

    const { data: guardado, error: errUpsert } = await supabase
      .from('postulacion_analisis')
      .upsert({
        cliente_id: clienteId, tipo, codigo, resultado,
        resumen: analisis.resumen, factores: analisis.factores,
        generado_en: new Date().toISOString(),
      }, { onConflict: 'cliente_id,tipo,codigo' })
      .select()
      .maybeSingle();
    if (errUpsert) throw errUpsert;

    return json(guardado);
  } catch (e) {
    console.error('postulacion-analisis error:', e);
    return json({ error: 'Error generando el análisis' }, 500);
  }
});
