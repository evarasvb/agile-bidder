import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnriquecerResultado {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  imagen_url: string | null;
  con_imagen_nueva: boolean;
  actualizado: boolean;
}

export interface EnriquecerResumen {
  procesados: number;
  con_imagen: number;
  fuente_texto: 'ia' | 'sin_ia';
  fuente_imagen: 'pexels' | 'sin_api';
  resultados: EnriquecerResultado[];
  mensaje?: string;
}

/**
 * Enriquece el inventario con IA: descripción robusta, palabras clave, marca y
 * una foto de banco (Pexels). Por defecto completa lo que falta (no pisa lo que
 * ya tienes). Pasa `ids` para enriquecer productos puntuales, u `overwrite` para
 * rehacer todo.
 */
export function useEnriquecerInventario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { ids?: string[]; overwrite?: boolean; limite?: number }) => {
      const { data, error } = await supabase.functions.invoke('enriquecer-inventario', {
        body: { ids: opts?.ids, overwrite: opts?.overwrite ?? false, limite: opts?.limite },
      });
      if (error) throw error;
      return data as EnriquecerResumen;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['todo-inventario'] });
    },
    onError: (e: Error) => {
      toast.error(e.message || 'No se pudo enriquecer el inventario');
    },
  });
}
