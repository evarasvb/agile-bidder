import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FotoCandidata {
  url: string;
  thumb: string;
  fuente: 'pexels' | 'unsplash';
  autor?: string;
}

export interface SugerirResp {
  query: string;
  candidatas: FotoCandidata[];
  fuentes: { pexels: boolean; unsplash: boolean };
}

// Pide candidatas de foto (banco) para un producto o una búsqueda libre.
export function useSugerirFotos() {
  return useMutation({
    mutationFn: async (args: { productId?: string; query?: string; n?: number }) => {
      const { data, error } = await supabase.functions.invoke('fotos-producto', {
        body: { action: 'sugerir', ...args },
      });
      if (error) throw error;
      return data as SugerirResp;
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudieron buscar fotos'),
  });
}

// Fija la foto elegida: la descarga, la sube al bucket y la agrega a la galería.
export function useFijarFoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { productId: string; imageUrl: string }) => {
      const { data, error } = await supabase.functions.invoke('fotos-producto', {
        body: { action: 'fijar', ...args },
      });
      if (error) throw error;
      return data as { imagen_url: string; es_principal: boolean };
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['product-images', vars.productId, 'cliente_inventario'] });
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar la foto'),
  });
}
