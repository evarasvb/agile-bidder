import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LicitacionMP {
  id: string;
  titulo: string;
  descripcion?: string;
  organismo: string;
  estado: string;
  tipo: string;
  fecha_cierre: string;
  fecha_publicacion: string;
  presupuesto?: number;
  moneda?: string;
  institucion_rut?: string;
  unidad_compra?: string;
  items?: LicitacionItemMP[];
}

interface LicitacionItemMP {
  correlativo: number;
  codigo_producto: number;
  categoria: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
}

interface OrdenCompraMP {
  codigo: string;
  nombre: string;
  estado: string;
  tipo: string;
  fecha_envio: string;
  fecha_aceptacion?: string;
  proveedor: string;
  rut_proveedor: string;
  total: number;
  total_neto?: number;
  moneda: string;
  organismo: string;
  rut_organismo?: string;
  licitacion_codigo?: string;
  items?: OrdenCompraItemMP[];
}

interface OrdenCompraItemMP {
  correlativo: number;
  codigo_producto: number;
  categoria: string;
  nombre: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_neto: number;
  total_neto: number;
}

interface MPLicitacionesResponse {
  total: number;
  licitaciones: LicitacionMP[];
  error?: string;
}

interface MPOrdenesResponse {
  total: number;
  ordenes: OrdenCompraMP[];
  error?: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  errors: string[];
  details: {
    fecha: string;
    totalFromApi: number;
    synced: number;
  };
}

// Hook para obtener licitaciones de MercadoPúblico
export function useMercadoPublicoLicitaciones(params?: {
  fecha?: string;
  codigo?: string;
  organismo?: string;
  estado?: string;
}) {
  return useQuery({
    queryKey: ['mercadopublico', 'licitaciones', params],
    queryFn: async (): Promise<MPLicitacionesResponse> => {
      const { data, error } = await supabase.functions.invoke('mercadopublico-api', {
        body: { ...params }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    enabled: false, // Manual trigger only
    retry: 1,
  });
}

// Hook para obtener detalle de una licitación
export function useMercadoPublicoLicitacionDetalle(codigo: string | null) {
  return useQuery({
    queryKey: ['mercadopublico', 'licitacion', codigo],
    queryFn: async (): Promise<LicitacionMP | null> => {
      if (!codigo) return null;

      const { data, error } = await supabase.functions.invoke('mercadopublico-api?action=licitacion-detalle', {
        body: { codigo }
      });

      if (error) throw error;
      
      return data.licitaciones?.[0] || null;
    },
    enabled: !!codigo,
  });
}

// Hook para obtener órdenes de compra (para BI de competencia)
export function useMercadoPublicoOrdenes(params?: {
  fecha?: string;
  proveedor?: string;
  organismo?: string;
}) {
  return useQuery({
    queryKey: ['mercadopublico', 'ordenes', params],
    queryFn: async (): Promise<MPOrdenesResponse> => {
      const { data, error } = await supabase.functions.invoke('mercadopublico-api?action=ordenes-compra', {
        body: { ...params }
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    enabled: false, // Manual trigger only
    retry: 1,
  });
}

// Mutation hook para consultas ad-hoc
export function useMercadoPublicoQuery() {
  return useMutation({
    mutationFn: async ({ action, params }: { 
      action: 'licitaciones' | 'ordenes-compra' | 'orden-detalle' | 'licitacion-detalle' | 'proveedores' | 'organismos' | 'rubros';
      params?: Record<string, string>;
    }) => {
      const { data, error } = await supabase.functions.invoke(`mercadopublico-api?action=${action}`, {
        body: params || {}
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onError: (error: any) => {
      console.error('Error consultando MercadoPúblico:', error);
      if (error.message?.includes('API key')) {
        toast.error('API key de MercadoPúblico no configurada');
      } else {
        toast.error('Error consultando MercadoPúblico');
      }
    }
  });
}

// =====================================================
// Hooks para sincronizar datos a la base de datos (BI)
// =====================================================

// Hook para sincronizar órdenes de compra
export function useSyncOrdenesCompra() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      fecha?: string;
      organismo?: string;
      proveedor?: string;
    }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('mercadopublico-api?action=sync-ordenes', {
        body: params
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenes-compra-bi'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores-bi'] });
      queryClient.invalidateQueries({ queryKey: ['instituciones-bi'] });
      
      if (data.success) {
        toast.success(`${data.synced} órdenes de compra sincronizadas`);
      } else {
        toast.warning(`Sincronización parcial: ${data.synced} órdenes, ${data.errors.length} errores`);
      }
    },
    onError: (error: any) => {
      console.error('Error sincronizando órdenes:', error);
      toast.error('Error sincronizando órdenes de compra');
    }
  });
}

// Hook para sincronizar licitaciones
export function useSyncLicitaciones() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: {
      fecha?: string;
      organismo?: string;
      estado?: string;
    }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('mercadopublico-api?action=sync-licitaciones', {
        body: params
      });

      if (error) throw error;
      
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones-bi'] });
      
      if (data.success) {
        toast.success(`${data.synced} licitaciones sincronizadas`);
      } else {
        toast.warning(`Sincronización parcial: ${data.synced} licitaciones, ${data.errors.length} errores`);
      }
    },
    onError: (error: any) => {
      console.error('Error sincronizando licitaciones:', error);
      toast.error('Error sincronizando licitaciones');
    }
  });
}

