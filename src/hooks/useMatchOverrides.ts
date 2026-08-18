import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export type MatchAccion = 'descartado' | 'confirmado' | 'reasignado';

export interface MatchOverride {
  id: string;
  cliente_id: string;
  proceso_tipo: string;
  codigo: string;
  item_ref: string;
  item_nombre: string | null;
  accion: MatchAccion;
  inventario_id: string | null;
  score_manual: number | null;
  updated_at: string;
}

export interface UpsertOverrideInput {
  codigo: string;
  itemRef: string;
  itemNombre?: string | null;
  accion: MatchAccion;
  inventarioId?: string | null;
  scoreManual?: number | null;
  procesoTipo?: string;
}

/** Correcciones manuales del match del cliente para una compra (por código). */
export function useMatchOverrides(codigo: string | null | undefined) {
  const { user } = useAuth();
  const clienteId = user?.id ?? null;

  return useQuery({
    queryKey: ['match_overrides', clienteId, codigo],
    enabled: !!clienteId && !!codigo,
    queryFn: async (): Promise<Record<string, MatchOverride>> => {
      if (!clienteId || !codigo) return {};
      const { data, error } = await supabase
        .from('match_overrides')
        .select('*')
        .eq('codigo', codigo);
      if (error) {
        console.error('[useMatchOverrides] error:', error);
        throw error;
      }
      const map: Record<string, MatchOverride> = {};
      (data ?? []).forEach((o: MatchOverride) => { map[o.item_ref] = o; });
      return map;
    },
  });
}

export function useUpsertMatchOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const clienteId = user?.id ?? null;

  return useMutation({
    mutationFn: async (input: UpsertOverrideInput) => {
      if (!clienteId) throw new Error('No hay sesión activa');
      const row = {
        cliente_id: clienteId,
        proceso_tipo: input.procesoTipo ?? 'compra_agil',
        codigo: input.codigo,
        item_ref: input.itemRef,
        item_nombre: input.itemNombre ?? null,
        accion: input.accion,
        inventario_id: input.inventarioId ?? null,
        score_manual: input.scoreManual ?? null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('match_overrides')
        .upsert(row, { onConflict: 'cliente_id,proceso_tipo,codigo,item_ref' })
        .select()
        .single();
      if (error) throw error;
      return data as MatchOverride;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['match_overrides', clienteId, input.codigo] });
    },
  });
}

export function useClearMatchOverride() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const clienteId = user?.id ?? null;

  return useMutation({
    mutationFn: async (input: { codigo: string; itemRef: string; procesoTipo?: string }) => {
      if (!clienteId) throw new Error('No hay sesión activa');
      const { error } = await supabase
        .from('match_overrides')
        .delete()
        .eq('codigo', input.codigo)
        .eq('item_ref', input.itemRef)
        .eq('proceso_tipo', input.procesoTipo ?? 'compra_agil');
      if (error) throw error;
      return true;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['match_overrides', clienteId, input.codigo] });
    },
  });
}
