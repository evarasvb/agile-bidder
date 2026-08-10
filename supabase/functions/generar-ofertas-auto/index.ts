// =============================================================================
// GENERAR OFERTAS AUTO
// Crea ofertas automáticamente para compras ágiles cruzando sus ítems con el
// inventario del cliente (precio de inventario tal cual). Si la compra ágil no
// tiene ítems cargados, los trae en el momento desde la API de Mercado Público.
// Escribe en cliente_ofertas (que es lo que lee la extensión).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_BASE = 'https://api.buscador.mercadopublico.cl';
const browserHeaders: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-CL,es;q=0.9,en;q=0.8',
  'Referer': 'https://www.mercadopublico.cl/',
  'Origin': 'https://www.mercadopublico.cl',
};

const STOP = new Set([
  'para','con','los','las','del','una','uno','por','sin','tamano','color','tipo',
  'unidad','unidades','paquete','pack','caja','set','kit','marca','modelo','cada',
  'que','como','mas','multifuncion','articulo','articulos','suministro','insumo','insumos',
]);

function tokens(s: string | null | undefined): string[] {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Falta autenticación' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validar el usuario y obtener su cliente
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await authClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userErr || !userData?.user) return json({ error: 'Token inválido' }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!cliente?.id) return json({ error: 'No se encontró el cliente asociado a tu usuario' }, 404);
    const clienteId = cliente.id;

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const codigos: string[] = Array.isArray(body.codigos) ? body.codigos.slice(0, 25) : [];
    const limit = Math.min(Number(body.limit) || 15, 25);

    // Seleccionar compras ágiles a procesar
    let comprasQuery = supabase
      .from('compras_agiles')
      .select('id, codigo, nombre, organismo, monto, match_score');
    if (codigos.length > 0) comprasQuery = comprasQuery.in('codigo', codigos);
    else comprasQuery = comprasQuery.limit(limit);

    const { data: compras, error: comprasErr } = await comprasQuery;
    if (comprasErr) return json({ error: 'Error obteniendo compras ágiles: ' + comprasErr.message }, 500);
    if (!compras || compras.length === 0) return json({ ofertas_creadas: 0, detalles: [], mensaje: 'No hay compras ágiles para procesar' });

    let ofertasCreadas = 0;
    const detalles: any[] = [];

    for (const compra of compras) {
      try {
        // 1) Obtener ítems; si no hay, traerlos desde la ficha de Mercado Público
        let { data: items } = await supabase
          .from('compras_agiles_items')
          .select('codigo_producto, nombre_producto, descripcion, cantidad, unidad')
          .eq('compra_agil_id', compra.id);

        if (!items || items.length === 0) {
          items = await traerItemsDesdeMP(supabase, compra.id, compra.codigo);
        }

        if (!items || items.length === 0) {
          detalles.push({ codigo: compra.codigo, ok: false, motivo: 'Sin ítems disponibles' });
          continue;
        }

        // 2) Matchear cada ítem contra el inventario del cliente
        const productosOfertados: any[] = [];
        let matched = 0;

        for (const item of items) {
          const best = await matchInventario(supabase, clienteId, item.nombre_producto, item.descripcion);
          const cantidad = Number(item.cantidad) || 1;
          if (best) {
            matched++;
            const precio = Number(best.precio_unitario) || 0;
            productosOfertados.push({
              codigo_producto: item.codigo_producto,
              nombre_solicitado: item.nombre_producto,
              nombre_producto: best.nombre_producto || best.nombre,
              sku: best.sku,
              cantidad,
              precio_unitario: precio, // precio del inventario tal cual
              precio_total: precio * cantidad,
              match_score: best.score,
            });
          } else {
            // Sin match: se deja el producto para que la persona ponga precio a mano
            productosOfertados.push({
              codigo_producto: item.codigo_producto,
              nombre_solicitado: item.nombre_producto,
              nombre_producto: null,
              sku: null,
              cantidad,
              precio_unitario: 0,
              precio_total: 0,
              match_score: 0,
            });
          }
        }

        if (matched === 0) {
          detalles.push({ codigo: compra.codigo, ok: false, motivo: 'Ningún ítem coincidió con el inventario' });
          continue;
        }

        const valorTotal = productosOfertados.reduce((s, p) => s + (p.precio_total || 0), 0);
        const matchScore = Math.round((matched / items.length) * 100);

        // 3) Upsert en cliente_ofertas (una oferta por compra ágil y cliente)
        const { data: existente } = await supabase
          .from('cliente_ofertas')
          .select('id')
          .eq('cliente_id', clienteId)
          .eq('licitacion_id', compra.codigo)
          .maybeSingle();

        const ofertaData = {
          cliente_id: clienteId,
          licitacion_id: compra.codigo,
          estado: 'pendiente',
          match_score: matchScore,
          productos_ofertados: productosOfertados,
          valor_total: valorTotal,
          notas: `Oferta generada automáticamente (${matched}/${items.length} productos con match).`,
          updated_at: new Date().toISOString(),
        };

        if (existente?.id) {
          await supabase.from('cliente_ofertas').update(ofertaData).eq('id', existente.id);
        } else {
          await supabase.from('cliente_ofertas').insert(ofertaData);
        }

        ofertasCreadas++;
        detalles.push({ codigo: compra.codigo, ok: true, productos: productosOfertados.length, con_match: matched, valor_total: valorTotal, match_score: matchScore });
      } catch (err) {
        detalles.push({ codigo: compra.codigo, ok: false, motivo: err instanceof Error ? err.message : String(err) });
      }
    }

    return json({ ofertas_creadas: ofertasCreadas, procesadas: compras.length, detalles });
  } catch (error) {
    console.error('generar-ofertas-auto error:', error);
    return json({ error: error instanceof Error ? error.message : 'Error desconocido' }, 500);
  }
});

