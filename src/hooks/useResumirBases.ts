import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ResumenBasesResult {
  resumen: string;
  requisitos: string[];
  productos: Array<{
    nombre: string;
    cantidad?: string;
    especificaciones?: string;
  }>;
  fechas: Array<{
    tipo: string;
    fecha: string;
  }>;
  garantias?: {
    seriedad?: string;
    fiel_cumplimiento?: string;
  };
  criterios_evaluacion?: string[];
  error?: string;
}

export function useResumirBases() {
  return useMutation({
    mutationFn: async ({ texto, tipo }: { texto: string; tipo?: 'bases' | 'requisitos' | 'productos' }): Promise<ResumenBasesResult> => {
      console.log('Calling resumir-bases with', texto.length, 'characters');
      
      const { data, error } = await supabase.functions.invoke('resumir-bases', {
        body: { texto, tipo }
      });

      if (error) {
        console.error('Error resumiendo bases:', error);
        throw error;
      }

      return data as ResumenBasesResult;
    },
    onSuccess: () => {
      toast.success('Documento analizado correctamente');
    },
    onError: (error: any) => {
      console.error('Error al resumir bases:', error);
      if (error?.message?.includes('429')) {
        toast.error('Límite de solicitudes excedido. Intenta más tarde.');
      } else if (error?.message?.includes('402')) {
        toast.error('Se requiere agregar créditos a Lovable AI.');
      } else {
        toast.error('Error al analizar el documento');
      }
    }
  });
}
