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
