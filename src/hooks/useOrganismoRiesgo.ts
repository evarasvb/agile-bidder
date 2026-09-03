import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Riesgo de pago del organismo comprador (Datos Mercado Público vía FirmaVB). */
export interface OrganismoRiesgo {
  institucion: string;
  rut: string;
  /** Reclamos por incumplir plazo de pago en 12 meses, según la ficha pública de Mercado Público. */
  reclamos_ficha: number | null;
  dato_pago_al: string | null;
  plazo_pago: string | null;
  conducta_pago: string | null;
  pago_promedio_dias: number | null;
  reclamos_pago_12m: number | null;
  reclamos_proceso_12m: number | null;
  reclamantes_pago: number | null;
  top_reclamante_pct: number | null;
  reclamos_pago_90d: number | null;
  procesos_12m: number | null;
  pago_por_100_procesos: number | null;
  reclamos_desde: string | null;
  nivel: 'bajo' | 'medio' | 'alto' | 'sin_dato';
}

export function useOrganismoRiesgo(codigo?: string | null, organismo?: string | null) {
  return useQuery({
    queryKey: ['organismo-riesgo', codigo ?? '', organismo ?? ''],
    queryFn: async (): Promise<OrganismoRiesgo | null> => {
      const { data, error } = await (supabase as any).rpc('organismo_riesgo', {
        p_codigo: codigo ?? null,
        p_nombre: organismo ?? null,
      });
      if (error) throw error;
      return (data?.[0] as OrganismoRiesgo) ?? null;
    },
    enabled: Boolean(codigo || organismo),
    staleTime: 10 * 60 * 1000,
  });
}
