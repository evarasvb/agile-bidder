import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CriterioFrecuente {
  criterio_ejemplo: string;
  n_procesos: number;
  ponderacion_prom: number | null;
}

// Qué criterios de evaluación se repiten más entre las licitaciones donde se
// generó un "Libro de licitación" (Experto, plan Pro). Directorio
// colaborativo: lo alimenta cualquier cliente de FirmaVB que haya generado
// una matriz, y lo ve cualquiera (es inteligencia de mercado sobre cómo
// evalúa el Estado, no un dato privado de una empresa).
export function useCriteriosMasFrecuentes(limite = 25) {
  return useQuery({
    queryKey: ['criterios-mas-frecuentes', limite],
    queryFn: async (): Promise<CriterioFrecuente[]> => {
      const { data, error } = await (supabase.rpc as any)('criterios_mas_frecuentes', { p_limite: limite });
      if (error) throw error;
      return (data ?? []) as CriterioFrecuente[];
    },
    staleTime: 10 * 60_000,
  });
}
