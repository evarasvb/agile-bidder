import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

/**
 * Item de licitación - matches database schema for compras_agiles_items
 */
export interface LicitacionItem {
  id: string;
  compra_agil_id: number;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  codigo_producto: string | null;
  categoria: string | null;
  created_at: string | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una compra ágil
 * Busca en compras_agiles_items usando el ID de la compra
 */
export function useLicitacionItems(licitacionId: string | null) {
  return useQuery({
    queryKey: ['compras_agiles_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];
      
      // Fetch items from compras_agiles_items using the compra UUID
      const { data, error } = await supabase
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', licitacionId)
        .order('id', { ascending: true });
      
      if (error) {
        console.error('Error fetching items:', error);
        throw error;
      }
      
      return (data || []) as LicitacionItem[];
    },
    enabled: !!licitacionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
