import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

/**
 * Item de licitacion - matches expected frontend interface
 */
export interface LicitacionItem {
  id: string;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  codigo_producto: string | null;
  categoria: string | null;
  created_at: string | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una licitacion
 * Acepta codigo (string) o licitacion_id (number)
 */
export function useLicitacionItems(identifier: string | number | null) {
  return useQuery({
    queryKey: ['licitacion-items', identifier],
    queryFn: async (): Promise<LicitacionItem[]> => {
      if (!identifier) return [];
      
      console.log('[useLicitacionItems] Called with identifier:', identifier);

      let licitacionId: number;

      // Si es string, buscar el ID por codigo en licitaciones
      if (typeof identifier === 'string') {
        const result = await supabase
          .from('licitaciones')
          .select('id')
          .eq('codigo', identifier)
          .single() as any;

        console.log('[useLicitacionItems] Found licitacion:', result.data, 'error:', result.error);

        if (result.error || !result.data) {
          console.error('Error finding licitacion:', result.error);
          return [];
        }

        licitacionId = Number(result.data.id);
      } else {
        licitacionId = identifier;
      }

      console.log('[useLicitacionItems] Fetching items for licitacionId:', licitacionId);

      // Fetch items from licitacion_items using licitacion_id
      const itemsResult = await (supabase as any)
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_id', licitacionId) as any;

      console.log('[useLicitacionItems] Items result:', { data: itemsResult.data, error: itemsResult.error, count: itemsResult.data?.length });

      if (itemsResult.error) {
        console.error('Error fetching items:', itemsResult.error);
        throw itemsResult.error;
      }

      const data = itemsResult.data || [];

      // Map database fields to expected interface
      return data.map((item: any) => ({
        id: String(item.id),
        licitacion_id: String(item.licitacion_id),
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