// Trae los productos_solicitados desde la ficha de MP y los guarda como ítems.
async function traerItemsDesdeMP(supabase: any, compraId: string, codigo: string): Promise<any[]> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/compra-agil/ficha?code=${encodeURIComponent(codigo)}`, { headers: browserHeaders }, 12000);
    if (!res.ok) return [];
    const data = await res.json();
    const productos = data?.payload?.productos_solicitados || [];
    if (!productos.length) return [];

    const itemsData = productos.map((p: any) => ({
      compra_agil_id: compraId,
      codigo_producto: String(p.codigo_producto ?? ''),
      nombre_producto: p.nombre || 'Producto',
      descripcion: p.descripcion || null,
      cantidad: p.cantidad ?? 1,
      unidad: p.unidad_medida || null,
    }));

    await supabase.from('compras_agiles_items').delete().eq('compra_agil_id', compraId);
    await supabase.from('compras_agiles_items').insert(itemsData);

    return itemsData.map((i: any) => ({
      codigo_producto: i.codigo_producto,
      nombre_producto: i.nombre_producto,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
    }));
  } catch {
    return [];
  }
}

// Busca en el inventario del cliente el mejor producto para un ítem solicitado.
async function matchInventario(supabase: any, clienteId: string, nombre: string, descripcion?: string | null): Promise<any | null> {
  const itemTokens = tokens(nombre + ' ' + (descripcion || ''));
  if (itemTokens.length === 0) return null;

  // Shortlist por los tokens más distintivos (los más largos)
  const distintivos = [...new Set(itemTokens)].sort((a, b) => b.length - a.length).slice(0, 4);
  const orFilter = distintivos.map((t) => `nombre_producto.ilike.%${t}%`).join(',');

  const { data: candidatos } = await supabase
    .from('cliente_inventario')
    .select('sku, nombre, nombre_producto, descripcion, categoria, palabras_clave, precio_unitario')
    .eq('cliente_id', clienteId)
    .or(orFilter)
    .limit(40);

  if (!candidatos || candidatos.length === 0) return null;

  const itemSet = new Set(itemTokens);
  let best: any = null;
  let bestScore = 0;

  for (const c of candidatos) {
    const candTokens = tokens(
      (c.nombre_producto || '') + ' ' + (c.nombre || '') + ' ' + (c.descripcion || '') + ' ' + ((c.palabras_clave || []).join(' '))
    );
    let shared = 0;
    const seen = new Set<string>();
    for (const t of candTokens) {
      if (itemSet.has(t) && !seen.has(t)) { shared++; seen.add(t); }
    }
    // score 0-100 según proporción de tokens del ítem cubiertos
    const score = Math.round((shared / itemSet.size) * 100);
    if (shared >= 1 && score > bestScore && Number(c.precio_unitario) > 0) {
      bestScore = score;
      best = { ...c, score };
    }
  }

  return best;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
