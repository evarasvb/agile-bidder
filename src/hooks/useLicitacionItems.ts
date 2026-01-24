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
}

/**
 * Hook para obtener los productos solicitados (items) de una compra ágil
 * Busca en compras_agiles_items usando el ID numérico de la compra
 */
export function useLicitacionItems(licitacionId: string | null) {
  return useQuery({
    queryKey: ['compras_agiles_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];
      
      // First, get the numeric ID from compras_agiles using the UUID
      const { data: compra, error: compraError } = await supabase
        .from('compras_agiles')
        .select('id')
        .eq('id', licitacionId)
        .single();
      
      if (compraError || !compra) {
        console.log('No se encontró compra ágil con ID:', licitacionId);
        return [];
      }
      
      // Now fetch items from compras_agiles_items
      const { data, error } = await supabase
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compra.id)
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
