import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstitucionSeguida {
  rut_institucion: string;
  nombre_institucion: string;
  created_at: string;
}

// Lista de instituciones que el cliente sigue (cliente_instituciones_seguidas,
// RLS ya la acota a su propia cuenta).
export function useInstitucionesSeguidas() {
  return useQuery({
    queryKey: ['instituciones-seguidas'],
    queryFn: async (): Promise<InstitucionSeguida[]> => {
      const { data, error } = await supabase
        .from('cliente_instituciones_seguidas')
        .select('rut_institucion, nombre_institucion, created_at')
        .order('nombre_institucion');
      if (error) throw error;
      return (data ?? []) as InstitucionSeguida[];
    },
  });
}

export interface ReclamoZoom {
  fecha: string;
  tipo: number;
  reclamante: string | null;
  estado: string | null;
}
export interface NoticiaZoom {
  titulo: string;
  url: string;
  medio: string | null;
  fecha: string | null;
}
export interface ProcesoZoom {
  codigo: string;
  nombre: string;
  estado: string | null;
  fecha_cierre: string | null;
  fecha_publicacion: string | null;
  presupuesto_estimado?: number | null;
  monto_estimado?: number | null;
}
export interface RfZoom {
  codigo: string;
  nombre: string | null;
  estado: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
}
export interface FuncionarioZoom {
  nombre: string;
  cargo: string | null;
  procesos: number;
  ultimo: string | null;
}
export interface CausaZoom {
  extracto: string;
  fecha: string;
}
export interface CobranzaZoom {
  numero_factura: string | null;
  monto: number;
  fecha_vencimiento: string | null;
  estado: string;
}
export interface InstitucionZoom {
  rut: string;
  encontrada: boolean;
  institucion: string | null;
  conducta_pago: string | null;
  pago_promedio_dias: number | null;
  plazo_pago: string | null;
  pago_actualizado_el: string | null;
  reclamos_ficha: number | null;
  oc_total: number | null;
  oc_monto_total: number | null;
  reclamos_pago_12m: number | null;
  reclamos_proceso_12m: number | null;
  reclamos_pago_90d: number | null;
  reclamantes_pago: number | null;
  top_reclamante_pct: number | null;
  procesos_12m: number | null;
  pago_por_100_procesos: number | null;
  reclamos_desde: string | null;
  nivel: 'bajo' | 'medio' | 'alto' | 'sin_dato' | 'bloqueado';
  reclamos: ReclamoZoom[];
  noticias: NoticiaZoom[];
  licitaciones: ProcesoZoom[];
  compras_agiles: ProcesoZoom[];
  rf: RfZoom[];
  rf_disponible: boolean;
  funcionarios: FuncionarioZoom[];
  causas: CausaZoom[];
  cobranza: CobranzaZoom[];
}

// El "zoom" de una institución: pagos oportunos, reclamos, noticias,
// licitaciones y compras ágiles, todo junto en una sola RPC (institucion_zoom,
// exacta por RUT — ver 20260929143000_institucion_zoom.sql). `nombre` es el
// respaldo cuando rut_institucion no es un RUT real (a veces es un código de
// Mercado Público copiado de ordenes_compra.rut_demandante) ni resuelve por
// licitaciones_bi: institucion_zoom lo usa para buscar por nombre normalizado.
export function useInstitucionZoom(rut: string | null, nombre?: string | null) {
  return useQuery({
    queryKey: ['institucion-zoom', rut, nombre],
    enabled: !!rut,
    queryFn: async (): Promise<InstitucionZoom> => {
      const { data, error } = await (supabase.rpc as any)('institucion_zoom', { p_rut: rut, p_nombre: nombre ?? null });
      if (error) throw error;
      return data as InstitucionZoom;
    },
    staleTime: 5 * 60_000,
  });
}
