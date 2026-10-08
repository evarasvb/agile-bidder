import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export type MatchAccion = 'descartado' | 'confirmado' | 'reasignado';

/**
 * Traduce el error de guardar un override a una frase clara para el usuario
 * (que no programa): NUNCA mostrar un código técnico crudo. Hallazgo de
 * Evaristo: al fallar, la app mostraba un código en vez de una descripción.
 */
export function mensajeErrorOverride(e: unknown): string {
  const err = e as { message?: string; code?: string; details?: string } | null;
  const code = String(err?.code ?? '');
  const texto = `${code} ${err?.message ?? ''} ${err?.details ?? ''}`.toLowerCase();
  if (code === '42501' || texto.includes('row-level security') || texto.includes('permission denied') || texto.includes('not authorized')) {
    return 'No tienes permiso para guardar este cambio en esta compra. Si eres parte de un equipo, pídele a tu administrador acceso al módulo de oportunidades.';
  }
  if (code === '23505' || texto.includes('duplicate key')) {
    return 'Ese producto ya está agregado a la oferta.';
  }
  if (code === 'PGRST116' || texto.includes('rows returned') || texto.includes('0 rows')) {
    return 'El cambio se guardó, pero no pudimos refrescar la vista. Recarga la página para verlo.';
  }
  if (texto.includes('failed to fetch') || texto.includes('network') || texto.includes('fetch')) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
  }
  return 'No se pudo guardar el cambio. Intenta de nuevo; si sigue, recarga la página.';
}

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

/** Correcciones manuales del match del cliente para una compra (por código).
 *  Filtrado también por proceso_tipo: el mismo código podría, en teoría,
 *  tener correcciones guardadas bajo otro tipo de proceso (match_overrides
 *  permite filas separadas por cliente+codigo+item_ref+proceso_tipo), y no
 *  queremos aplicar la corrección de un proceso a otro. */
export function useMatchOverrides(codigo: string | null | undefined, procesoTipo: string = 'compra_agil') {
  const { user } = useAuth();
  const clienteId = user?.id ?? null;

  return useQuery({
    queryKey: ['match_overrides', clienteId, codigo, procesoTipo],
    enabled: !!clienteId && !!codigo,
    queryFn: async (): Promise<Record<string, MatchOverride>> => {
      if (!clienteId || !codigo) return {};
      const { data, error } = await (supabase.from as any)('match_overrides')
        .select('*')
        .eq('codigo', codigo)
        .eq('proceso_tipo', procesoTipo);
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
      const { data, error } = await (supabase.from as any)('match_overrides')
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
      const { error } = await (supabase.from as any)('match_overrides')
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
