import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

// Resuelve la EMPRESA DUEÑA (clientes.id) del usuario. El inventario vive bajo
// clientes.id, NO bajo auth.uid(): usar user.id hacía que un usuario real (donde
// clientes.id != user_id) no pudiera ver NI insertar su inventario (la RLS de
// escritura exige clientes.id y el match une por clientes.id). Ver función SQL
// cliente_owner_id(). Devuelve null si aún no hay empresa.
async function resolverClienteOwnerId(): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('cliente_owner_id');
  if (error) {
    console.error('[inventory] cliente_owner_id error:', error);
    return null;
  }
  return (data as string) ?? null;
}

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
    stock_disponible: row.stock_disponible,
    unidad_medida: 'unidad', // Default since not in table
    tiempo_entrega_dias: row.tiempo_entrega,
    proveedor: null, // Not in table
    activo: true, /* no existe columna activo en cliente_inventario */
    imagen_url: row.imagen_url,
    cliente_id: row.cliente_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useInventory() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const clienteId = user?.id || null;

  return useQuery({
    queryKey: ['inventory', clienteId],
    queryFn: async () => {
      console.log('[useInventory] ===== FETCH START =====');
      console.log('[useInventory] Auth state:', { 
        isAuthenticated, 
        authLoading, 
        userId: user?.id,
        userEmail: user?.email 
      });

      if (!clienteId) {
        console.warn('[useInventory] No auth, returning empty array');
        return [];
      }
      const ownerId = await resolverClienteOwnerId();
      if (!ownerId) return [];

      // Fetch all products without the 1000 row limit using pagination
      const allProducts: InventoryItem[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        console.log(`[useInventory] Fetching page ${page + 1} (rows ${from}-${to})...`);

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('*')
          .eq('cliente_id', ownerId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) {
          console.error('[useInventory] Error fetching inventory:', error);
          console.error('[useInventory] Error details:', {
            message: error.message,
            code: error.code,
            hint: error.hint,
            details: error.details
          });
          throw error;
        }

        if (data && data.length > 0) {
          console.log(`[useInventory] Page ${page + 1}: received ${data.length} products`);
          const mappedData = data.map(mapRowToInventoryItem);
          allProducts.push(...mappedData);
          hasMore = data.length === pageSize;
          page++;
        } else {
          console.log(`[useInventory] Page ${page + 1}: no more products`);
          hasMore = false;
        }
      }

      console.log('[useInventory] ===== FETCH COMPLETE =====');
      console.log(`[useInventory] Total products loaded: ${allProducts.length}`);
      
      if (allProducts.length > 0) {
        console.log('[useInventory] Sample products:', allProducts.slice(0, 3).map(p => ({
          id: p.id,
          sku: p.sku,
          nombre: p.nombre_producto
        })));
      }

      return allProducts;
    },
    // Only run query when we have a valid clienteId and auth is not loading
    enabled: !!clienteId && !authLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

export function useInventoryActivo() {
  const { user, loading: authLoading } = useAuth();
  const clienteId = user?.id || null;

  return useQuery({
    queryKey: ['inventory', 'activo', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const ownerId = await resolverClienteOwnerId();
      if (!ownerId) return [];

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
          .eq('cliente_id', ownerId)
          .order('nombre')
          .range(from, to);

        if (error) {
          console.error('[useInventoryActivo] Error:', error);
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

      console.log(`[useInventoryActivo] Loaded ${allProducts.length} active products`);
      return allProducts;
    },
    enabled: !!clienteId && !authLoading,
  });
}

export function useInventoryItem(id: string | null) {
  const { user, loading: authLoading } = useAuth();
  const clienteId = user?.id || null;

  return useQuery({
    queryKey: ['inventory', id, clienteId],
    queryFn: async () => {
      if (!id || !clienteId) return null;
      const ownerId = await resolverClienteOwnerId();
      if (!ownerId) return null;

      const { data, error } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('id', id)
        .eq('cliente_id', ownerId)
        .maybeSingle();

      if (error) {
        console.error('[useInventoryItem] Error:', error);
        throw error;
      }
      if (!data) return null;

      return mapRowToInventoryItem(data);
    },
    enabled: !!id && !!clienteId && !authLoading,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: InventoryInput) => {
      if (!user?.id) {
        throw new Error('Debes iniciar sesión para agregar productos');
      }
      const clienteId = await resolverClienteOwnerId();
      if (!clienteId) {
        throw new Error('No se encontró tu empresa. Completa tu perfil e intenta de nuevo.');
      }

      const insertData = {
        cliente_id: clienteId,
        sku: item.sku,
        // `nombre` y `nombre_producto` son ambos NOT NULL. Antes solo se seteaba
        // `nombre` → el insert fallaba (nombre_producto sin default) y el trigger
        // que calcula `nombre_norm` (base del match) se alimenta de nombre_producto.
        nombre: item.nombre_producto,
        nombre_producto: item.nombre_producto,
        descripcion: item.descripcion,
        categoria: item.categoria || 'General',
        palabras_clave: item.keywords,
        precio_unitario: item.precio_unitario,
        margen_minimo: item.margen_minimo ?? item.margen_objetivo ?? 15,
        stock_disponible: item.stock_disponible ?? 0,
        tiempo_entrega: item.tiempo_entrega_dias ?? 5,
                imagen_url: item.imagen_url,
      };

      const { data, error } = await supabase
        .from('cliente_inventario')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[useCreateInventoryItem] Error:', error);
        throw error;
      }

      console.log('[useCreateInventoryItem] Created successfully:', data.id);
      return mapRowToInventoryItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryItem> & { id: string }) => {
      if (!user?.id) {
        throw new Error('Debes iniciar sesión para actualizar productos');
      }
      const clienteId = await resolverClienteOwnerId();
      if (!clienteId) throw new Error('No se encontró tu empresa.');

      // Map InventoryItem fields to cliente_inventario fields
      const updateData: Record<string, any> = {};
      // Mantener `nombre` y `nombre_producto` en sincronía (ambos NOT NULL; el
      // trigger de búsqueda/nombre_norm se alimenta de nombre_producto).
      if (updates.nombre_producto !== undefined) { updateData.nombre = updates.nombre_producto; updateData.nombre_producto = updates.nombre_producto; }
      if (updates.descripcion !== undefined) updateData.descripcion = updates.descripcion;
      if (updates.categoria !== undefined) updateData.categoria = updates.categoria;
      if (updates.keywords !== undefined) updateData.palabras_clave = updates.keywords;
      if (updates.precio_unitario !== undefined) updateData.precio_unitario = updates.precio_unitario;
      if (updates.margen_minimo !== undefined) updateData.margen_minimo = updates.margen_minimo;
      if (updates.stock_disponible !== undefined) updateData.stock_disponible = updates.stock_disponible;
      if (updates.tiempo_entrega_dias !== undefined) updateData.tiempo_entrega = updates.tiempo_entrega_dias;
            if (updates.imagen_url !== undefined) updateData.imagen_url = updates.imagen_url;
      if (updates.sku !== undefined) updateData.sku = updates.sku;

      const { data, error } = await supabase
        .from('cliente_inventario')
        .update(updateData)
        .eq('id', id)
        .eq('cliente_id', clienteId)
        .select()
        .single();

      if (error) {
        console.error('[useUpdateInventoryItem] Error:', error);
        throw error;
      }

      console.log('[useUpdateInventoryItem] Updated successfully');
      return mapRowToInventoryItem(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) {
        throw new Error('Debes iniciar sesión para eliminar productos');
      }
      const clienteId = await resolverClienteOwnerId();
      if (!clienteId) throw new Error('No se encontró tu empresa.');

      const { error } = await supabase
        .from('cliente_inventario')
        .delete()
        .eq('id', id)
        .eq('cliente_id', clienteId);

      if (error) {
        console.error('[useDeleteInventoryItem] Error:', error);
        throw error;
      }

      console.log('[useDeleteInventoryItem] Deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// Borrado masivo en lotes: antes Inventory.tsx borraba de a uno, con un
// round-trip por producto (lento con catálogos grandes, ver auditoría de
// experiencia). Un solo `.in('id', ...)` por lote de 500 hace lo mismo con
// muchas menos idas y vueltas al servidor.
export function useDeleteInventoryItems() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user?.id) {
        throw new Error('Debes iniciar sesión para eliminar productos');
      }
      if (ids.length === 0) return;
      const clienteId = await resolverClienteOwnerId();
      if (!clienteId) throw new Error('No se encontró tu empresa.');

      const BATCH_SIZE = 500;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('cliente_inventario')
          .delete()
          .in('id', batch)
          .eq('cliente_id', clienteId);

        if (error) {
          console.error('[useDeleteInventoryItems] Error:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useInventoryStats() {
  const { user, loading: authLoading } = useAuth();
  const clienteId = user?.id || null;

  return useQuery({
    queryKey: ['inventory', 'stats', clienteId],
    queryFn: async () => {
      const emptyStats = { total: 0, activos: 0, sinStock: 0, stockBajo: 0, valorInventario: 0, categorias: [] };
      if (!clienteId) return emptyStats;
      const ownerId = await resolverClienteOwnerId();
      if (!ownerId) return emptyStats;

      // Get count first
      const { count, error: countError } = await supabase
        .from('cliente_inventario')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', ownerId);

      if (countError) {
        console.error('[useInventoryStats] Count error:', countError);
        throw countError;
      }

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
          .select('stock_disponible, precio_unitario, categoria')
          .eq('cliente_id', ownerId)
          .range(from, to);

        if (error) {
          console.error('[useInventoryStats] Error:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allItems.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const activos = allItems; // 'activo' no existe en cliente_inventario; se tratan todos como activos
      const sinStock = allItems.filter(i => i.stock_disponible === 0 || i.stock_disponible === null);
      const stockBajo = allItems.filter(i => i.stock_disponible !== null && i.stock_disponible > 0 && i.stock_disponible < 10);

      const valorTotal = activos.reduce(
                (sum, i) => sum + ((i.precio_unitario || 0) * (i.stock_disponible || 0)),
        0
      );

      const categorias = [...new Set(allItems.map(i => i.categoria).filter(Boolean))] as string[];

      const stats = {
        total: count || allItems.length,
        activos: activos.length,
        sinStock: sinStock.length,
        stockBajo: stockBajo.length,
        valorInventario: valorTotal,
        categorias
      };

      console.log('[useInventoryStats] Stats:', stats);
      return stats;
    },
    enabled: !!clienteId && !authLoading,
  });
}
