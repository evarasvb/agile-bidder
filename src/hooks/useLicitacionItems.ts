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
 * Acepta codigo (string) o compra_agil_id (number)
 */
export function useLicitacionItems(identifier: string | number | null) {
  return useQuery({
    queryKey: ['compra-agil-items', identifier],
    queryFn: async (): Promise<LicitacionItem[]> => {
      if (!identifier) {
        console.log('[useLicitacionItems] No identifier provided');
        return [];
      }
      
      console.log('[useLicitacionItems] Called with identifier:', identifier, 'type:', typeof identifier);
      
      let compraAgilId: number;
      
      // Si es string, buscar el ID por codigo en compras_agiles
      if (typeof identifier === 'string') {
        console.log('[useLicitacionItems] Looking up compras_agiles by codigo:', identifier);
        
        const { data: compraAgil, error: compraError } = await supabase
          .from('compras_agiles')
          .select('id')
          .eq('codigo', identifier)
          .maybeSingle();
        
        console.log('[useLicitacionItems] compras_agiles lookup result:', { compraAgil, compraError });
        
        if (compraError) {
          console.error('[useLicitacionItems] Error finding compra agil:', compraError);
          return [];
        }
        
        if (!compraAgil) {
          console.warn('[useLicitacionItems] No compra agil found for codigo:', identifier);
          return [];
        }
        
        compraAgilId = Number(compraAgil.id);
        console.log('[useLicitacionItems] Found compra_agil_id:', compraAgilId);
      } else {
        compraAgilId = Number(identifier);
      }
      
      // Fetch items from compras_agiles_items
      console.log('[useLicitacionItems] Fetching items for compra_agil_id:', compraAgilId);
      
      const { data, error } = await supabase
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraAgilId);
      
      console.log('[useLicitacionItems] Items query result:', { data, error, count: data?.length });
      
      if (error) {
        console.error('[useLicitacionItems] Error fetching items:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('[useLicitacionItems] No items found for compra_agil_id:', compraAgilId);
        return [];
      }
      
      // Map database fields to expected interface
      const mappedItems = data.map((item: any) => ({
        id: String(item.id),
        compra_agil_id: String(item.compra_agil_id),
        nombre_producto: item.nombre_producto || '',
        descripcion: item.descripcion_producto || null,
        cantidad: item.cantidad ? Number(item.cantidad) : null,
        unidad: item.unidad || null,
        codigo_producto: item.codigo_producto || null,
        categoria: item.categoria || null,
        created_at: item.created_at || null,
      }));
      
      console.log('[useLicitacionItems] Returning mapped items:', mappedItems.length);
      return mappedItems;
    },
    enabled: !!identifier,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });
}
