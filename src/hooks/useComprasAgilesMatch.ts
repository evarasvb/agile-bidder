// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

// =============================================================================
// INTERFACES
// =============================================================================

export interface CompraAgilMatch {
  id: string;
  codigo: string;
  nombre: string;
  nombre_organismo: string | null;
  organismo: string | null;
  monto: number | null;
  estado: string | null;
  region: string | null;
  link_oficial: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  descripcion: string | null;
  match_encontrado: boolean;
  match_score: number;
  items_count: number;
  matched_items: number;
  matched_product_ids: string[];
}

// =============================================================================
// HOOK PRINCIPAL
// =============================================================================

// Piso de match: mismo umbral que el panel de oportunidades (src/hooks/useOportunidadesPanel.ts).
const PISO_MATCH = 40;

/**
 * Match entre compras ágiles y el inventario del cliente.
 *
 * IMPORTANTE: lee el MISMO motor vivo que el panel de oportunidades y el detalle
 * (tabla `ca_item_matches`, generada por SQL/pg_trgm vía cron + on-demand). Antes
 * este hook calculaba su propio match por coincidencia de texto (substring), lo
 * que daba porcentajes distintos a los del panel y confundía al cliente. Ahora la
 * página de Inventario muestra exactamente lo mismo que ve en el resto del sistema.
 */
export function useComprasAgilesMatch(clienteId: string | null) {
  return useQuery({
    queryKey: ['compras_agiles_match', clienteId],
    queryFn: async (): Promise<CompraAgilMatch[]> => {
      if (!clienteId) return [];

      // 1) Matches por ítem del motor vivo, solo vigentes y sobre el piso.
      const { data: items, error: itemsError } = await supabase
        .from('ca_item_matches')
        .select('compra_agil_codigo, inventario_id, item_id, score, fecha_cierre')
        .eq('cliente_id', clienteId)
        .gte('score', PISO_MATCH)
        .gte('fecha_cierre', new Date().toISOString());

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // Agrupar por compra: productos que calzan, ítems calzados y mejor score.
      const porCompra = new Map<string, { ids: Set<string>; items: Set<string>; best: number }>();
      for (const it of items as any[]) {
        const cod = it.compra_agil_codigo;
        if (!cod) continue;
        let g = porCompra.get(cod);
        if (!g) { g = { ids: new Set(), items: new Set(), best: 0 }; porCompra.set(cod, g); }
        if (it.inventario_id) g.ids.add(it.inventario_id);
        if (it.item_id) g.items.add(String(it.item_id));
        if (typeof it.score === 'number' && it.score > g.best) g.best = it.score;
      }

      const codigos = Array.from(porCompra.keys());
      if (codigos.length === 0) return [];

      // 2) Detalles de esas compras ágiles.
      const { data: compras, error: comprasError } = await supabase
        .from('compras_agiles')
        .select('id, codigo, nombre, nombre_organismo, region, monto_estimado, moneda, fecha_cierre, estado, descripcion, url_ficha')
        .in('codigo', codigos);

      if (comprasError) throw comprasError;
      const byCodigo = new Map((compras || []).map((c: any) => [c.codigo, c]));

      const results: CompraAgilMatch[] = codigos.map((cod) => {
        const g = porCompra.get(cod)!;
        const c: any = byCodigo.get(cod) || {};
        const organismo = c.nombre_organismo ?? null;
        return {
          id: c.id ?? cod,
          codigo: cod,
          nombre: c.nombre || 'Sin título',
          nombre_organismo: organismo,
          organismo,
          monto: c.monto_estimado ?? null,
          estado: c.estado ?? null,
          region: c.region ?? null,
          link_oficial: c.url_ficha ?? null,
          monto_estimado: c.monto_estimado ?? null,
          moneda: c.moneda ?? null,
          fecha_cierre: c.fecha_cierre ?? null,
          descripcion: c.descripcion ?? null,
          match_encontrado: true,
          match_score: Math.round(g.best),
          items_count: 0,
          matched_items: g.items.size,
          matched_product_ids: Array.from(g.ids),
        };
      });

      results.sort((a, b) => b.match_score - a.match_score);
      return results;
    },
    enabled: !!clienteId,
    staleTime: 60000, // Cache 1 minuto
  });
}

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================

export { useComprasAgilesMatch as useLicitacionesMatch };
