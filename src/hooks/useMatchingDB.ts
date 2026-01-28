/**
 * Hook para matching de productos usando funciones de base de datos
 * Usa las funciones get_matching_products y get_match_percentage de Supabase
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MatchedProduct {
  item_index: number;
  item_nombre: string;
  item_cantidad: string;
  item_unidad: string;
  producto_id: number;
  producto_nombre: string;
  producto_sku: string;
  producto_precio: number;
  producto_stock: number;
  match_score: number;
}

export interface MatchPercentage {
  total_items: number;
  items_con_match: number;
  porcentaje_match: number;
}

/**
 * Hook para obtener productos que coinciden con los items de una licitación
 */
export function useMatchingProducts(licitacionCodigo: string | null, clienteId: string | null) {
  return useQuery({
    queryKey: ['matching-products', licitacionCodigo, clienteId],
    queryFn: async (): Promise<MatchedProduct[]> => {
      if (!licitacionCodigo || !clienteId) return [];
      
      const { data, error } = await (supabase as any).rpc('get_matching_products', {
        p_licitacion_codigo: licitacionCodigo,
        p_cliente_id: clienteId
      });
      
      if (error) {
        console.error('[useMatchingProducts] Error:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!licitacionCodigo && !!clienteId,
  });
}

/**
 * Hook para obtener el porcentaje de match de una licitación
 */
export function useMatchPercentage(licitacionCodigo: string | null, clienteId: string | null) {
  return useQuery({
    queryKey: ['match-percentage', licitacionCodigo, clienteId],
    queryFn: async (): Promise<MatchPercentage | null> => {
      if (!licitacionCodigo || !clienteId) return null;
      
      const { data, error } = await (supabase as any).rpc('get_match_percentage', {
        p_licitacion_codigo: licitacionCodigo,
        p_cliente_id: clienteId
      });
      
      if (error) {
        console.error('[useMatchPercentage] Error:', error);
        return null;
      }
      
      return data?.[0] || null;
    },
    enabled: !!licitacionCodigo && !!clienteId,
  });
}
