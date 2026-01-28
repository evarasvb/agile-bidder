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

// Interfaz para compra ágil simplificada (para filtrado)
export interface CompraAgilParaFiltrar {
  nombre?: string;
  descripcion?: string | null;
  region?: string | null;
  monto?: number | null;
}

// Función para verificar si una compra ágil pasa los filtros del cliente
export function pasaFiltrosCliente(
  compra: CompraAgilParaFiltrar,
  filtros: ClienteFiltros | null
): boolean {
  // Si no hay filtros configurados, todas las compras pasan
  if (!filtros) return true;

  // Crear texto combinado para buscar palabras
  const texto = `${compra.nombre || ''} ${compra.descripcion || ''}`.toLowerCase();

  // Filtrar por palabras a incluir (debe contener al menos una)
  if (filtros.palabras_incluir && filtros.palabras_incluir.length > 0) {
    const tieneIncluida = filtros.palabras_incluir.some(palabra =>
      texto.includes(palabra.toLowerCase())
    );
    if (!tieneIncluida) return false;
  }

  // Filtrar por palabras a excluir (no debe contener ninguna)
  if (filtros.palabras_excluir && filtros.palabras_excluir.length > 0) {
    const tieneExcluida = filtros.palabras_excluir.some(palabra =>
      texto.includes(palabra.toLowerCase())
    );
    if (tieneExcluida) return false;
  }

  // Filtrar por monto mínimo
  if (filtros.monto_min && compra.monto !== null && compra.monto !== undefined) {
    if (compra.monto < filtros.monto_min) return false;
  }

  // Filtrar por monto máximo
  if (filtros.monto_max && compra.monto !== null && compra.monto !== undefined) {
    if (compra.monto > filtros.monto_max) return false;
  }

  // Filtrar por regiones activas
  if (filtros.regiones_activas && filtros.regiones_activas.length > 0 && compra.region) {
    const regionNormalizada = compra.region.toLowerCase();
    const regionActiva = filtros.regiones_activas.some(region =>
      regionNormalizada.includes(region.toLowerCase())
    );
    if (!regionActiva) return false;
  }

  return true;
}
