import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Tipo base de la BD
type OrdenCompraRow = Database['public']['Tables']['ordenes_compra']['Row'];
type OrdenCompraItemRow = Database['public']['Tables']['ordenes_compra_items']['Row'];

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
  created_at: string;
  updated_at: string;
  // Items asociados (se cargan por separado)
  items?: OrdenCompraItem[];
}

export interface OrdenCompraItem {
  id: string;
  orden_compra_id: string;
  correlativo: number | null;
  codigo_producto: string | null;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  precio_unitario_neto: number | null;
  total_neto: number | null;
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

        // Mejorar datos faltantes desde raw_data si está disponible
        // Extracción más agresiva: SIEMPRE intentar extraer de raw_data si los campos están vacíos/null
        const ordenesMejoradas = ordenes.map((orden) => {
          const rawData = (orden.raw_data || orden.datos_json) as any;
          
          // Función helper para extraer valor de múltiples posibles claves
          const extractValue = (primary: any, ...keys: string[]): any => {
            if (primary !== null && primary !== undefined && primary !== '') return primary;
            if (!rawData || typeof rawData !== 'object') return null;
            
            for (const key of keys) {
              const value = rawData[key];
              if (value !== null && value !== undefined && value !== '') {
                return value;
              }
            }
            return null;
          };

          // Siempre intentar extraer, incluso si algunos campos ya tienen valores
          const mejorada = {
            ...orden,
            institucion_nombre: extractValue(
              orden.institucion_nombre, 
              'Organismo', 'organismo', 'Institucion', 'institucion', 'InstitucionNombre'
            ),
            institucion_rut: extractValue(
              orden.institucion_rut,
              'RutOrganismo', 'rut_organismo', 'RUTOrganismo', 'rutOrganismo', 'InstitucionRut'
            ),
            proveedor_nombre: extractValue(
              orden.proveedor_nombre,
              'Proveedor', 'proveedor', 'ProveedorNombre'
            ),
            proveedor_rut: extractValue(
              orden.proveedor_rut,
              'RutProveedor', 'rut_proveedor', 'RUTProveedor', 'rutProveedor'
            ),
            total: extractValue(
              orden.total,
              'Total', 'total', 'MontoTotal', 'monto_total'
            ),
            total_neto: extractValue(
              orden.total_neto,
              'TotalNeto', 'total_neto', 'MontoNeto', 'monto_neto'
            ),
            estado: extractValue(
              orden.estado,
              'Estado', 'estado', 'Status', 'status'
            ),
            fecha_creacion: extractValue(
              orden.fecha_creacion,
              'FechaCreacion', 'fecha_creacion', 'Fecha', 'fecha', 'created_at'
            ),
            fecha_envio: extractValue(
              orden.fecha_envio,
              'FechaEnvio', 'fecha_envio', 'FechaEnvío', 'sent_at'
            ),
          } as OrdenCompraRow;

          return mejorada;
        });

