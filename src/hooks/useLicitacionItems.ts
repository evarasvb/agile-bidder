import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

/**
 * Item de licitacion - matches database schema for licitacion_items
 */
export interface LicitacionItem {
  id: string;
  licitacion_codigo: string;
  item_index: number;
  producto_id: string | null;
  nombre: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  categoria: string | null;
  created_at: string | null;
  precio_unitario: number | null;
  total: number | null;
  // Mapped properties for frontend compatibility
  nombre_producto?: string;
  codigo_producto?: string | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una licitacion
 * Busca en licitacion_items usando el CODIGO de la licitacion
 */
export function useLicitacionItems(licitacionCodigo: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionCodigo],
    queryFn: async () => {
      if (!licitacionCodigo) return [];

      // Fetch items directly using licitacion_codigo
      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_codigo', licitacionCodigo)
        .order('item_index', { ascending: true });

      if (error) {
        console.error('Error fetching items:', error);
        throw error;
      }

      // Map to expected interface format for frontend
      return (data || []).map(item => ({
        ...item,
        nombre_producto: item.nombre,
        codigo_producto: item.producto_id,
      })) as LicitacionItem[];
    },
    enabled: !!licitacionCodigo,
  });
}
