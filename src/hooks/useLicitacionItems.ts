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
    queryKey: ['licitacion-items', identifier],
    queryFn: async (): Promise<LicitacionItem[]> => {
      if (!identifier) return [];
      
      console.log('[useLicitacionItems] Called with identifier:', identifier);

      let compraAgilId: number;

      // Si es string, buscar el ID por codigo en compras_agiles
      if (typeof identifier === 'string') {
        const result = await supabase
          .from('compras_agiles')
          .select('id')
          .eq('codigo', identifier)
          .single() as any;

        console.log('[useLicitacionItems] Found compraAgil:', result.data, 'error:', result.error);

        if (result.error || !result.data) {
          console.error('Error finding compra agil:', result.error);
          return [];
        }

        compraAgilId = Number(result.data.id);
      } else {
        compraAgilId = identifier;
      }

      console.log('[useLicitacionItems] Fetching items for compraAgilId:', compraAgilId);

      // Fetch items from compras_agiles_items using compra_agil_id
      const itemsResult = await (supabase as any)
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraAgilId) as any;

      console.log('[useLicitacionItems] Items result:', { data: itemsResult.data, error: itemsResult.error, count: itemsResult.data?.length });

      if (itemsResult.error) {
        console.error('Error fetching items:', itemsResult.error);
        throw itemsResult.error;
      }

      const data = itemsResult.data || [];

      // Map database fields to expected interface
      return data.map((item: any) => ({
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
