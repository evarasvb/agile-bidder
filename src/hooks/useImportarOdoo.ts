import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ImportarOdooResumen {
  procesados: number;
  con_imagen: number;
  resultados: Array<{ id: string; ok: boolean; motivo?: string }>;
  error?: string;
}

/**
 * Importa las fotos de producto desde Odoo (por SKU/default_code) usando las
 * credenciales guardadas en el cliente. Completa los productos sin imagen.
 */
export function useImportarOdoo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (opts?: { ids?: string[]; overwrite?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('importar-odoo', {
        body: { ids: opts?.ids, overwrite: opts?.overwrite ?? false },
      });
      if (error) throw error;
      if ((data as ImportarOdooResumen)?.error) throw new Error((data as ImportarOdooResumen).error);
      return data as ImportarOdooResumen;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo importar de Odoo'),
  });
}
