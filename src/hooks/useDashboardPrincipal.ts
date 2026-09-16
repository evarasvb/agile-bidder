import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// --- Types ---

export interface DashboardKPIs {
  oportunidadesActivas: number;
  matchScorePromedio: number;
  montoEnPipeline: number;
  tasaExito: number;
  // Trends (vs previous period)
  oportunidadesActivasTrend: number | null;
  matchScorePromedioTrend: number | null;
  montoEnPipelineTrend: number | null;
  tasaExitoTrend: number | null;
}

export interface PipelineStage {
  etapa: string;
  count: number;
  monto: number;
}

export interface OportunidadPorTipo {
  tipo: string;
  count: number;
}

export interface CierreProximo {
  codigo: string;
  nombre: string;
  institucion: string;
  fecha_cierre: string;
  diasRestantes: number;
  match_score: number | null;
  etapa: string;
  tipo: string;
}

export interface UltimoMatch {
  codigo: string;
  nombre: string;
  institucion: string;
  match_score: number | null;
  tipo: string;
  fecha: string;
}

// --- KPI Hook ---

export function useDashboardKPIs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-principal', user?.id, 'kpis'],
    queryFn: async (): Promise<DashboardKPIs> => {
      // Todo el cálculo se hace en la BD (RPC dashboard_kpis): antes se bajaban
      // TODAS las filas de compras_agiles y licitaciones al navegador cada 30s
      // sólo para contar/sumar. Ahora es una sola llamada sin transferir filas.
      const { data, error } = await supabase.rpc('dashboard_kpis');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;

      return {
        oportunidadesActivas: Number(row?.oportunidades_activas ?? 0),
        matchScorePromedio: Number(row?.match_score_promedio ?? 0),
        montoEnPipeline: Number(row?.monto_en_pipeline ?? 0),
        tasaExito: Number(row?.tasa_exito ?? 0),
        // Trends would require historical data, for now show null
        oportunidadesActivasTrend: null,
        matchScorePromedioTrend: null,
        montoEnPipelineTrend: null,
        tasaExitoTrend: null,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

// --- Pipeline by Stage Hook ---

export function usePipelineByStage() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-principal', user?.id, 'pipeline-stages'],
    queryFn: async (): Promise<PipelineStage[]> => {
      // Agregación en la BD (RPC): antes bajaba todas las filas para agrupar en
      // el navegador. La RPC ya devuelve estado (en minúscula), cantidad y monto.
      const { data, error } = await supabase.rpc('dashboard_pipeline_por_estado');
      if (error) throw error;

      const stageMap: Record<string, { count: number; monto: number }> = {};
      for (const r of (data || []) as Array<{ estado: string; cantidad: number; monto: number }>) {
        stageMap[r.estado || 'sin_estado'] = {
          count: Number(r.cantidad) || 0,
          monto: Number(r.monto) || 0,
        };
      }

      // Define pipeline order
      const stageOrder = ['descubierta', 'seguimiento', 'preparacion', 'postulada', 'evaluacion', 'adjudicada', 'oc_emitida', 'pagada', 'perdida'];
      const stageLabels: Record<string, string> = {
        descubierta: 'Descubierta',
        seguimiento: 'Seguimiento',
        preparacion: 'En preparación',
        postulada: 'Postulada',
        evaluacion: 'En evaluación',
        adjudicada: 'Adjudicada',
        oc_emitida: 'OC emitida',
        pagada: 'Pagada',
        perdida: 'Perdida',
      };

      const result: PipelineStage[] = [];
      // Add known stages in order
      for (const stage of stageOrder) {
        if (stageMap[stage]) {
          result.push({
            etapa: stageLabels[stage] || stage,
            count: stageMap[stage].count,
            monto: stageMap[stage].monto,
          });
          delete stageMap[stage];
        }
      }
      // Add any remaining stages
      for (const [key, val] of Object.entries(stageMap)) {
        if (key === 'sin_estado') continue;
        result.push({
          etapa: stageLabels[key] || key.charAt(0).toUpperCase() + key.slice(1),
          count: val.count,
          monto: val.monto,
        });
      }

      return result;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

// --- Oportunidades por Tipo Hook ---

export function useOportunidadesPorTipo() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-principal', user?.id, 'por-tipo'],
    queryFn: async (): Promise<OportunidadPorTipo[]> => {
      // La RPC agrupa exclusivamente los matches de la empresa autenticada.
      // Nunca usar match_score de la oportunidad global: ese valor puede haber
      // sido calculado con el inventario de otra empresa.
      const { data, error } = await (supabase as any).rpc('dashboard_oportunidades_por_tipo_cliente');
      if (error) throw error;
      return ((data || []) as Array<{ tipo: string; cantidad: number }>).map((r) => ({
        tipo: r.tipo === 'compra_agil' ? 'Compras Ágiles' : 'Licitaciones',
        count: Number(r.cantidad) || 0,
      }));
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

// --- Cierres Próximos Hook ---

export function useCierresProximos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-principal', user?.id, 'cierres-proximos'],
    queryFn: async (): Promise<CierreProximo[]> => {
      const now = new Date();
      const { data, error } = await (supabase as any).rpc('dashboard_cierres_cliente', { p_limite: 10 });
      if (error) throw error;
      return ((data || []) as Array<Omit<CierreProximo, 'diasRestantes'>>).map((r) => ({
        ...r,
        match_score: r.match_score == null ? null : Number(r.match_score),
        diasRestantes: Math.max(0, Math.ceil((new Date(r.fecha_cierre).getTime() - now.getTime()) / 86_400_000)),
      }));
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

// --- Últimos Matches Hook ---

export function useUltimosMatches() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-principal', user?.id, 'ultimos-matches'],
    queryFn: async (): Promise<UltimoMatch[]> => {
      const { data, error } = await (supabase as any).rpc('dashboard_ultimos_matches_cliente', { p_limite: 8 });
      if (error) throw error;
      return ((data || []) as UltimoMatch[]).map((r) => ({
        ...r,
        match_score: r.match_score == null ? null : Number(r.match_score),
      }));
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}
