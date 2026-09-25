import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Tipo = 'licitacion' | 'compra_agil';

interface ItemMatchRow {
  nombre_solicitado: string | null;
  cantidad: number | null;
  nombre_producto: string | null;
  precio_unitario: number | null;
  score: number | null;
}

interface Veredicto {
  recomendacion: 'ofertar' | 'revisar' | 'descartar';
  razon: string;
  puntos_favor: string[];
  puntos_contra: string[];
}

// Arma el resumen que se le manda a Gemini: mismos datos que ya se muestran
// en el detalle de la oportunidad (organismo, monto, ítems, comprador), no
// hay que salir a buscar nada nuevo — solo consolidarlo en un JSON compacto.
async function armarResumen(supabase: ReturnType<typeof createClient>, tipo: Tipo, codigo: string, clienteId: string) {
  let nombre = '';
  let organismo = '';
  let monto: number | null = null;
  let fechaCierre: string | null = null;
  let descripcion: string | null = null;
  let itemsCount = 0;

  if (tipo === 'compra_agil') {
    const { data: compra, error: errCompra } = await supabase
      .from('compras_agiles')
      .select('nombre, nombre_organismo, monto_estimado, fecha_cierre, descripcion, compras_agiles_items(id)')
      .eq('codigo', codigo)
      .maybeSingle();
    if (errCompra) throw errCompra;
    if (!compra) return null;
    nombre = (compra as any).nombre || 'Sin título';
    organismo = (compra as any).nombre_organismo || 'Sin organismo';
    monto = (compra as any).monto_estimado ?? null;
    fechaCierre = (compra as any).fecha_cierre ?? null;
    descripcion = (compra as any).descripcion ?? null;
    itemsCount = ((compra as any).compras_agiles_items || []).length;
  } else {
    const { data: lic, error: errLic } = await supabase
      .from('licitaciones_bi')
      .select('nombre, institucion_nombre, presupuesto_estimado, fecha_cierre, descripcion, licitaciones_bi_items(id)')
      .eq('codigo', codigo)
      .maybeSingle();
    if (errLic) throw errLic;
    if (!lic) return null;
    nombre = (lic as any).nombre || 'Sin título';
    organismo = (lic as any).institucion_nombre || 'Sin organismo';
    monto = (lic as any).presupuesto_estimado ?? null;
    fechaCierre = (lic as any).fecha_cierre ?? null;
    descripcion = (lic as any).descripcion ?? null;
    itemsCount = ((lic as any).licitaciones_bi_items || []).length;
  }

  // PISO_MATCH = 40: mismo piso que usa el panel de oportunidades
  // (useOportunidadesPanel.ts) para decidir qué cuenta como match real. Los
  // generadores de matches guardan filas desde 30, así que sin este filtro
  // una oportunidad con puros matches débiles (30-39%) se reportaría con
  // cobertura de inventario inflada.
  const PISO_MATCH = 40;
  const tablaMatches = tipo === 'compra_agil' ? 'ca_item_matches' : 'lic_item_matches';
  const columnaCodigo = tipo === 'compra_agil' ? 'compra_agil_codigo' : 'licitacion_codigo';
  const { data: matchesRaw, error: errMatches } = await supabase
    .from(tablaMatches)
    .select('nombre_solicitado, cantidad, nombre_producto, precio_unitario, score')
    .eq(columnaCodigo, codigo)
    .eq('cliente_id', clienteId)
    .gte('score', PISO_MATCH);
  if (errMatches) throw errMatches;
  const matches = (matchesRaw || []) as ItemMatchRow[];
  const itemsMatched = matches.filter((m) => m.nombre_producto).length;
  const cobertura = itemsCount > 0 ? Math.round((itemsMatched / itemsCount) * 100) : null;

  // Comprador: mismo organismo -> conducta de pago, igual que en el detalle.
  let scorePago: number | null = null;
  let diasPromedioPago: number | null = null;
  let totalOrdenes: number | null = null;
  // .maybeSingle() falla si el ilike matchea más de una institución (nombre
  // ambiguo); se propaga en vez de tratarlo silenciosamente como "sin
  // comprador" — eso dejaría un veredicto persistido con el dato del
  // comprador vacío sin que nada avise que en realidad había varios.
  const { data: institucion, error: errInstitucion } = await supabase
    .from('instituciones')
    .select('rut, oc_total, oc_monto_total, pago_promedio_dias')
    .ilike('nombre', `%${organismo}%`)
    .maybeSingle();
  if (errInstitucion) throw errInstitucion;
  if (institucion) {
    totalOrdenes = (institucion as any).oc_total ?? null;
    diasPromedioPago = (institucion as any).pago_promedio_dias ?? null;
    const { data: pago, error: errPago } = await supabase
      .from('conducta_pago')
      .select('porcentaje_morosidad, dias_promedio_pago')
      .eq('rut_institucion', (institucion as any).rut)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (errPago) throw errPago;
    if (pago) {
      scorePago = (pago as any).porcentaje_morosidad != null ? Math.round(100 - (pago as any).porcentaje_morosidad) : null;
      diasPromedioPago = (pago as any).dias_promedio_pago ?? diasPromedioPago;
    }
  }

  // Historial del EQUIPO (no solo de quien pide el veredicto) en el pipeline
  // — el veredicto es una fila compartida por cliente_owner_id(), así que la
  // tasa de éxito también debe serlo; si no, el dueño y un vendedor invitado
  // calculan números distintos para el mismo veredicto. La función ya deja
  // en null si hay menos de 3 casos (muestra insuficiente).
  const { data: tasaExitoEquipo, error: errTasaExito } = await supabase.rpc('pipeline_tasa_exito_equipo');
  if (errTasaExito) throw errTasaExito;
  const tasaExitoPropia = (tasaExitoEquipo as number | null) ?? null;

  const diasRestantes = fechaCierre ? Math.ceil((new Date(fechaCierre).getTime() - Date.now()) / 86400000) : null;

  return {
    nombre,
    organismo,
    monto,
    dias_restantes: diasRestantes,
    descripcion: descripcion ? descripcion.slice(0, 600) : null,
    items_count: itemsCount,
    items_matched: itemsMatched,
    cobertura_inventario_pct: cobertura,
    items_ejemplo: matches.slice(0, 8).map((m) => ({
      pedido: m.nombre_solicitado,
      cantidad: m.cantidad,
      calza_con: m.nombre_producto,
      precio_propio: m.precio_unitario,
    })),
    comprador: {
      score_pago_0_100: scorePago,
      dias_promedio_pago: diasPromedioPago,
      total_ordenes_historicas: totalOrdenes,
    },
    tasa_exito_equipo_pct: tasaExitoPropia,
  };
}

