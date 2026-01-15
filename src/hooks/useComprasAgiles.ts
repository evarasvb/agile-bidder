import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompraAgil {
  id: string;
  codigo: string;
  nombre: string;
  organismo: string;
  monto: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  region: string | null;
  descripcion: string | null;
  link_oficial: string | null;
  match_encontrado: boolean;
  match_score: number | null;
  datos_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ComprasAgilesFilters {
  estado?: string;
  region?: string;
  montoMin?: number;
  montoMax?: number;
}

export function useComprasAgiles(filters?: ComprasAgilesFilters) {
  return useQuery({
    queryKey: ['compras_agiles', filters],
    queryFn: async () => {
      let query = supabase
        .from('compras_agiles')
        .select('*')
        .order('fecha_cierre', { ascending: true });

      if (filters?.estado && filters.estado !== 'todas') {
        query = query.eq('estado', filters.estado);
      }

      if (filters?.region && filters.region !== 'todas') {
        query = query.eq('region', filters.region);
      }

      if (filters?.montoMin) {
        query = query.gte('monto', filters.montoMin);
      }

      if (filters?.montoMax) {
        query = query.lte('monto', filters.montoMax);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CompraAgil[];
    },
    refetchInterval: 30000,
  });
}

export function useCompraAgil(id: string | null) {
  return useQuery({
    queryKey: ['compra_agil', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as CompraAgil | null;
    },
    enabled: !!id,
  });
}

export function useUpdateCompraAgil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, datos_json }: { id: string; datos_json: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('compras_agiles')
        .update({ datos_json: datos_json as unknown as import('@/integrations/supabase/types').Json })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
      queryClient.invalidateQueries({ queryKey: ['compra_agil'] });
    },
  });
}

export function useComprasAgilesStats() {
  return useQuery({
    queryKey: ['compras_agiles_stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*');

      if (error) throw error;

      const compras = data as CompraAgil[];
      const total = compras.length;
      const conMatch = compras.filter(c => c.match_encontrado).length;
      const urgentes = compras.filter(c => c.estado === 'urgente').length;
      const montoTotal = compras.reduce((sum, c) => sum + (c.monto || 0), 0);

      return {
        total,
        conMatch,
        urgentes,
        montoTotal,
      };
    },
  });
}
