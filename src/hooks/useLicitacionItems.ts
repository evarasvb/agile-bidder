import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

/**
 * Item de compra agil - matches expected frontend interface
 */
export interface LicitacionItem {
  id: string;
  compra_agil_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  codigo_producto: string | null;
  categoria: string | null;
  created_at: string | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una compra agil
 * Busca en compras_agiles_items usando el ID de la compra agil
 */
export function useLicitacionItems(compraAgilId: number | null) {
  return useQuery({
    queryKey: ['compra-agil-items', compraAgilId],
    queryFn: async () => {
      if (!compraAgilId) return [];

      // Fetch items from compras_agiles_items using compra_agil_id
      const { data, error } = await supabase
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraAgilId);

      if (error) {
        console.error('Error fetching items:', error);
        throw error;
      }

      // Map database fields to expected interface
      return (data || []).map((item: any) => ({
        id: String(item.id),
        compra_agil_id: String(item.compra_agil_id),
        nombre_producto: item.nombre_producto || '',
        descripcion: item.descripcion_producto,
        cantidad: item.cantidad ? Number(item.cantidad) : null,
        unidad: item.unidad,
        codigo_producto: item.codigo_producto,
        categoria: item.categoria,
        created_at: item.created_at,
      })) as LicitacionItem[];
    },
    enabled: !!compraAgilId,
  });
}
