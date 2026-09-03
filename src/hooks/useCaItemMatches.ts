import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

// Match ÍTEM POR ÍTEM de una compra ágil contra el inventario del cliente.
// La RLS de ca_item_matches ya restringe a la empresa dueña (cliente_owner_id),
// así que basta filtrar por el código de la compra.
export interface CaItemMatch {
  id: string;
  compra_agil_codigo: string;
  item_id: string;
  nombre_solicitado: string | null;
  cantidad: number | null;
  inventario_id: string | null;
  nombre_producto: string | null;
  sku: string | null;
  precio_unitario: number | null;
  score: number | null;
}

export function useCaItemMatches(codigo: string | null | undefined) {
  return useQuery({
    queryKey: ['ca-item-matches', codigo],
    enabled: !!codigo,
    queryFn: async (): Promise<CaItemMatch[]> => {
      const { data, error } = await (supabaseClient as any)
        .from('ca_item_matches')
        .select('*')
        .eq('compra_agil_codigo', codigo);
      if (error) throw error;
      return (data || []) as CaItemMatch[];
    },
  });
}

// Cuántos ítems calzan por compra ágil, para varios códigos a la vez (tabla/
// lista). Mismo dato que usa el detalle (ca_item_matches), así el número no
// cambia entre pantallas — antes la tabla de Compras Ágiles calculaba su
// propio "Match Catálogo" con un motor de fuzzy matching aparte (por marca/
// tipo de producto, en el navegador), que daba resultados distintos e
// inconsistentes con el resto de la app.
export function useCaItemMatchCounts(codigos: string[]) {
  const codigosKey = [...codigos].sort().join(',');
  return useQuery({
    queryKey: ['ca-item-match-counts', codigosKey],
    enabled: codigos.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await (supabaseClient as any)
        .from('ca_item_matches')
        .select('compra_agil_codigo')
        .in('compra_agil_codigo', codigos);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data || []) as { compra_agil_codigo: string }[]) {
        counts[row.compra_agil_codigo] = (counts[row.compra_agil_codigo] || 0) + 1;
      }
      return counts;
    },
    staleTime: 60_000,
  });
}
