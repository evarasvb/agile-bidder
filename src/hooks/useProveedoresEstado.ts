import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Inteligencia de proveedores del Estado (solo admin). Se sirve por RPC security-definer
// sobre la vista materializada mv_proveedores_estado, agregada desde las órdenes de compra.
export interface ProveedorEstado {
  rut_proveedor: string;
  proveedor_nombre: string | null;
  n_ocs: number;
  n_ocs_2026: number;
  monto_total: number;
  monto_2026: number;
  ultima_fecha: string | null;
}

export function useProveedoresEstado(q: string, rubro = '', institucion = '', limit = 50) {
  const term = q.trim();
  return useQuery({
    queryKey: ['proveedores-estado', term, rubro, institucion.trim(), limit],
    queryFn: async (): Promise<ProveedorEstado[]> => {
      const { data, error } = await (supabase as any).rpc('proveedores_estado', {
        q: term || null,
        rubro: rubro || null,
        institucion: institucion.trim() || null,
        lim: limit,
        off: 0,
      });
      if (error) throw error;
      return (data || []) as ProveedorEstado[];
    },
    staleTime: 60000,
  });
}

// Lista de rubros (RubroN1) para el desplegable del filtro. Solo admin.
export function useRubrosEstado() {
  return useQuery({
    queryKey: ['rubros-estado'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).rpc('rubros_estado');
      if (error) throw error;
      return ((data || []) as { rubro: string }[]).map((r) => r.rubro).filter(Boolean);
    },
    staleTime: 300000,
  });
}

export interface ProveedorDetalle {
  rubros: { rubro: string; n: number; monto: number }[];
  instituciones: { institucion: string; n: number; monto: number }[];
}

export function useProveedorEstadoDetalle(rut: string | null) {
  return useQuery({
    queryKey: ['proveedor-estado-detalle', rut],
    enabled: !!rut,
    queryFn: async (): Promise<ProveedorDetalle | null> => {
      if (!rut) return null;
      const { data, error } = await (supabase as any).rpc('proveedor_estado_detalle', { p_rut: rut });
      if (error) throw error;
      return (data || { rubros: [], instituciones: [] }) as ProveedorDetalle;
    },
    staleTime: 60000,
  });
}
