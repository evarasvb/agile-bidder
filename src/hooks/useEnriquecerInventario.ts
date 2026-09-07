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

export interface SugerenciaBorrador {
  descripcion: string | null;
  palabras_clave: string[];
  marca: string | null;
  candidatas: { url: string; thumb: string; fuente: string }[];
  fuente_texto: 'ia' | 'sin_ia';
}

/**
 * Sugiere descripción, palabras clave y fotos de banco para un producto que el
 * usuario todavía está creando (sin guardar, sin id). No toca la base de datos.
 */
export function useSugerirProductoNuevo() {
  return useMutation({
    mutationFn: async (borrador: { nombre: string; categoria?: string; marca?: string; descripcion?: string }) => {
      const { data, error } = await supabase.functions.invoke('enriquecer-inventario', {
        body: { borrador },
      });
      if (error) throw error;
      return data as SugerenciaBorrador;
    },
    onError: (e: Error) => {
      toast.error(e.message || 'No se pudo sugerir con IA');
    },
  });
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