async function pedirVeredictoIA(resumen: Record<string, unknown>): Promise<Veredicto | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) return null;
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  const candidatos = [
    Deno.env.get('GEMINI_MODEL') || '',
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
  ].filter(Boolean);

  const systemPrompt = `Eres un asesor comercial experto en licitaciones y compras públicas de Mercado Público (Chile).
Te paso los datos de una oportunidad y de la empresa que evalúa postular. Decide si le conviene.
Responde SOLO con un JSON válido, sin texto extra, con esta forma EXACTA:
{ "recomendacion": "ofertar" | "revisar" | "descartar", "razon": "2 a 3 frases directas en español, sin rodeos", "puntos_favor": ["..."], "puntos_contra": ["..."] }
Reglas:
- "ofertar": buena cobertura de inventario y/o comprador confiable, vale la pena el esfuerzo.
- "descartar": muy poca cobertura de inventario, comprador con mal historial de pago, o plazo casi vencido.
- "revisar": casos intermedios o con datos insuficientes para decidir con seguridad.
- puntos_favor y puntos_contra: máximo 4 cada uno, frases cortas (menos de 12 palabras), concretas (nombra el dato, no generalices).
- Si faltan datos clave (sin ítems, sin comprador), dilo en la razón y prefiere "revisar" antes que arriesgar.`;

  const userPrompt = `Datos:\n${JSON.stringify(resumen, null, 2)}`;

  for (const model of candidatos) {
    try {
      const resp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
      });
      if (!resp.ok) continue;
      const j = await resp.json();
      const content = j.choices?.[0]?.message?.content;
      if (!content) continue;
      const limpio = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(limpio);
      if (!['ofertar', 'revisar', 'descartar'].includes(parsed?.recomendacion)) continue;
      if (typeof parsed?.razon !== 'string' || !parsed.razon.trim()) continue;
      return {
        recomendacion: parsed.recomendacion,
        razon: parsed.razon.trim().slice(0, 800),
        puntos_favor: Array.isArray(parsed.puntos_favor) ? parsed.puntos_favor.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [],
        puntos_contra: Array.isArray(parsed.puntos_contra) ? parsed.puntos_contra.filter((s: unknown) => typeof s === 'string').slice(0, 4) : [],
      };
    } catch (_e) {
      // siguiente modelo
    }
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Falta autenticación' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({})) as { tipo?: string; codigo?: string };
    const tipo = body.tipo;
    const codigo = (body.codigo || '').trim();
    if ((tipo !== 'licitacion' && tipo !== 'compra_agil') || !codigo) {
      return new Response(JSON.stringify({ error: 'Falta tipo o codigo válidos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: ownerId, error: errOwnerId } = await supabase.rpc('cliente_owner_id');
    if (errOwnerId) throw errOwnerId;
    const clienteId = (ownerId as string | null) || userData.user.id;

    const resumen = await armarResumen(supabase, tipo, codigo, clienteId);
    if (!resumen) {
      return new Response(JSON.stringify({ error: 'Oportunidad no encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const veredicto = await pedirVeredictoIA(resumen);
    if (!veredicto) {
      return new Response(JSON.stringify({ error: 'La IA no está disponible ahora, intenta de nuevo en un rato' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: guardado, error: errUpsert } = await supabase
      .from('oportunidad_veredictos')
      .upsert({
        cliente_id: clienteId,
        tipo,
        codigo,
        recomendacion: veredicto.recomendacion,
        razon: veredicto.razon,
        puntos_favor: veredicto.puntos_favor,
        puntos_contra: veredicto.puntos_contra,
        generado_en: new Date().toISOString(),
      }, { onConflict: 'cliente_id,tipo,codigo' })
      .select()
      .maybeSingle();
    if (errUpsert) throw errUpsert;

    return new Response(JSON.stringify(guardado), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('veredicto-oportunidad error:', e);
    return new Response(JSON.stringify({ error: 'Error generando el veredicto' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
