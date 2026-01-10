import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InventoryItem {
  id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string | null;
  categoria: string;
  keywords: string[];
  precio_unitario: number;
  margen_minimo: number;
  margen_objetivo: number;
  stock_disponible: number;
  unidad_medida: string;
  tiempo_entrega_dias: number;
  proveedor: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryInput {
  sku: string;
  nombre_producto: string;
  descripcion?: string;
  categoria: string;
  keywords?: string[];
  precio_unitario: number;
  margen_minimo?: number;
  margen_objetivo?: number;
  stock_disponible?: number;
  unidad_medida?: string;
  tiempo_entrega_dias?: number;
  proveedor?: string;
  activo?: boolean;
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as InventoryItem[];
    },
  });
}

export function useInventoryActivo() {
  return useQuery({
    queryKey: ['inventory', 'activo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('activo', true)
        .order('nombre_producto');
      
      if (error) throw error;
      return data as InventoryItem[];
    },
  });
}

export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as InventoryItem;
    },
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: InventoryInput) => {
      const { data, error } = await supabase
        .from('inventory')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data as InventoryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as InventoryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useInventoryStats() {
  return useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('*');
      
      if (error) throw error;
      
      const items = data as InventoryItem[];
      const activos = items.filter(i => i.activo);
      const sinStock = items.filter(i => i.stock_disponible === 0);
      const stockBajo = items.filter(i => i.stock_disponible > 0 && i.stock_disponible < 10);
      
      const valorTotal = activos.reduce(
        (sum, i) => sum + (i.precio_unitario * i.stock_disponible), 
        0
      );
      
      const categorias = [...new Set(items.map(i => i.categoria))];
      
      return {
        total: items.length,
        activos: activos.length,
        sinStock: sinStock.length,
        stockBajo: stockBajo.length,
        valorInventario: valorTotal,
        categorias
      };
    },
  });
}
