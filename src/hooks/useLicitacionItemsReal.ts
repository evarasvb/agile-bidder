import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

export interface LicitacionItem {
  id: number;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

export interface LicitacionBIItem {
  id: string;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  categoria: string | null;
  codigo_categoria: string | null;
  codigo_producto: string | null;
  correlativo: number | null;
  created_at: string;
}

export function useLicitacionItemsReal(licitacionId: string | undefined) {
  return useQuery({
    queryKey: ['licitacion-items-real', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];

      // Try licitacion_items first
      const { data: itemsData, error: itemsError } = await (supabaseClient as any)
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .order('id', { ascending: true });

      if (!itemsError && itemsData && itemsData.length > 0) {
        return itemsData.map((item: any) => ({
          id: item.id,
          licitacion_id: item.licitacion_id,
          nombre_producto: item.nombre_producto,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad,
          categoria: null,
          codigo_producto: null,
        }));
      }

      // Try licitaciones_bi_items
      const { data: biItemsData, error: biItemsError } = await (supabaseClient as any)
        .from('licitaciones_bi_items')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .order('correlativo', { ascending: true });

      if (!biItemsError && biItemsData && biItemsData.length > 0) {
        return biItemsData.map((item: any) => ({
          id: item.id,
          licitacion_id: item.licitacion_id,
          nombre_producto: item.nombre_producto,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad,
          categoria: item.categoria,
          codigo_producto: item.codigo_producto,
        }));
      }

      return [];
    },
    enabled: !!licitacionId,
  });
}

// Hook for compras_agiles_items
export function useCompraAgilItems(compraAgilId: string | undefined) {
  return useQuery({
    queryKey: ['compra-agil-items', compraAgilId],
    queryFn: async () => {
      if (!compraAgilId) return [];

      const { data, error } = await (supabaseClient as any)
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraAgilId)
        .order('id', { ascending: true });

      if (error) {
        console.error('Error fetching compra agil items:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!compraAgilId,
  });
}
