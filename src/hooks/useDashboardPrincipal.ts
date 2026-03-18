import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addDays } from 'date-fns';

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
  return useQuery({
    queryKey: ['dashboard-principal', 'kpis'],
    queryFn: async (): Promise<DashboardKPIs> => {
      const now = new Date();

      // Fetch compras_agiles
      const { data: comprasAgiles, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo, estado, match_encontrado, match_score, monto, fecha_cierre');
      if (caError) throw caError;

      // Fetch licitaciones
      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, estado, match_encontrado, match_score, presupuesto, fecha_cierre, procesada');
      if (licError) throw licError;

      // Fetch ofertas for success rate
      const { data: ofertas, error: ofError } = await supabase
        .from('ofertas')
        .select('estado');
      if (ofError) throw ofError;

      // Combine opportunities
      const todas = [
        ...(comprasAgiles || []).map(ca => ({
          estado: ca.estado,
          match_encontrado: ca.match_encontrado,
          match_score: ca.match_score,
          monto: ca.monto,
          fecha_cierre: ca.fecha_cierre,
        })),
        ...(licitaciones || []).map(l => ({
          estado: l.estado,
          match_encontrado: l.match_encontrado,
          match_score: l.match_score,
          monto: l.presupuesto,
          fecha_cierre: l.fecha_cierre,
        })),
      ];

      // Oportunidades Activas: not expired and not in terminal states
      const activas = todas.filter(o =>
        o.fecha_cierre && new Date(o.fecha_cierre) > now &&
        o.estado !== 'adjudicada' && o.estado !== 'desierta' && o.estado !== 'descartada'
      );

      // Match Score Promedio (of items with match)
      const conMatch = todas.filter(o => o.match_encontrado && o.match_score != null);
      const matchScorePromedio = conMatch.length > 0
        ? Math.round(conMatch.reduce((sum, o) => sum + (o.match_score || 0), 0) / conMatch.length)
        : 0;

      // Monto en Pipeline (all active opportunities)
      const montoEnPipeline = activas.reduce((sum, o) => sum + (o.monto || 0), 0);

      // Tasa de Éxito: ofertas ganadas / ofertas enviadas+ganadas+perdidas
      const ofertasList = ofertas || [];
      const postuladas = ofertasList.filter(o =>
        ['enviada', 'ganada', 'perdida'].includes(o.estado)
      ).length;
      const ganadas = ofertasList.filter(o => o.estado === 'ganada').length;
      const tasaExito = postuladas > 0 ? Math.round((ganadas / postuladas) * 100) : 0;

      return {
        oportunidadesActivas: activas.length,
        matchScorePromedio,
        montoEnPipeline,
        tasaExito,
        // Trends would require historical data, for now show null
        oportunidadesActivasTrend: null,
        matchScorePromedioTrend: null,
        montoEnPipelineTrend: null,
        tasaExitoTrend: null,
      };
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// --- Pipeline by Stage Hook ---

export function usePipelineByStage() {
  return useQuery({
    queryKey: ['dashboard-principal', 'pipeline-stages'],
    queryFn: async (): Promise<PipelineStage[]> => {
      const now = new Date();

      const { data: comprasAgiles, error: caError } = await supabase
        .from('compras_agiles')
        .select('estado, monto');
      if (caError) throw caError;

      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('estado, presupuesto');
      if (licError) throw licError;

      // Combine and group by estado
      const stageMap: Record<string, { count: number; monto: number }> = {};
      const allItems = [
        ...(comprasAgiles || []).map(ca => ({ estado: ca.estado || 'sin_estado', monto: ca.monto || 0 })),
        ...(licitaciones || []).map(l => ({ estado: l.estado || 'sin_estado', monto: l.presupuesto || 0 })),
      ];

      for (const item of allItems) {
        const key = item.estado;
        if (!stageMap[key]) stageMap[key] = { count: 0, monto: 0 };
        stageMap[key].count += 1;
        stageMap[key].monto += item.monto;
      }

      // Define pipeline order
      const stageOrder = ['publicada', 'en_revision', 'postulada', 'enviada', 'adjudicada', 'cerrada', 'desierta'];
      const stageLabels: Record<string, string> = {
        publicada: 'Publicada',
        en_revision: 'En Revisión',
        postulada: 'Postulada',
        enviada: 'Enviada',
        adjudicada: 'Adjudicada',
        cerrada: 'Cerrada',
        desierta: 'Desierta',
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
    staleTime: 30000,
  });
}

// --- Oportunidades por Tipo Hook ---

export function useOportunidadesPorTipo() {
  return useQuery({
    queryKey: ['dashboard-principal', 'por-tipo'],
    queryFn: async (): Promise<OportunidadPorTipo[]> => {
      const { count: caCount, error: caError } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true });
      if (caError) throw caError;

      const { count: licCount, error: licError } = await supabase
        .from('licitaciones')
        .select('*', { count: 'exact', head: true });
      if (licError) throw licError;

      return [
        { tipo: 'Compras Ágiles', count: caCount || 0 },
        { tipo: 'Licitaciones', count: licCount || 0 },
      ];
    },
    staleTime: 30000,
  });
}

// --- Cierres Próximos Hook ---

export function useCierresProximos() {
  return useQuery({
    queryKey: ['dashboard-principal', 'cierres-proximos'],
    queryFn: async (): Promise<CierreProximo[]> => {
      const now = new Date();
      const in7Days = addDays(now, 7);

      // Compras Agiles closing soon
      const { data: caData, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo, nombre, organismo, fecha_cierre, match_score, estado')
        .gte('fecha_cierre', now.toISOString())
        .lte('fecha_cierre', in7Days.toISOString())
        .order('fecha_cierre', { ascending: true })
        .limit(10);
      if (caError) throw caError;

      // Licitaciones closing soon
      const { data: licData, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, organismo, fecha_cierre, match_score, estado')
        .gte('fecha_cierre', now.toISOString())
        .lte('fecha_cierre', in7Days.toISOString())
        .order('fecha_cierre', { ascending: true })
        .limit(10);
      if (licError) throw licError;

      const results: CierreProximo[] = [
        ...(caData || []).map(ca => ({
          codigo: ca.codigo,
          nombre: ca.nombre,
          institucion: ca.organismo,
          fecha_cierre: ca.fecha_cierre || '',
          diasRestantes: Math.max(0, Math.ceil((new Date(ca.fecha_cierre!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
          match_score: ca.match_score,
          etapa: ca.estado || 'Publicada',
          tipo: 'Compra Ágil',
        })),
        ...(licData || []).map(l => ({
          codigo: l.id_licitacion,
          nombre: l.titulo,
          institucion: l.organismo,
          fecha_cierre: l.fecha_cierre || '',
          diasRestantes: Math.max(0, Math.ceil((new Date(l.fecha_cierre!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
          match_score: l.match_score,
          etapa: l.estado || 'Publicada',
          tipo: 'Licitación',
        })),
      ];

      // Sort by deadline ascending
      results.sort((a, b) => new Date(a.fecha_cierre).getTime() - new Date(b.fecha_cierre).getTime());

      return results.slice(0, 10);
    },
    staleTime: 30000,
  });
}

// --- Últimos Matches Hook ---

export function useUltimosMatches() {
  return useQuery({
    queryKey: ['dashboard-principal', 'ultimos-matches'],
    queryFn: async (): Promise<UltimoMatch[]> => {
      // Compras Agiles with matches
      const { data: caData, error: caError } = await supabase
        .from('compras_agiles')
        .select('codigo, nombre, organismo, match_score, created_at')
        .eq('match_encontrado', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (caError) throw caError;

      // Licitaciones with matches
      const { data: licData, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, organismo, match_score, created_at')
        .eq('match_encontrado', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (licError) throw licError;

      const results: UltimoMatch[] = [
        ...(caData || []).map(ca => ({
          codigo: ca.codigo,
          nombre: ca.nombre,
          institucion: ca.organismo,
          match_score: ca.match_score,
          tipo: 'Compra Ágil',
          fecha: ca.created_at,
        })),
        ...(licData || []).map(l => ({
          codigo: l.id_licitacion,
          nombre: l.titulo,
          institucion: l.organismo,
          match_score: l.match_score,
          tipo: 'Licitación',
          fecha: l.created_at,
        })),
      ];

      // Sort by date desc, take 8
      results.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      return results.slice(0, 8);
    },
    staleTime: 30000,
  });
}
