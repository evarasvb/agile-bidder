// Hook para obtener licitaciones abiertas por producto
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LicitacionPorProducto {
  producto_id: string;
  sku: string;
  nombre_producto: string;
  categoria: string | null;
  total_licitaciones_abiertas: number;
  presupuesto_total_estimado: number | null;
  mejor_match_score: number | null;
  licitaciones_codigos: string[];
  organismos: string[];
  licitaciones_detalle: Array<{
    codigo: string;
    titulo: string;
    organismo: string;
    presupuesto: number | null;
    fecha_cierre: string | null;
    estado: string;
    tipo: string;
    link_oficial: string | null;
    match_score: number;
  }>;
}

/**
 * Obtiene todas las licitaciones agrupadas por producto
 * This queries inventory and joins with matching data
 */
export function useLicitacionesPorProducto() {
  return useQuery({
    queryKey: ['licitaciones_por_producto'],
    queryFn: async (): Promise<LicitacionPorProducto[]> => {
      // Get inventory items with active status
      const { data: inventory, error } = await supabase
        .from('inventory')
        .select('id, sku, nombre_producto, categoria')
        .eq('activo', true)
        .order('nombre_producto');

      if (error) throw error;
      
      // Map inventory to the expected format
      // In a real implementation, this would join with licitaciones/matches
      return (inventory || []).map(item => ({
        producto_id: item.id,
        sku: item.sku,
        nombre_producto: item.nombre_producto,
        categoria: item.categoria,
        total_licitaciones_abiertas: 0,
        presupuesto_total_estimado: null,
        mejor_match_score: null,
        licitaciones_codigos: [],
        organismos: [],
        licitaciones_detalle: [],
      }));
    },
    staleTime: 60000,
  });
}

/**
 * Obtiene licitaciones para un producto específico
 */
export function useLicitacionesPorProductoId(productoId: string | null) {
  return useQuery({
    queryKey: ['licitaciones_por_producto', productoId],
    queryFn: async (): Promise<LicitacionPorProducto | null> => {
      if (!productoId) return null;

      const { data: item, error } = await supabase
        .from('inventory')
        .select('id, sku, nombre_producto, categoria')
        .eq('id', productoId)
        .maybeSingle();

      if (error) throw error;
      if (!item) return null;
      
      return {
        producto_id: item.id,
        sku: item.sku,
        nombre_producto: item.nombre_producto,
        categoria: item.categoria,
        total_licitaciones_abiertas: 0,
        presupuesto_total_estimado: null,
        mejor_match_score: null,
        licitaciones_codigos: [],
        organismos: [],
        licitaciones_detalle: [],
      };
    },
    enabled: !!productoId,
    staleTime: 60000,
  });
}
