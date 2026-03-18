/**
 * Hook: useMatchesV2
 *
 * Frontend integration for the v2 matching engine.
 * - Fetches matches from the `matches` table
 * - Provides mutation to trigger re-matching via edge function
 * - Supports filtering by estado, confidence, and minimum score
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  MatchItemScore,
  ScoreBreakdown,
  BuyerIntelligence,
} from '@/services/matchingEngineV2';

// ============ TYPES ============

export interface MatchRecord {
  id: string;
  user_id: string;
  oportunidad_id: string;
  oportunidad_tipo: 'licitacion' | 'compra_agil';
  match_score: number;
  items_matched: MatchItemScore[];
  precio_sugerido: number;
  estado: 'nuevo' | 'revisado' | 'descartado' | 'en_proceso' | 'ofertado';
  comprador_info: BuyerIntelligence;
  score_breakdown: ScoreBreakdown;
  confidence_level: 'high' | 'medium' | 'low';
  items_coverage: number;
  created_at: string;
  updated_at: string;
}

export interface MatchesFilter {
  estado?: string;
  confidence?: string;
  minScore?: number;
  oportunidadTipo?: 'licitacion' | 'compra_agil';
}

// ============ FETCH MATCHES ============

export function useMatchesV2(filters?: MatchesFilter) {
  return useQuery({
    queryKey: ['matches-v2', filters],
    queryFn: async (): Promise<MatchRecord[]> => {
      let query = (supabase as any)
        .from('matches')
        .select('*')
        .order('match_score', { ascending: false });

      if (filters?.estado) {
        query = query.eq('estado', filters.estado);
      }
      if (filters?.confidence) {
        query = query.eq('confidence_level', filters.confidence);
      }
      if (filters?.minScore) {
        query = query.gte('match_score', filters.minScore);
      }
      if (filters?.oportunidadTipo) {
        query = query.eq('oportunidad_tipo', filters.oportunidadTipo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useMatchesV2] Error fetching matches:', error);
        throw error;
      }

      return (data || []) as MatchRecord[];
    },
    staleTime: 30_000, // 30 seconds
  });
}

// ============ GET SINGLE MATCH ============

export function useMatchV2(matchId: string | null) {
  return useQuery({
    queryKey: ['match-v2', matchId],
    queryFn: async (): Promise<MatchRecord | null> => {
      if (!matchId) return null;

      const { data, error } = await (supabase as any)
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();

      if (error) {
        console.error('[useMatchV2] Error:', error);
        return null;
      }

      return data as MatchRecord;
    },
    enabled: !!matchId,
  });
}

// ============ UPDATE MATCH STATUS ============

export function useUpdateMatchEstado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ matchId, estado }: { matchId: string; estado: MatchRecord['estado'] }) => {
      const { data, error } = await (supabase as any)
        .from('matches')
        .update({ estado })
        .eq('id', matchId)
        .select()
        .single();

      if (error) throw error;
      return data as MatchRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches-v2'] });
    },
  });
}

// ============ TRIGGER MATCHING ============

export function useRunMatching() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (oportunidadIds?: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('match-opportunities', {
        body: {
          user_id: session.user.id,
          oportunidad_ids: oportunidadIds,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches-v2'] });
    },
  });
}

// ============ MATCH STATS ============

export function useMatchStats() {
  return useQuery({
    queryKey: ['match-stats-v2'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('matches')
        .select('match_score, estado, confidence_level, oportunidad_tipo');

      if (error) throw error;

      const matches = (data || []) as Pick<MatchRecord, 'match_score' | 'estado' | 'confidence_level' | 'oportunidad_tipo'>[];

      return {
        total: matches.length,
        avgScore: matches.length > 0
          ? Math.round(matches.reduce((s, m) => s + m.match_score, 0) / matches.length)
          : 0,
        byEstado: {
          nuevo: matches.filter(m => m.estado === 'nuevo').length,
          revisado: matches.filter(m => m.estado === 'revisado').length,
          en_proceso: matches.filter(m => m.estado === 'en_proceso').length,
          descartado: matches.filter(m => m.estado === 'descartado').length,
          ofertado: matches.filter(m => m.estado === 'ofertado').length,
        },
        byConfidence: {
          high: matches.filter(m => m.confidence_level === 'high').length,
          medium: matches.filter(m => m.confidence_level === 'medium').length,
          low: matches.filter(m => m.confidence_level === 'low').length,
        },
        byTipo: {
          licitacion: matches.filter(m => m.oportunidad_tipo === 'licitacion').length,
          compra_agil: matches.filter(m => m.oportunidad_tipo === 'compra_agil').length,
        },
      };
    },
    staleTime: 60_000,
  });
}
