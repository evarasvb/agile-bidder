import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

// Match ÍTEM POR ÍTEM de una licitación contra el inventario del cliente.
// Lee lic_item_matches (motor por cliente, generado por cron). La RLS ya
// restringe a la empresa dueña (cliente_owner_id), así que basta filtrar por el
// código de la licitación. item_id == licitaciones_bi_items.id.
export interface LicItemMatch {
  id: string;
  licitacion_codigo: string;
  item_id: string;
  nombre_solicitado: string | null;
  cantidad: number | null;
  inventario_id: string | null;
  nombre_producto: string | null;
  sku: string | null;
  precio_unitario: number | null;
  score: number | null;
}

export function useLicItemMatches(codigo: string | null | undefined) {
  return useQuery({
    queryKey: ['lic-item-matches', codigo],
    enabled: !!codigo,
    queryFn: async (): Promise<LicItemMatch[]> => {
      const { data, error } = await (supabaseClient as any)
        .from('lic_item_matches')
        .select('*')
        .eq('licitacion_codigo', codigo);
      if (error) throw error;
      return (data || []) as LicItemMatch[];
    },
    staleTime: 60_000,
  });
}
