import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Tipo base de la BD
type OrdenCompraRow = Database['public']['Tables']['ordenes_compra']['Row'];
type OrdenCompraItemRow = Database['public']['Tables']['orden_compra_items']['Row'];

export interface OrdenCompra {
  id: string;
  codigo: string;
  nombre: string | null;
  descripcion: string | null;
  institucion_nombre: string | null;
  institucion_rut: string | null;
  proveedor_nombre: string | null;
  proveedor_rut: string | null;
  total_neto: number | null;
  total: number | null;
  fecha_creacion: string | null;
  fecha_envio: string | null;
  fecha_aceptacion: string | null;
  estado: string | null;
  link_oficial: string | null;
  datos_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Items asociados (se cargan por separado)
  items?: OrdenCompraItem[];
}

export interface OrdenCompraItem {
  id: string;
  orden_compra_codigo: string;
  item_index: number;
  producto_id: string | null;
  nombre_producto: string | null;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  precio_unitario: number | null;
  subtotal: number | null;
  created_at: string;
}

export interface OrdenesCompraFilters {
  institucion_rut?: string;
  institucion_nombre?: string;
  proveedor_rut?: string;
  proveedor_nombre?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  search?: string; // Búsqueda general en código, nombre, RUTs
}

export function useOrdenesCompra(filters?: OrdenesCompraFilters, includeItems = false) {
  return useQuery({
    queryKey: ['ordenes_compra', filters, includeItems],
    queryFn: async () => {
      try {
        let query = supabase
          .from('ordenes_compra')
          .select('*')
          .order('fecha_creacion', { ascending: false })
          .limit(1000);

        // Filtros
        if (filters?.institucion_rut) {
          query = query.eq('institucion_rut', filters.institucion_rut);
        }

        if (filters?.proveedor_rut) {
          query = query.eq('proveedor_rut', filters.proveedor_rut);
        }

        if (filters?.estado) {
          query = query.eq('estado', filters.estado);
        }

        if (filters?.fecha_desde) {
          query = query.gte('fecha_creacion', filters.fecha_desde);
        }

        if (filters?.fecha_hasta) {
          query = query.lte('fecha_creacion', filters.fecha_hasta);
        }

        // Búsqueda general (código, nombre, RUTs)
        if (filters?.search) {
          const searchTerm = filters.search.toLowerCase();
          query = query.or(
            `codigo.ilike.%${searchTerm}%,nombre.ilike.%${searchTerm}%,institucion_nombre.ilike.%${searchTerm}%,institucion_rut.ilike.%${searchTerm}%,proveedor_nombre.ilike.%${searchTerm}%,proveedor_rut.ilike.%${searchTerm}%`
          );
        }

        // Filtro por nombre de institución
        if (filters?.institucion_nombre) {
          query = query.ilike('institucion_nombre', `%${filters.institucion_nombre}%`);
        }

        // Filtro por nombre de proveedor
        if (filters?.proveedor_nombre) {
          query = query.ilike('proveedor_nombre', `%${filters.proveedor_nombre}%`);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error obteniendo órdenes de compra:', error);
          throw new Error(`Error al obtener órdenes de compra: ${error.message}`);
        }

        const ordenes = (data || []) as OrdenCompraRow[];

        // Si se solicitan items, cargarlos
        if (includeItems && ordenes.length > 0) {
          const codigos = ordenes.map(o => o.codigo);
          const { data: itemsData, error: itemsError } = await supabase
            .from('orden_compra_items')
            .select('*')
            .in('orden_compra_codigo', codigos)
            .order('orden_compra_codigo, item_index');

          if (itemsError) {
            console.error('Error obteniendo items:', itemsError);
          } else {
            // Agrupar items por orden
            const itemsMap = new Map<string, OrdenCompraItem[]>();
            (itemsData || []).forEach((item: OrdenCompraItemRow) => {
              if (!itemsMap.has(item.orden_compra_codigo)) {
                itemsMap.set(item.orden_compra_codigo, []);
              }
              itemsMap.get(item.orden_compra_codigo)!.push({
                ...item,
                cantidad: item.cantidad,
                precio_unitario: item.precio_unitario,
                subtotal: item.subtotal,
              });
            });

            // Asignar items a cada orden
            ordenes.forEach(orden => {
              orden.items = itemsMap.get(orden.codigo) || [];
            });
          }
        }

        return ordenes.map((orden): OrdenCompra => ({
          ...orden,
          datos_json: orden.datos_json as Record<string, unknown> | null,
          items: includeItems ? (orden as any).items : undefined,
        }));
      } catch (error) {
        console.error('Error en useOrdenesCompra:', error);
        throw error;
      }
    },
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useOrdenCompra(codigo: string | null, includeItems = true) {
  return useQuery({
    queryKey: ['orden_compra', codigo, includeItems],
    queryFn: async (): Promise<OrdenCompra | null> => {
      if (!codigo) return null;

      try {
        const { data: orden, error: ordenError } = await supabase
          .from('ordenes_compra')
          .select('*')
          .eq('codigo', codigo)
          .maybeSingle();

        if (ordenError) {
          console.error('Error obteniendo orden de compra:', ordenError);
          throw new Error(`Error al obtener orden de compra: ${ordenError.message}`);
        }

        if (!orden) return null;

        let items: OrdenCompraItem[] = [];

        if (includeItems) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('orden_compra_items')
            .select('*')
            .eq('orden_compra_codigo', codigo)
            .order('item_index');

          if (itemsError) {
            console.error('Error obteniendo items:', itemsError);
          } else {
            items = (itemsData || []).map((item: OrdenCompraItemRow) => ({
              ...item,
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              subtotal: item.subtotal,
            }));
          }
        }

        return {
          ...orden,
          datos_json: orden.datos_json as Record<string, unknown> | null,
          items,
        };
      } catch (error) {
        console.error('Error en useOrdenCompra:', error);
        throw error;
      }
    },
    enabled: !!codigo,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useOrdenCompraItems(ordenCompraCodigo: string | null) {
  return useQuery({
    queryKey: ['orden_compra_items', ordenCompraCodigo],
    queryFn: async (): Promise<OrdenCompraItem[]> => {
      if (!ordenCompraCodigo) return [];

      try {
        const { data, error } = await supabase
          .from('orden_compra_items')
          .select('*')
          .eq('orden_compra_codigo', ordenCompraCodigo)
          .order('item_index');

        if (error) {
          console.error('Error obteniendo items:', error);
          throw new Error(`Error al obtener items: ${error.message}`);
        }

        return (data || []).map((item: OrdenCompraItemRow) => ({
          ...item,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
        }));
      } catch (error) {
        console.error('Error en useOrdenCompraItems:', error);
        throw error;
      }
    },
    enabled: !!ordenCompraCodigo,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useUpsertOrdenCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orden, items }: { orden: Partial<OrdenCompra>; items?: Partial<OrdenCompraItem>[] }) => {
      try {
        // Upsert orden
        const { data: ordenData, error: ordenError } = await supabase
          .from('ordenes_compra')
          .upsert(orden, { onConflict: 'codigo' })
          .select()
          .single();

        if (ordenError) {
          console.error('Error upserting orden:', ordenError);
          throw new Error(`Error al guardar orden: ${ordenError.message}`);
        }

        // Si hay items, upsertlos
        if (items && items.length > 0 && ordenData) {
          const itemsToInsert = items.map((item, index) => ({
            orden_compra_codigo: ordenData.codigo,
            item_index: item.item_index ?? index + 1,
            producto_id: item.producto_id ?? null,
            nombre_producto: item.nombre_producto ?? null,
            descripcion: item.descripcion ?? null,
            cantidad: item.cantidad ?? null,
            unidad: item.unidad ?? null,
            precio_unitario: item.precio_unitario ?? null,
            subtotal: item.subtotal ?? null,
          }));

          // Eliminar items existentes y insertar nuevos
          await supabase
            .from('orden_compra_items')
            .delete()
            .eq('orden_compra_codigo', ordenData.codigo);

          const { error: itemsError } = await supabase
            .from('orden_compra_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error upserting items:', itemsError);
            throw new Error(`Error al guardar items: ${itemsError.message}`);
          }
        }

        return ordenData;
      } catch (error) {
        console.error('Error en useUpsertOrdenCompra:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes_compra'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orden_compra'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['orden_compra_items'], exact: false });
    },
  });
}
