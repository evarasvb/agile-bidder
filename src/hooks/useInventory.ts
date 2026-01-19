import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Interface based on cliente_inventario table schema with additional UI fields
export interface InventoryItem {
  id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string | null;
  categoria: string | null;
  keywords: string[] | null;
  precio_unitario: number;
  margen_minimo: number | null;
  margen_objetivo: number | null; // UI field, stored as margen_minimo in DB
  stock_disponible: number | null;
  unidad_medida: string | null; // UI field, not in cliente_inventario
  tiempo_entrega_dias: number | null;
  proveedor: string | null; // UI field, not in cliente_inventario
  activo: boolean | null;
  imagen_url: string | null;
  cliente_id: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryInput {
  sku: string;
  nombre_producto: string;
  descripcion?: string | null;
  categoria?: string | null;
  keywords?: string[] | null;
  precio_unitario: number;
  margen_minimo?: number | null;
  margen_objetivo?: number | null; // UI field
  stock_disponible?: number | null;
  unidad_medida?: string | null; // UI field
  tiempo_entrega_dias?: number | null;
  proveedor?: string | null; // UI field
  activo?: boolean | null;
  imagen_url?: string | null;
}

// Helper to get current user's cliente_id (which equals auth.uid())
async function getClienteId(): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

// Map database row to InventoryItem
function mapRowToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    sku: row.sku,
    nombre_producto: row.nombre,
    descripcion: row.descripcion,
    categoria: row.categoria,
    keywords: row.palabras_clave,
    precio_unitario: row.precio_unitario,
    margen_minimo: row.margen_minimo,
    margen_objetivo: row.margen_minimo, // Use same value as fallback
    stock_disponible: row.stock,
    unidad_medida: 'unidad', // Default since not in table
    tiempo_entrega_dias: row.tiempo_entrega_dias,
    proveedor: null, // Not in table
    activo: row.activo,
    imagen_url: row.imagen_url,
    cliente_id: row.cliente_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useInventory() {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const clienteId = await getClienteId();
      if (!clienteId) {
        console.log('[useInventory] No authenticated user found');
        return [];
      }

      // Fetch all products without the 1000 row limit using pagination
      const allProducts: InventoryItem[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('[useInventory] Error fetching inventory:', error);
          throw error;
        }

        if (data && data.length > 0) {
          const mappedData = data.map(mapRowToInventoryItem);
          allProducts.push(...mappedData);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log(`[useInventory] Loaded ${allProducts.length} products for cliente ${clienteId}`);
      return allProducts;
    },
  });
}

export function useInventoryActivo() {
  return useQuery({
    queryKey: ['inventory', 'activo'],
    queryFn: async () => {
      const clienteId = await getClienteId();
      if (!clienteId) return [];

      const allProducts: InventoryItem[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('activo', true)
          .order('nombre')
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          const mappedData = data.map(mapRowToInventoryItem);
          allProducts.push(...mappedData);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return allProducts;
    },
  });
}

export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => {
      if (!id) return null;

      const clienteId = await getClienteId();
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('id', id)
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapRowToInventoryItem(data);
    },
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: InventoryInput) => {
      const clienteId = await getClienteId();
      if (!clienteId) {
        throw new Error('Debes iniciar sesión para agregar productos');
      }

      const insertData = {
        cliente_id: clienteId,
        sku: item.sku,
        nombre: item.nombre_producto,
        descripcion: item.descripcion,
        categoria: item.categoria || 'General',
        palabras_clave: item.keywords,
        precio_unitario: item.precio_unitario,
        margen_minimo: item.margen_minimo ?? item.margen_objetivo ?? 15,
        stock: item.stock_disponible ?? 0,
        tiempo_entrega_dias: item.tiempo_entrega_dias ?? 5,
        activo: item.activo ?? true,
        imagen_url: item.imagen_url,
      };

      const { data, error } = await supabase
        .from('cliente_inventario')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      return mapRowToInventoryItem(data);
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
      const clienteId = await getClienteId();
      if (!clienteId) {
        throw new Error('Debes iniciar sesión para actualizar productos');
      }

      // Map InventoryItem fields to cliente_inventario fields
      const updateData: Record<string, any> = {};
      if (updates.nombre_producto !== undefined) updateData.nombre = updates.nombre_producto;
      if (updates.descripcion !== undefined) updateData.descripcion = updates.descripcion;
      if (updates.categoria !== undefined) updateData.categoria = updates.categoria;
      if (updates.keywords !== undefined) updateData.palabras_clave = updates.keywords;
      if (updates.precio_unitario !== undefined) updateData.precio_unitario = updates.precio_unitario;
      if (updates.margen_minimo !== undefined) updateData.margen_minimo = updates.margen_minimo;
      if (updates.stock_disponible !== undefined) updateData.stock = updates.stock_disponible;
      if (updates.tiempo_entrega_dias !== undefined) updateData.tiempo_entrega_dias = updates.tiempo_entrega_dias;
      if (updates.activo !== undefined) updateData.activo = updates.activo;
      if (updates.imagen_url !== undefined) updateData.imagen_url = updates.imagen_url;
      if (updates.sku !== undefined) updateData.sku = updates.sku;

      const { data, error } = await supabase
        .from('cliente_inventario')
        .update(updateData)
        .eq('id', id)
        .eq('cliente_id', clienteId)
        .select()
        .single();

      if (error) throw error;

      return mapRowToInventoryItem(data);
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
      const clienteId = await getClienteId();
      if (!clienteId) {
        throw new Error('Debes iniciar sesión para eliminar productos');
      }

      const { error } = await supabase
        .from('cliente_inventario')
        .delete()
        .eq('id', id)
        .eq('cliente_id', clienteId);

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
      const clienteId = await getClienteId();
      if (!clienteId) {
        return {
          total: 0,
          activos: 0,
          sinStock: 0,
          stockBajo: 0,
          valorInventario: 0,
          categorias: []
        };
      }

      // Get count first
      const { count, error: countError } = await supabase
        .from('cliente_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', clienteId);

      if (countError) throw countError;

      // For stats, we need to fetch all data - paginate through
      const allItems: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('activo, stock, precio_unitario, categoria')
          .eq('cliente_id', clienteId)
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allItems.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const activos = allItems.filter(i => i.activo);
      const sinStock = allItems.filter(i => i.stock === 0 || i.stock === null);
      const stockBajo = allItems.filter(i => i.stock !== null && i.stock > 0 && i.stock < 10);

      const valorTotal = activos.reduce(
        (sum, i) => sum + ((i.precio_unitario || 0) * (i.stock || 0)),
        0
      );

      const categorias = [...new Set(allItems.map(i => i.categoria).filter(Boolean))] as string[];

      return {
        total: count || allItems.length,
        activos: activos.length,
        sinStock: sinStock.length,
        stockBajo: stockBajo.length,
        valorInventario: valorTotal,
        categorias
      };
    },
  });
}
