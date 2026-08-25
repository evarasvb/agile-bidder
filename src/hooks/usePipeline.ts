import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import type { PipelineItem, PipelineEtapa, PipelineFilters } from '@/components/pipeline/pipelineConstants';

const QUERY_KEY = 'pipeline';

function mapRow(row: any): PipelineItem {
  return {
    id: row.id,
    user_id: row.user_id,
    oportunidad_id: row.oportunidad_id,
    oportunidad_tipo: row.oportunidad_tipo,
    etapa: row.etapa,
    titulo: row.titulo || 'Sin título',
    institucion: row.institucion || null,
    monto_estimado: row.monto_estimado != null ? Number(row.monto_estimado) : null,
    fecha_cierre: row.fecha_cierre || null,
    match_score: row.match_score ?? 0,
    notas: row.notas || null,
    archivos: row.archivos || [],
    asignado_a: row.asignado_a || null,
    etapa_historial: row.etapa_historial || [],
    posicion: row.posicion ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function usePipeline(filters?: PipelineFilters) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [QUERY_KEY, user?.id, filters],
    queryFn: async (): Promise<PipelineItem[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('pipeline')
        .select('*')
        .eq('user_id', user.id)
        .order('posicion', { ascending: true });

      if (filters?.asignado_a) {
        query = query.eq('asignado_a', filters.asignado_a);
      }
      if (filters?.oportunidad_tipo) {
        query = query.eq('oportunidad_tipo', filters.oportunidad_tipo);
      }
      if (filters?.fechaCierreDesde) {
        query = query.gte('fecha_cierre', filters.fechaCierreDesde);
      }
      if (filters?.fechaCierreHasta) {
        query = query.lte('fecha_cierre', filters.fechaCierreHasta);
      }
      if (filters?.montoMin != null) {
        query = query.gte('monto_estimado', filters.montoMin);
      }
      if (filters?.montoMax != null) {
        query = query.lte('monto_estimado', filters.montoMax);
      }

      const { data, error } = await query;
      if (error) throw error;

      let items = (data || []).map(mapRow);

      // Client-side search filter
      if (filters?.search) {
        const term = filters.search.toLowerCase();
        items = items.filter(
          (item) =>
            item.titulo.toLowerCase().includes(term) ||
            (item.institucion && item.institucion.toLowerCase().includes(term)) ||
            item.oportunidad_id.toLowerCase().includes(term)
        );
      }

      return items;
    },
    enabled: !!user?.id,
  });
}

export function useCreatePipelineItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: {
      oportunidad_id: string;
      oportunidad_tipo: 'compra_agil' | 'licitacion' | 'manual';
      titulo: string;
      institucion?: string;
      monto_estimado?: number;
      fecha_cierre?: string;
      match_score?: number;
      etapa?: PipelineEtapa;
      notas?: string;
    }) => {
      if (!user?.id) throw new Error('No autenticado');

      const now = new Date().toISOString();
      const etapa = item.etapa || 'descubierta';

      const { data, error } = await supabase
        .from('pipeline')
        .insert({
          user_id: user.id,
          oportunidad_id: item.oportunidad_id,
          oportunidad_tipo: item.oportunidad_tipo,
          titulo: item.titulo,
          institucion: item.institucion || null,
          monto_estimado: item.monto_estimado || null,
          fecha_cierre: item.fecha_cierre || null,
          match_score: item.match_score || 0,
          etapa,
          notas: item.notas || null,
          etapa_historial: [{ etapa, fecha: now, usuario_id: user.id }],
        } as any)
        .select()
        .single();

      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdatePipelineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<PipelineItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('pipeline')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useMovePipelineItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      id,
      nuevaEtapa,
      currentHistorial,
    }: {
      id: string;
      nuevaEtapa: PipelineEtapa;
      currentHistorial: PipelineItem['etapa_historial'];
    }) => {
      if (!user?.id) throw new Error('No autenticado');

      const now = new Date().toISOString();
      const nuevoHistorial = [
        ...currentHistorial,
        { etapa: nuevaEtapa, fecha: now, usuario_id: user.id },
      ];

      const { data, error } = await supabase
        .from('pipeline')
        .update({
          // cast: los tipos generados aún no incluyen la etapa 'perdida'
          etapa: nuevaEtapa,
          etapa_historial: nuevoHistorial,
          updated_at: now,
        } as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return mapRow(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletePipelineItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
