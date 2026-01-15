import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InventoryItem {
  id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string | null;
  categoria: string;
  keywords: string[];
  costo_neto: number; // NUEVO: Costo del producto (obligatorio)
  precio_unitario: number;
  margen_comercial: number | null; // Calculado automáticamente: (precio - costo) / precio * 100
  margen_minimo: number;
  margen_objetivo: number;
  stock_disponible: number;
  unidad_medida: string;
  tiempo_entrega_dias: number;
  proveedor: string | null;
  activo: boolean;
  imagen_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryInput {
  sku: string;
  nombre_producto: string;
  descripcion?: string | null;
  categoria: string;
  keywords?: string[] | null;
  costo_neto: number; // NUEVO: Costo del producto (obligatorio)
  precio_unitario: number;
  margen_comercial?: number | null; // Calculado automáticamente si no se proporciona
  margen_minimo?: number;
  margen_objetivo?: number;
  stock_disponible?: number;
  unidad_medida?: string;
  tiempo_entrega_dias?: number;
  proveedor?: string | null;
  activo?: boolean;
  imagen_url?: string | null;
  user_id?: string; // Required for RLS - will be set automatically
}

/**
 * Calcula el margen comercial automáticamente
 * Fórmula: margen = (precio_venta - costo) / precio_venta * 100
 */
export function calcularMargenComercial(precioVenta: number, costo: number): number | null {
  if (!precioVenta || precioVenta <= 0) return null;
  if (!costo || costo < 0) return null;
  if (costo >= precioVenta) return 0; // Sin margen o pérdida
  
  const margen = ((precioVenta - costo) / precioVenta) * 100;
  return Math.round(margen * 100) / 100; // Redondear a 2 decimales
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
      // Get current user to set user_id
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Debes iniciar sesión para agregar productos');
      }

      // Calcular margen comercial automáticamente si no se proporciona
      const margenComercial = item.margen_comercial ?? 
        calcularMargenComercial(item.precio_unitario, item.costo_neto);

      const itemWithUserId = {
        ...item,
        margen_comercial: margenComercial,
        user_id: item.user_id || user.id, // Use provided user_id or current user
      };

      const { data, error } = await supabase
        .from('inventory')
        .insert(itemWithUserId)
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
      // Si se actualiza precio_unitario o costo_neto, recalcular margen
      if (updates.precio_unitario !== undefined || updates.costo_neto !== undefined) {
        // Necesitamos obtener el producto actual para calcular el margen
        const { data: currentItem } = await supabase
          .from('inventory')
          .select('precio_unitario, costo_neto')
          .eq('id', id)
          .single();
        
        if (currentItem) {
          const precio = updates.precio_unitario ?? currentItem.precio_unitario;
          const costo = updates.costo_neto ?? currentItem.costo_neto;
          updates.margen_comercial = calcularMargenComercial(precio, costo);
        }
      }

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
