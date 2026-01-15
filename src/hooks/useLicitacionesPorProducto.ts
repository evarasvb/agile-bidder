// Hook para obtener licitaciones abiertas por producto (estilo Lici)
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
 */
export function useLicitacionesPorProducto() {
  return useQuery({
    queryKey: ['licitaciones_por_producto'],
    queryFn: async (): Promise<LicitacionPorProducto[]> => {
      const { data, error } = await supabase
        .from('licitaciones_por_producto' as any)
        .select('*')
        .order('total_licitaciones_abiertas', { ascending: false });

      if (error) throw error;
      return (data || []) as LicitacionesPorProducto[];
    },
    staleTime: 60000, // Cache por 1 minuto
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

      const { data, error } = await supabase
        .from('licitaciones_por_producto' as any)
        .select('*')
        .eq('producto_id', productoId)
        .maybeSingle();

      if (error) throw error;
      return (data || null) as LicitacionPorProducto | null;
    },
    enabled: !!productoId,
    staleTime: 60000,
  });
}
