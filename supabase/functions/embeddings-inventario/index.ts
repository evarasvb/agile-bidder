import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claveMistral, embeber } from "../_shared/embeddings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Vectoriza bajo demanda (al abrir el buscador global) los productos del
// inventario del usuario que aún no tienen vector. El robot embed-items hace lo
// mismo en segundo plano para todos los clientes; esto solo acelera al que está
// buscando ahora. Corre como el usuario (RLS) para leer/escribir sus filas; la
// clave del proveedor se lee con service role y nunca sale al cliente.
const LOTE = 100;
interface Fila { id: string; nombre_producto: string | null; categoria: string | null; marca: string | null; descripcion: string | null }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Falta autenticación' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: filas, error: errSelect } = await supabase
      .from('cliente_inventario')
      .select('id, nombre_producto, categoria, marca, descripcion')
      .is('embedding', null)
      .limit(LOTE);
    if (errSelect) throw errSelect;
    if (!filas?.length) {
      return new Response(JSON.stringify({ actualizados: 0, pendientes: false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const apiKey = await claveMistral(admin);
    const textos = (filas as Fila[]).map((f) => [f.nombre_producto, f.categoria, f.marca, f.descripcion].filter(Boolean).join(' ').trim() || 'producto sin nombre');
    const vectores = await embeber(textos, apiKey);
    // Guardado como el usuario (RLS): solo puede tocar su propio inventario.
    const { data: ok, error: errUpd } = await supabase.rpc('guardar_embeddings', {
      p_tabla: 'cliente_inventario',
      p_filas: (filas as Fila[]).map((f, i) => ({ id: f.id, embedding: vectores[i] })),
    });
    if (errUpd) throw errUpd;
    const actualizados = Number(ok || 0);
    return new Response(JSON.stringify({ actualizados, pendientes: filas.length === LOTE }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || 'Error generando embeddings' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
