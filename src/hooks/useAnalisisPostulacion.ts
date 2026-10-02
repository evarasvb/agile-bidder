import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ResultadoAnalisis = 'ganada' | 'perdida' | 'sin_tomar';
type Tipo = 'licitacion' | 'compra_agil';

export interface AnalisisPostulacion {
  id: string;
  resultado: ResultadoAnalisis;
  resumen: string;
  factores: string[];
  generado_en: string;
}

// Post-mortem de IA (pedido de Evaristo): por qué se ganó/perdió, o quién
// ganó y por qué en lo que no se postuló. Mismo patrón que
// useVeredictoOportunidad: se genera una vez por botón y queda cacheado en
// postulacion_analisis (acá con política RLS real, a diferencia de
// oportunidad_veredictos, así que sí sobrevive a un recargo de página).
export function useAnalisisPostulacion(tipo: Tipo | null, codigo: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['postulacion-analisis', user?.id, tipo, codigo],
    enabled: !!user?.id && !!tipo && !!codigo,
    queryFn: async (): Promise<AnalisisPostulacion | null> => {
      const { data, error } = await (supabase
        .from as any)('postulacion_analisis')
        .select('id, resultado, resumen, factores, generado_en')
        .eq('tipo', tipo)
        .eq('codigo', codigo)
        .maybeSingle();
      if (error) throw error;
      return (data as AnalisisPostulacion | null) ?? null;
    },
  });
}

export function useGenerarAnalisisPostulacion(tipo: Tipo | null, codigo: string | null, resultado: ResultadoAnalisis | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (): Promise<AnalisisPostulacion> => {
      if (!tipo || !codigo || !resultado) throw new Error('Falta la oportunidad');
      const { data, error } = await supabase.functions.invoke<AnalisisPostulacion & { error?: string }>('postulacion-analisis', {
        body: { tipo, codigo, resultado },
      });
      if (error) throw error;
      if (!data || (data as any).error) throw new Error((data as any)?.error || 'No se pudo generar el análisis');
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['postulacion-analisis', user?.id, tipo, codigo], data);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'No se pudo generar el análisis de IA');
    },
  });
}
