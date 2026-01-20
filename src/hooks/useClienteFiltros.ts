import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ClienteFiltros {
  id: string;
  cliente_id: string;
  palabras_incluir: string[] | null;
  palabras_excluir: string[] | null;
  regiones_activas: string[] | null;
  monto_min: number | null;
  monto_max: number | null;
  created_at?: string;
  updated_at?: string;
}

export function useClienteFiltros() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cliente-filtros', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await (supabaseClient as any)
        .from('cliente_filtros_oportunidades')
        .select('*')
        .eq('cliente_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cliente filtros:', error);
        throw error;
      }

      return data as ClienteFiltros | null;
    },
    enabled: !!user?.id,
  });

  const updateFiltros = useMutation({
    mutationFn: async (filtros: Partial<ClienteFiltros>) => {
      if (!user?.id) throw new Error('Usuario no autenticado');

      // Check if record exists
      const { data: existing } = await (supabaseClient as any)
        .from('cliente_filtros_oportunidades')
        .select('id')
        .eq('cliente_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await (supabaseClient as any)
          .from('cliente_filtros_oportunidades')
          .update({
            ...filtros,
            updated_at: new Date().toISOString(),
          })
          .eq('cliente_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await (supabaseClient as any)
          .from('cliente_filtros_oportunidades')
          .insert({
            cliente_id: user.id,
            ...filtros,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente-filtros'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades-filtradas'] });
      toast.success('Filtros guardados correctamente');
    },
    onError: (error) => {
      console.error('Error updating filtros:', error);
      toast.error('Error al guardar los filtros');
    },
  });

  return {
    filtros: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateFiltros: updateFiltros.mutate,
    isUpdating: updateFiltros.isPending,
  };
}
