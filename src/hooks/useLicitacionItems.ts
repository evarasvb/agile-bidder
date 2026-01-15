import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Item de licitación con información del producto solicitado y su match (si existe)
 */
export interface LicitacionItem {
  licitacion_codigo: string;
  item_index: number;
  nombre: string | null;
  descripcion: string | null;
  cantidad: string | number | null;
  unidad: string | null;
  producto_id: string | null;
  // Campos de matching (calculados por matcher_db_adapter)
  match_sku: string | null;
  costo_unitario: number | null;
  margen_estimado: number | null;
  confidence_score: number | null;
  fecha_match: string | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una compra ágil
 * Estos son los productos que la institución publicó en su listado
 */
export function useLicitacionItems(licitacionCodigo: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionCodigo],
    queryFn: async () => {
      if (!licitacionCodigo) return [];

      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_codigo', licitacionCodigo)
        .order('item_index', { ascending: true });

      if (error) throw error;
      return (data || []) as LicitacionItem[];
    },
    enabled: !!licitacionCodigo,
    refetchInterval: 30000, // Refrescar cada 30 segundos para ver matches nuevos
  });
}

/**
 * Hook para obtener un item específico con su información de match
 */
export function useLicitacionItem(licitacionCodigo: string | null, itemIndex: number | null) {
  return useQuery({
    queryKey: ['licitacion_item', licitacionCodigo, itemIndex],
    queryFn: async () => {
      if (!licitacionCodigo || itemIndex === null) return null;

      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_codigo', licitacionCodigo)
        .eq('item_index', itemIndex)
        .maybeSingle();

      if (error) throw error;
      return data as LicitacionItem | null;
    },
    enabled: !!licitacionCodigo && itemIndex !== null,
  });
}

/**
 * Hook para obtener el producto maestro asociado a un SKU (si hay match)
 */
export function useProductoMaestro(sku: string | null) {
  return useQuery({
    queryKey: ['producto_maestro', sku],
    queryFn: async () => {
      if (!sku) return null;

      const { data, error } = await supabase
        .from('producto_maestro')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!sku,
  });
}
