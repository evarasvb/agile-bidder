import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ExpertoLanzamiento {
  fase: 'beta_10' | 'monetizacion';
  cupos_usados: number;
  cupos_maximos: number;
  permitido?: boolean;
  es_beta?: boolean;
  posicion?: number | null;
}

const BETA_POR_DEFECTO: ExpertoLanzamiento = {
  fase: 'beta_10',
  cupos_usados: 0,
  cupos_maximos: 10,
};

/** Estado central del lanzamiento. `reclamar` solo se usa al entrar al Experto. */
export function useExpertoLanzamiento(reclamar = false) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['experto_lanzamiento', reclamar ? 'reclamar' : 'publico', session?.user?.id],
    enabled: !reclamar || !!session?.user?.id,
    staleTime: reclamar ? Infinity : 30_000,
    retry: false,
    queryFn: async () => {
      const rpc = reclamar ? 'experto_beta_reclamar' : 'experto_lanzamiento_publico';
      const { data, error } = await (supabase as any).rpc(rpc);
      // Mientras la migracion y el frontend se publican en orden, el estado
      // seguro es mantener la beta y no mostrar cobros por accidente.
      if (error) return BETA_POR_DEFECTO;
      const estado = (data?.[0] ?? BETA_POR_DEFECTO) as ExpertoLanzamiento;
      if (reclamar && estado.es_beta) queryClient.setQueryData(['experto_mi_plan'], 'plus');
      return estado;
    },
  });
}
