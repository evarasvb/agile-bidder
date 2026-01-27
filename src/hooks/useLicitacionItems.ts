import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

/**
 * Item de licitacion - matches expected frontend interface
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
 * Hook para obtener los productos solicitados (items) de una licitacion
 * Busca en licitacion_items usando el CODIGO de la licitacion
 */
export function useLicitacionItems(licitacionCodigo: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionCodigo],
    queryFn: async () => {
      if (!licitacionCodigo) return [];

      // Fetch items from licitacion_items using licitacion_codigo
      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_codigo', licitacionCodigo)
        .order('item_index', { ascending: true });

      if (error) {
        console.error('Error fetching items:', error);
        throw error;
      }

      // Map database fields to expected interface
      return (data || []).map(item => ({
        id: String(item.id),
        compra_agil_id: item.licitacion_codigo,
        nombre_producto: item.nombre || '',
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
        codigo_producto: item.producto_id,
        categoria: item.categoria,
        created_at: item.created_at,
        precio_unitario: item.precio_unitario,
        total: item.total,
      })) as LicitacionItem[];
    },
    enabled: !!licitacionCodigo,
  });
}
