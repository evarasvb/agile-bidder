import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Genera embeddings (Gemini, ya integrado y pagado en el resto de la app)
// para los productos del inventario del cliente autenticado que todavía no
// lo tienen, y los guarda en cliente_inventario.embedding (pgvector). Corre
// como el usuario que llama (no service role): la RLS de cliente_inventario
// aplica sola, así que un cliente nunca puede pisar el inventario de otro.
//
// Se llama bajo demanda (al abrir el buscador global), en lotes chicos, para
// no gastar de más: la mayoría de los inventarios son de unas pocas decenas
// a un par de cientos de productos, así que un par de llamadas alcanza.
const LOTE = 40;

interface Fila { id: string; nombre_producto: string | null; categoria: string | null; marca: string | null; descripcion: string | null; updated_at: string }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Falta autenticación' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'Búsqueda inteligente no configurada' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: filas, error: errSelect } = await supabase
      .from('cliente_inventario')
      .select('id, nombre_producto, categoria, marca, descripcion, updated_at')
      .is('embedding', null)
      .limit(LOTE);
    if (errSelect) throw errSelect;
    if (!filas?.length) {
      return new Response(JSON.stringify({ actualizados: 0, pendientes: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const textos = (filas as Fila[]).map((f) =>
      [f.nombre_producto, f.categoria, f.marca, f.descripcion].filter(Boolean).join(' ').trim() || 'producto sin nombre'
    );

    // Varios nombres de modelo por si alguno no está disponible en la cuenta
    // (mismo patrón defensivo que ya usa enriquecer-inventario con el chat).
    const MODELOS = ['gemini-embedding-001', 'text-embedding-004'];
    let vectores: number[][] | null = null;
    let ultimoError = '';
    for (const model of MODELOS) {
      const body: Record<string, unknown> = { model, input: textos };
      if (model === 'gemini-embedding-001') body.dimensions = 768;
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!resp.ok) { ultimoError = await resp.text().catch(() => ''); continue; }
      const j = await resp.json();
      const v: number[][] = (j.data || []).map((d: { embedding: number[] }) => d.embedding);
      if (v.length === filas.length) { vectores = v; break; }
      ultimoError = 'respuesta incompleta';
    }
    if (!vectores) throw new Error(`Gemini embeddings: ${ultimoError.slice(0, 300)}`);

    let actualizados = 0;
    for (let i = 0; i < filas.length; i++) {
      const vec = vectores[i];
      if (!Array.isArray(vec) || !vec.length) continue;
      // .eq('updated_at', ...) además del id: si el producto se editó
      // mientras este embedding se calculaba, la fila ya tiene otro
      // updated_at (lo bumpea el trigger genérico en cada UPDATE, incluida
      // la invalidación del embedding) y este update no debe pisarla con un
      // vector calculado sobre el texto viejo — .is('embedding', null) no
      // alcanza para detectarlo porque el trigger de invalidación también
      // deja el embedding en null. Se recalculará en el próximo backfill.
      const fila = filas[i] as Fila;
      const { error: errUpdate, count } = await supabase
        .from('cliente_inventario')
        .update({ embedding: `[${vec.join(',')}]` }, { count: 'exact' })
        .eq('id', fila.id)
        .eq('updated_at', fila.updated_at)
        .is('embedding', null);
      if (!errUpdate && count) actualizados++;
    }

    return new Response(
      JSON.stringify({ actualizados, pendientes: filas.length === LOTE }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error generando embeddings' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