// =====================================================
// Hooks para consultar datos almacenados en BD (BI)
// =====================================================

// Hook para obtener órdenes de compra almacenadas
export function useOrdenesCompraBI(filters?: {
  desde?: string;
  hasta?: string;
  proveedor_rut?: string;
  institucion_rut?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['ordenes-compra-bi', filters],
    queryFn: async () => {
      let query = supabase
        .from('ordenes_compra')
        .select(`
          *,
          ordenes_compra_items (*)
        `)
        .order('fecha_envio', { ascending: false });

      if (filters?.desde) {
        query = query.gte('fecha_envio', filters.desde);
      }
      if (filters?.hasta) {
        query = query.lte('fecha_envio', filters.hasta);
      }
      if (filters?.proveedor_rut) {
        query = query.eq('proveedor_rut', filters.proveedor_rut);
      }
      if (filters?.institucion_rut) {
        query = query.eq('institucion_rut', filters.institucion_rut);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

// Hook para obtener licitaciones almacenadas
export function useLicitacionesBI(filters?: {
  desde?: string;
  hasta?: string;
  institucion_rut?: string;
  estado?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['licitaciones-bi', filters],
    queryFn: async () => {
      let query = supabase
        .from('licitaciones_bi')
        .select(`
          *,
          licitaciones_bi_items (*),
          licitaciones_adjudicaciones (*)
        `)
        .order('fecha_cierre', { ascending: false });

      if (filters?.desde) {
        query = query.gte('fecha_cierre', filters.desde);
      }
      if (filters?.hasta) {
        query = query.lte('fecha_cierre', filters.hasta);
      }
      if (filters?.institucion_rut) {
        query = query.eq('institucion_rut', filters.institucion_rut);
      }
      if (filters?.estado) {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

// Hook para obtener proveedores almacenados
export function useProveedoresBI(filters?: {
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['proveedores-bi', filters],
    queryFn: async () => {
      let query = supabase
        .from('proveedores')
        .select('*')
        .order('nombre');

      if (filters?.search) {
        query = query.or(`nombre.ilike.%${filters.search}%,rut.ilike.%${filters.search}%`);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

// Hook para obtener instituciones almacenadas
export function useInstitucionesBI(filters?: {
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['instituciones-bi', filters],
    queryFn: async () => {
      let query = supabase
        .from('instituciones')
        .select('*')
        .order('nombre');

      if (filters?.search) {
        query = query.or(`nombre.ilike.%${filters.search}%,rut.ilike.%${filters.search}%`);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
}

// Hook para estadísticas de BI
export function useBIStats() {
  return useQuery({
    queryKey: ['bi-stats'],
    queryFn: async () => {
      // Total órdenes de compra
      const { count: totalOrdenes } = await supabase
        .from('ordenes_compra')
        .select('*', { count: 'exact', head: true });

      // Total licitaciones
      const { count: totalLicitaciones } = await supabase
        .from('licitaciones_bi')
        .select('*', { count: 'exact', head: true });

      // Total proveedores
      const { count: totalProveedores } = await supabase
        .from('proveedores')
        .select('*', { count: 'exact', head: true });

      // Total instituciones
      const { count: totalInstituciones } = await supabase
        .from('instituciones')
        .select('*', { count: 'exact', head: true });

      // Últimas órdenes
      const { data: ultimasOrdenes } = await supabase
        .from('ordenes_compra')
        .select('codigo, nombre, proveedor_nombre, total, fecha_envio')
        .order('fecha_envio', { ascending: false })
        .limit(5);

      return {
        totalOrdenes: totalOrdenes || 0,
        totalLicitaciones: totalLicitaciones || 0,
        totalProveedores: totalProveedores || 0,
        totalInstituciones: totalInstituciones || 0,
        ultimasOrdenes: ultimasOrdenes || []
      };
    }
  });
}

// Hook para análisis de BI de organismos
export function useOrganismoBI(organismoId: string | null) {
  const ordenesMutation = useMercadoPublicoQuery();

  const getOrganismoStats = async (organismo: string) => {
    try {
      const today = new Date();
      const stats = {
        totalOrdenes: 0,
        montoTotal: 0,
        proveedoresFrecuentes: [] as { nombre: string; rut: string; total: number }[],
        ultimasOrdenes: [] as OrdenCompraMP[]
      };

      // Obtener últimos 30 días de órdenes
      for (let i = 0; i < 30; i++) {
        const fecha = new Date(today);
        fecha.setDate(fecha.getDate() - i);
        const fechaStr = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '');
        
        try {
          const data = await ordenesMutation.mutateAsync({
            action: 'ordenes-compra',
            params: { organismo, fecha: fechaStr }
          });

          if (data.ordenes) {
            stats.totalOrdenes += data.ordenes.length;
            stats.montoTotal += data.ordenes.reduce((sum: number, oc: OrdenCompraMP) => sum + (oc.total || 0), 0);
            stats.ultimasOrdenes.push(...data.ordenes.slice(0, 5));
          }
        } catch (e) {
          // Skip days with no data
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting organismo BI:', error);
      throw error;
    }
  };

  return {
    getOrganismoStats,
    isLoading: ordenesMutation.isPending
  };
}
