import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// El RPC garantias_de_bases es reciente y aún no está en los tipos generados
// de Supabase; se llama vía un wrapper tipado hasta regenerar los types.
type RpcFn = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as RpcFn;

export interface GarantiaBases {
  seriedad: string | null;
  fiel_cumplimiento: string | null;
}

// Garantía exigida por las bases de una licitación (ya extraída por el Experto).
export function useGarantiaBases(codigo: string | null | undefined) {
  return useQuery({
    queryKey: ['garantia-bases', codigo],
    enabled: !!codigo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<GarantiaBases | null> => {
      const { data, error } = await rpc<GarantiaBases | null>('garantias_de_bases', { p_codigo: codigo });
      if (error) throw new Error(error.message);
      return data ?? null;
    },
  });
}
