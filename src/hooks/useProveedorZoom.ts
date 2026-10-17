import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ProveedorIdentidad {
  nombre: string;
  rut_norm: string | null;
  rut: string | null;
  ordenes: number;
  monto_total: number;
  compradores: number;
  primera_orden: string | null;
  ultima_orden: string | null;
}
export interface ProveedorTendenciaMes { mes: string; ordenes: number; monto: number }
export interface ProveedorProducto { producto: string; lineas: number; monto: number; precio_prom: number | null }
export interface ProveedorCliente { comprador: string; ordenes: number; monto: number }
export interface ProveedorLicitacion {
  codigo: string; titulo: string | null; comprador_nombre: string | null;
  fecha_adjudicacion: string | null; fecha_publicacion: string | null;
  monto_estimado: number | null; estado_award: string | null; num_oferentes: number | null;
  monto_ganado: number | null;
}
export interface ProveedorZoom {
  identidad: ProveedorIdentidad;
  tendencia_mensual: ProveedorTendenciaMes[];
  productos: ProveedorProducto[];
  clientes: ProveedorCliente[];
  licitaciones_resumen: { participo: number; gano: number; monto_adjudicado_total: number };
  licitaciones_recientes: ProveedorLicitacion[];
}

// Modo estudio de la competencia (pedido de Evaristo): ficha profunda de UN
// proveedor competidor, identificado por RUT (no solo nombre como el reporte
// de Competidores) — permite cruzar también licitaciones (OCDS) donde
// participó, no solo órdenes de compra ya facturadas.
export function useProveedorZoom(nombre: string | null, enabled = true) {
  return useQuery({
    queryKey: ['proveedor-zoom', nombre],
    enabled: !!nombre && enabled,
    queryFn: async (): Promise<ProveedorZoom> => {
      const { data, error } = await (supabase.rpc as any)('proveedor_zoom', { p_nombre: nombre });
      if (error) throw error;
      return data as ProveedorZoom;
    },
    staleTime: 10 * 60_000,
  });
}

export interface EstudioCompetidor {
  id: string;
  proveedor_rut: string;
  proveedor_nombre: string;
  resumen: string;
  fortalezas: string[];
  debilidades: string[];
  recomendacion: string | null;
  generado_en: string;
}

// Análisis de IA cacheado (fortalezas/debilidades/cómo competirle) — se
// genera una vez por botón, igual que useAnalisisPostulacion.
export function useEstudioCompetidor(rutNorm: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['estudio-competidor', user?.id, rutNorm],
    enabled: !!user?.id && !!rutNorm,
    queryFn: async (): Promise<EstudioCompetidor | null> => {
      const { data, error } = await (supabase
        .from as any)('estudio_competidor')
        .select('id, proveedor_rut, proveedor_nombre, resumen, fortalezas, debilidades, recomendacion, generado_en')
        .eq('proveedor_rut', rutNorm)
        .maybeSingle();
      if (error) throw error;
      return (data as EstudioCompetidor | null) ?? null;
    },
  });
}

export function useGenerarEstudioCompetidor(nombre: string | null, rutNorm: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<EstudioCompetidor> => {
      if (!nombre) throw new Error('Falta el competidor');
      const { data, error } = await supabase.functions.invoke<EstudioCompetidor & { error?: string }>('estudio-competidor', {
        body: { nombre, rut: rutNorm },
      });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || 'No se pudo generar el estudio');
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['estudio-competidor', user?.id, data.proveedor_rut], data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo generar el estudio de IA');
    },
  });
}
