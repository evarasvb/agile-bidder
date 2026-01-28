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
      if (!identifier) return [];
            console.log('[useLicitacionItems] Called with identifier:', identifier);

      let compraAgilId: number | string;

      // Si es string, buscar el ID por codigo en compras_agiles
      if (typeof identifier === 'string') {
        const { data: compraAgil, error: compraError } = await supabase
          .from('compras_agiles')
          .select('id')
          .eq('codigo', identifier)
          .single();
              console.log('[useLicitacionItems] Found compraAgil:', compraAgil);

        if (compraError || !compraAgil) {
          console.error('Error finding compra agil:', compraError);
          return [];
        }
        compraAgilId = (compraAgil as any).id;
      } else {
        compraAgilId = identifier;
      }

      // Fetch items from compras_agiles_items using compra_agil_id
      const { data, error } = await supabase
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraAgilId as any);
            console.log('[useLicitacionItems] Fetching items with compraAgilId:', compraAgilId);

      if (error) {
        console.error('Error fetching items:', error);
        throw error;
      }
            console.log('[useLicitacionItems] Fetched data:', data);

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
      }));
    },
    enabled: !!identifier,
  });
}
