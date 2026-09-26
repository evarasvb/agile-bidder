import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type RecomendacionVeredicto = 'ofertar' | 'revisar' | 'descartar';

export interface VeredictoOportunidad {
  id: string;
  recomendacion: RecomendacionVeredicto;
  razon: string;
  puntos_favor: string[];
  puntos_contra: string[];
  generado_en: string;
}

type Tipo = 'licitacion' | 'compra_agil';

// El veredicto queda cacheado en la tabla (se genera una vez por botón, no en
// cada visita); acá solo se lee lo ya guardado. La queryKey incluye el
// usuario para que la caché de React Query no mezcle veredictos entre
// cuentas distintas en la misma pestaña.
export function useVeredictoOportunidad(tipo: Tipo | null, codigo: string | null) {
  const { user } = useAuth();
  const clienteId = user?.id || null;

  return useQuery({
    queryKey: ['veredicto-oportunidad', clienteId, tipo, codigo],
    enabled: !!clienteId && !!tipo && !!codigo,
    queryFn: async (): Promise<VeredictoOportunidad | null> => {
      const { data, error } = await supabase
        .from('oportunidad_veredictos')
        .select('id, recomendacion, razon, puntos_favor, puntos_contra, generado_en')
        .eq('tipo', tipo)
        .eq('codigo', codigo)
        .maybeSingle();
      if (error) throw error;
      return (data as VeredictoOportunidad | null) ?? null;
    },
  });
}

export function useGenerarVeredicto(tipo: Tipo | null, codigo: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const clienteId = user?.id || null;

  return useMutation({
    mutationFn: async (): Promise<VeredictoOportunidad> => {
      if (!tipo || !codigo) throw new Error('Falta la oportunidad');
      const { data, error } = await supabase.functions.invoke<VeredictoOportunidad & { error?: string }>('veredicto-oportunidad', {
        body: { tipo, codigo },
      });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || 'No se pudo generar el veredicto');
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['veredicto-oportunidad', clienteId, tipo, codigo], data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo generar el veredicto de IA');
    },
  });
}
