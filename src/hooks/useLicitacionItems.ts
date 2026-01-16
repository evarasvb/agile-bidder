import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Item de licitación - matches database schema
 */
export interface LicitacionItem {
  id: number;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

/**
 * Hook para obtener los productos solicitados (items) de una licitación
 */
export function useLicitacionItems(licitacionId: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];

      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .order('id', { ascending: true });

      if (error) throw error;
      return (data || []) as LicitacionItem[];
    },
    enabled: !!licitacionId,
    refetchInterval: 30000,
  });
}

/**
 * Hook para obtener un item específico
 */
export function useLicitacionItem(licitacionId: string | null, itemId: number | null) {
  return useQuery({
    queryKey: ['licitacion_item', licitacionId, itemId],
    queryFn: async () => {
      if (!licitacionId || itemId === null) return null;

      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .eq('id', itemId)
        .maybeSingle();

      if (error) throw error;
      return data as LicitacionItem | null;
    },
    enabled: !!licitacionId && itemId !== null,
  });
}

/**
 * Hook para obtener el producto del inventario asociado a un SKU
 */
export function useProductoBySku(sku: string | null) {
  return useQuery({
    queryKey: ['inventory_by_sku', sku],
    queryFn: async () => {
      if (!sku) return null;

      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!sku,
  });
}
