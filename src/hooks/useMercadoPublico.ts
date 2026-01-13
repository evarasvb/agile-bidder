import { useMutation, useQuery } from '@tanstack/react-query';
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
  moneda: string;
  organismo: string;
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
      action: 'licitaciones' | 'ordenes-compra' | 'proveedores' | 'organismos' | 'rubros';
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
