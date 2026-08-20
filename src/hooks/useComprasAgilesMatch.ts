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

/**
 * Hook para calcular match entre compras ágiles y el inventario del cliente
 * Consulta directamente tabla compras_agiles con items
 * y hace match con cliente_inventario
 */
export function useComprasAgilesMatch(clienteId: string | null) {
  return useQuery({
    queryKey: ['compras_agiles_match', clienteId],
    queryFn: async (): Promise<CompraAgilMatch[]> => {
      if (!clienteId) return [];

      // 1) Obtener inventario del cliente
      const { data: inventario, error: invError } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('cliente_id', clienteId);

      if (invError) throw invError;
      if (!inventario || inventario.length === 0) {
        console.log('[useComprasAgilesMatch] Cliente sin inventario');
        return [];
      }

      console.log(`[useComprasAgilesMatch] Inventario: ${inventario.length} productos`);

      // 2) Obtener compras ágiles activas con items
      const { data: compras, error: comprasError } = await supabase
        .from('compras_agiles')
        .select(`
          *,
          compras_agiles_items(*)
        `)
        .eq('estado', 'Activo')
        .gte('fecha_cierre', new Date().toISOString());

      if (comprasError) throw comprasError;
      if (!compras) return [];

      console.log(`[useComprasAgilesMatch] Compras activas: ${compras.length}`);

      // 3) Calcular match para cada compra
      const results: CompraAgilMatch[] = compras.map((c: any) => {
        const items = c.compras_agiles_items || [];
        const totalItems = items.length;
        let matchedItems = 0;
        const matchedProductIds = new Set<string>();

        for (const item of items) {
          const itemNombre = (item.nombre_producto || '').toLowerCase();
          const itemCodigo = item.codigo_producto || null;

          const found = inventario.find(inv => {
            const invNombre = (inv.nombre || inv.nombre_producto || '').toLowerCase();
            const invCodigo = inv.codigo_producto || inv.sku || null;

            // Match por código exacto
            const codigoMatch =
              !!itemCodigo && !!invCodigo && String(itemCodigo) === String(invCodigo);

            // Match por nombre (contiene)
            const nombreMatch =
              itemNombre.length > 2 &&
              (invNombre.includes(itemNombre) || itemNombre.includes(invNombre));

            return codigoMatch || nombreMatch;
          });

          if (found) {
            matchedItems++;
            matchedProductIds.add(found.id);
          }
        }

        const score =
          totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;

        const organismo = c.organismo || c.nombre_organismo || null;
        const monto = c.monto ?? c.monto_estimado ?? c.monto_disponible ?? null;

        return {
          id: c.id,
          codigo: c.codigo,
          nombre: c.nombre || 'Sin título',
          nombre_organismo: organismo,
          // Campos que consume el modal de oportunidades (misma forma que CompraAgil):
          organismo,
          monto,
          estado: c.estado || null,
          region: c.region || null,
          link_oficial: c.link_oficial || c.url || null,
          monto_estimado: c.monto_estimado ?? c.monto_disponible ?? null,
          moneda: c.moneda ?? null,
          fecha_cierre: c.fecha_cierre || null,
          descripcion: c.descripcion || null,
          match_encontrado: matchedItems > 0,
          match_score: score,
          items_count: totalItems,
          matched_items: matchedItems,
          matched_product_ids: Array.from(matchedProductIds),
        };
      });

      // Ordenar por match_score descendente
      results.sort((a, b) => b.match_score - a.match_score);

      console.log(`[useComprasAgilesMatch] Resultados con match: ${results.filter(r => r.match_encontrado).length}`);
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