        // Si se solicitan items, cargarlos
<<<<<<< Updated upstream
        if (includeItems && ordenes.length > 0) {
          const ordenIds = ordenes.map(o => o.id);
=======
        if (includeItems && ordenesMejoradas.length > 0) {
          const codigos = ordenesMejoradas.map(o => o.codigo);
>>>>>>> Stashed changes
          const { data: itemsData, error: itemsError } = await supabase
            .from('ordenes_compra_items')
            .select('*')
            .in('orden_compra_id', ordenIds)
            .order('correlativo');

          if (itemsError) {
            console.error('Error obteniendo items:', itemsError);
          } else {
            // Agrupar items por orden
            const itemsMap = new Map<string, OrdenCompraItem[]>();
            (itemsData || []).forEach((item: OrdenCompraItemRow) => {
              if (!itemsMap.has(item.orden_compra_id)) {
                itemsMap.set(item.orden_compra_id, []);
              }
              itemsMap.get(item.orden_compra_id)!.push({
                id: item.id,
                orden_compra_id: item.orden_compra_id,
                correlativo: item.correlativo,
                codigo_producto: item.codigo_producto,
                nombre_producto: item.nombre_producto,
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                unidad: item.unidad,
                precio_unitario_neto: item.precio_unitario_neto,
                total_neto: item.total_neto,
                created_at: item.created_at,
              });
            });

            // Asignar items a cada orden
<<<<<<< Updated upstream
            return ordenes.map((orden): OrdenCompra => ({
              id: orden.id,
              codigo: orden.codigo,
              nombre: orden.nombre,
              descripcion: orden.descripcion,
              institucion_nombre: orden.institucion_nombre,
              institucion_rut: orden.institucion_rut,
              proveedor_nombre: orden.proveedor_nombre,
              proveedor_rut: orden.proveedor_rut,
              total_neto: orden.total_neto,
              total: orden.total,
              fecha_creacion: orden.fecha_creacion,
              fecha_envio: orden.fecha_envio,
              fecha_aceptacion: orden.fecha_aceptacion,
              estado: orden.estado,
              created_at: orden.created_at,
              updated_at: orden.updated_at,
              items: itemsMap.get(orden.id) || [],
            }));
          }
        }

        return ordenes.map((orden): OrdenCompra => ({
          id: orden.id,
          codigo: orden.codigo,
          nombre: orden.nombre,
          descripcion: orden.descripcion,
          institucion_nombre: orden.institucion_nombre,
          institucion_rut: orden.institucion_rut,
          proveedor_nombre: orden.proveedor_nombre,
          proveedor_rut: orden.proveedor_rut,
          total_neto: orden.total_neto,
          total: orden.total,
          fecha_creacion: orden.fecha_creacion,
          fecha_envio: orden.fecha_envio,
          fecha_aceptacion: orden.fecha_aceptacion,
          estado: orden.estado,
          created_at: orden.created_at,
          updated_at: orden.updated_at,
          items: undefined,
=======
            ordenesMejoradas.forEach(orden => {
              (orden as any).items = itemsMap.get(orden.codigo) || [];
            });
          }
        }

        return ordenesMejoradas.map((orden): OrdenCompra => ({
          ...orden,
          datos_json: orden.datos_json as Record<string, unknown> | null,
          items: includeItems ? (orden as any).items : undefined,
>>>>>>> Stashed changes
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

        // Extraer datos faltantes desde raw_data (misma lógica que useOrdenesCompra)
        const rawData = (orden.raw_data || orden.datos_json) as any;
        
        const extractValue = (primary: any, ...keys: string[]): any => {
          if (primary !== null && primary !== undefined && primary !== '') return primary;
          if (!rawData || typeof rawData !== 'object') return null;
          
          for (const key of keys) {
            const value = rawData[key];
            if (value !== null && value !== undefined && value !== '') {
              return value;
            }
          }
          return null;
        };

        const ordenMejorada = {
          ...orden,
          institucion_nombre: extractValue(
            orden.institucion_nombre, 
            'Organismo', 'organismo', 'Institucion', 'institucion', 'InstitucionNombre'
          ),
          institucion_rut: extractValue(
            orden.institucion_rut,
            'RutOrganismo', 'rut_organismo', 'RUTOrganismo', 'rutOrganismo', 'InstitucionRut'
          ),
          proveedor_nombre: extractValue(
            orden.proveedor_nombre,
            'Proveedor', 'proveedor', 'ProveedorNombre'
          ),
          proveedor_rut: extractValue(
            orden.proveedor_rut,
            'RutProveedor', 'rut_proveedor', 'RUTProveedor', 'rutProveedor'
          ),
          total: extractValue(
            orden.total,
            'Total', 'total', 'MontoTotal', 'monto_total'
          ),
          total_neto: extractValue(
            orden.total_neto,
            'TotalNeto', 'total_neto', 'MontoNeto', 'monto_neto'
          ),
          estado: extractValue(
            orden.estado,
            'Estado', 'estado', 'Status', 'status'
          ),
          fecha_creacion: extractValue(
            orden.fecha_creacion,
            'FechaCreacion', 'fecha_creacion', 'Fecha', 'fecha', 'created_at'
          ),
          fecha_envio: extractValue(
            orden.fecha_envio,
            'FechaEnvio', 'fecha_envio', 'FechaEnvío', 'sent_at'
          ),
        } as OrdenCompraRow;

        let items: OrdenCompraItem[] = [];

        if (includeItems) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('ordenes_compra_items')
            .select('*')
            .eq('orden_compra_id', orden.id)
            .order('correlativo');

          if (itemsError) {
            console.error('Error obteniendo items:', itemsError);
          } else {
            items = (itemsData || []).map((item: OrdenCompraItemRow): OrdenCompraItem => ({
              id: item.id,
              orden_compra_id: item.orden_compra_id,
              correlativo: item.correlativo,
              codigo_producto: item.codigo_producto,
              nombre_producto: item.nombre_producto,
              descripcion: item.descripcion,
              cantidad: item.cantidad,
              unidad: item.unidad,
              precio_unitario_neto: item.precio_unitario_neto,
              total_neto: item.total_neto,
              created_at: item.created_at,
            }));
          }
        }

        return {
<<<<<<< Updated upstream
          id: orden.id,
          codigo: orden.codigo,
          nombre: orden.nombre,
          descripcion: orden.descripcion,
          institucion_nombre: orden.institucion_nombre,
          institucion_rut: orden.institucion_rut,
          proveedor_nombre: orden.proveedor_nombre,
          proveedor_rut: orden.proveedor_rut,
          total_neto: orden.total_neto,
          total: orden.total,
          fecha_creacion: orden.fecha_creacion,
          fecha_envio: orden.fecha_envio,
          fecha_aceptacion: orden.fecha_aceptacion,
          estado: orden.estado,
          created_at: orden.created_at,
          updated_at: orden.updated_at,
=======
          ...ordenMejorada,
          datos_json: orden.datos_json as Record<string, unknown> | null,
>>>>>>> Stashed changes
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

export function useOrdenCompraItems(ordenCompraId: string | null) {
  return useQuery({
    queryKey: ['orden_compra_items', ordenCompraId],
    queryFn: async (): Promise<OrdenCompraItem[]> => {
      if (!ordenCompraId) return [];

      try {
        const { data, error } = await supabase
          .from('ordenes_compra_items')
          .select('*')
          .eq('orden_compra_id', ordenCompraId)
          .order('correlativo');

        if (error) {
          console.error('Error obteniendo items:', error);
          throw new Error(`Error al obtener items: ${error.message}`);
        }

        return (data || []).map((item: OrdenCompraItemRow): OrdenCompraItem => ({
          id: item.id,
          orden_compra_id: item.orden_compra_id,
          correlativo: item.correlativo,
          codigo_producto: item.codigo_producto,
          nombre_producto: item.nombre_producto,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          unidad: item.unidad,
          precio_unitario_neto: item.precio_unitario_neto,
          total_neto: item.total_neto,
          created_at: item.created_at,
        }));
      } catch (error) {
        console.error('Error en useOrdenCompraItems:', error);
        throw error;
      }
    },
    enabled: !!ordenCompraId,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useUpsertOrdenCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orden, items }: { orden: Partial<OrdenCompra>; items?: Partial<OrdenCompraItem>[] }) => {
      try {
        // Prepare orden data for upsert (remove items and non-DB fields)
        const ordenData = {
          codigo: orden.codigo!,
          nombre: orden.nombre ?? null,
          descripcion: orden.descripcion ?? null,
          institucion_nombre: orden.institucion_nombre ?? null,
          institucion_rut: orden.institucion_rut ?? null,
          proveedor_nombre: orden.proveedor_nombre ?? null,
          proveedor_rut: orden.proveedor_rut ?? null,
          total_neto: orden.total_neto ?? null,
          total: orden.total ?? null,
          fecha_creacion: orden.fecha_creacion ?? null,
          fecha_envio: orden.fecha_envio ?? null,
          fecha_aceptacion: orden.fecha_aceptacion ?? null,
          estado: orden.estado ?? null,
        };

        // Upsert orden
        const { data: savedOrden, error: ordenError } = await supabase
          .from('ordenes_compra')
          .upsert(ordenData, { onConflict: 'codigo' })
          .select()
          .single();

        if (ordenError) {
          console.error('Error upserting orden:', ordenError);
          throw new Error(`Error al guardar orden: ${ordenError.message}`);
        }

        // Si hay items, upsertlos
        if (items && items.length > 0 && savedOrden) {
          const itemsToInsert = items.map((item, index) => ({
            orden_compra_id: savedOrden.id,
            correlativo: item.correlativo ?? index + 1,
            codigo_producto: item.codigo_producto ?? null,
            nombre_producto: item.nombre_producto ?? 'Sin nombre',
            descripcion: item.descripcion ?? null,
            cantidad: item.cantidad ?? 0,
            unidad: item.unidad ?? null,
            precio_unitario_neto: item.precio_unitario_neto ?? null,
            total_neto: item.total_neto ?? null,
          }));

          // Eliminar items existentes y insertar nuevos
          await supabase
            .from('ordenes_compra_items')
            .delete()
            .eq('orden_compra_id', savedOrden.id);

          const { error: itemsError } = await supabase
            .from('ordenes_compra_items')
            .insert(itemsToInsert);

          if (itemsError) {
            console.error('Error upserting items:', itemsError);
            throw new Error(`Error al guardar items: ${itemsError.message}`);
          }
        }

        return savedOrden;
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