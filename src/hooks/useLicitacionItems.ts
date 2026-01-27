import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

/**
 * Item de licitación - matches database schema for compras_agiles_items
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
  precio_unitario: number | null;
  total: number | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una compra ágil
 * Busca en compras_agiles_items usando el CODIGO de la compra
 * Primero obtiene el ID numerico de compras_agiles, luego busca los items
 */
export function useLicitacionItems(licitacionCodigo: string | null) {
  return useQuery({
    queryKey: ['compras_agiles_items', licitacionCodigo],
    queryFn: async () => {
      if (!licitacionCodigo) return [];
      
      // Step 1: Get the compra_agil ID from the codigo
      const { data: compraData, error: compraError } = await supabase
        .from('compras_agiles')
        .select('id')
        .eq('codigo', licitacionCodigo)
        .single();
      
      if (compraError || !compraData) {
        console.log('No compra found for codigo:', licitacionCodigo);
        return [];
      }
      
      const compraId = compraData.id;
      
      // Step 2: Fetch items using the numeric compra_agil_id
      const { data, error } = await supabase
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraId)
        .order('id', { ascending: true });
      
      if (error) {
        console.error('Error fetching items:', error);
        throw error;
      }
      
      return (data || []) as LicitacionItem[];
    },
    enabled: !!licitacionCodigo,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
