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
      // Todo el cálculo se hace en la BD (RPC dashboard_kpis): antes se bajaban
      // TODAS las filas de compras_agiles y licitaciones al navegador cada 30s
      // sólo para contar/sumar. Ahora es una sola llamada sin transferir filas.
      const { data, error } = await (supabase as any).rpc('dashboard_kpis');
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
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

// --- Pipeline by Stage Hook ---

export function usePipelineByStage() {
  return useQuery({
    queryKey: ['dashboard-principal', 'pipeline-stages'],
    queryFn: async (): Promise<PipelineStage[]> => {
      // Agregación en la BD (RPC): antes bajaba todas las filas para agrupar en
      // el navegador. La RPC ya devuelve estado (en minúscula), cantidad y monto.
      const { data, error } = await (supabase as any).rpc('dashboard_pipeline_por_estado');
      if (error) throw error;

      const stageMap: Record<string, { count: number; monto: number }> = {};
      for (const r of (data || []) as Array<{ estado: string; cantidad: number; monto: number }>) {
        stageMap[r.estado || 'sin_estado'] = {
          count: Number(r.cantidad) || 0,
          monto: Number(r.monto) || 0,
        };
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

      // licitaciones_bi (fresca, sync oficial), no la antigua `licitaciones`
      // (congelada) — mismo criterio que useCierresProximos/useUltimosMatches
      // más abajo. Antes esta tarjeta mostraba un conteo desactualizado
      // mientras el resto del dashboard ya usaba la tabla correcta.
      const { count: licCount, error: licError } = await (supabase as any)
        .from('licitaciones_bi')
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

      // Compras Ágiles que cierran pronto. La columna del organismo es
      // `nombre_organismo` (no `organismo`, que no existe y hacía fallar la query).
      const { data: caData, error: caError } = await (supabase as any)
        .from('compras_agiles')
        .select('codigo, nombre, nombre_organismo, fecha_cierre, match_score, estado')
        .gte('fecha_cierre', now.toISOString())
        .lte('fecha_cierre', in7Days.toISOString())
        .order('fecha_cierre', { ascending: true })
        .limit(10);
      if (caError) throw caError;

      // Licitaciones que cierran pronto: desde `licitaciones_bi` (tabla fresca del
      // sync oficial). La antigua `licitaciones` está congelada (0 activas) y no
      // tiene `id_licitacion`, por eso la query lanzaba error y el widget de
      // cierres próximos quedaba vacío. No está en los tipos generados => any.
      const { data: licData, error: licError } = await (supabase as any)
        .from('licitaciones_bi')
        .select('codigo, nombre, institucion_nombre, fecha_cierre, match_score, estado')
        .gte('fecha_cierre', now.toISOString())
        .lte('fecha_cierre', in7Days.toISOString())
        .order('fecha_cierre', { ascending: true })
        .limit(10);
      if (licError) throw licError;

      const results: CierreProximo[] = [
        ...(caData || []).map(ca => ({
          codigo: ca.codigo,
          nombre: ca.nombre,
          institucion: (ca as any).nombre_organismo || 'Sin organismo',
          fecha_cierre: ca.fecha_cierre || '',
          diasRestantes: Math.max(0, Math.ceil((new Date(ca.fecha_cierre!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))),
          match_score: ca.match_score,
          etapa: ca.estado || 'Publicada',
          tipo: 'Compra Ágil',
        })),
        ...((licData || []) as any[]).map(l => ({
          codigo: l.codigo,
          nombre: l.nombre,
          institucion: l.institucion_nombre || 'Sin organismo',
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
      // Compras Ágiles con match. Organismo = `nombre_organismo`.
      const { data: caData, error: caError } = await (supabase as any)
        .from('compras_agiles')
        .select('codigo, nombre, nombre_organismo, match_score, created_at')
        .eq('match_encontrado', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (caError) throw caError;

      // Licitaciones con match desde `licitaciones_bi` (fresca). La antigua
      // `licitaciones` no tiene `id_licitacion` => la query fallaba. any por tipos.
      const { data: licData, error: licError } = await (supabase as any)
        .from('licitaciones_bi')
        .select('codigo, nombre, institucion_nombre, match_score, created_at')
        .eq('match_encontrado', true)
        .order('created_at', { ascending: false })
        .limit(5);
      if (licError) throw licError;

      const results: UltimoMatch[] = [
        ...(caData || []).map(ca => ({
          codigo: ca.codigo,
          nombre: ca.nombre,
          institucion: (ca as any).nombre_organismo || 'Sin organismo',
          match_score: ca.match_score,
          tipo: 'Compra Ágil',
          fecha: ca.created_at,
        })),
        ...((licData || []) as any[]).map(l => ({
          codigo: l.codigo,
          nombre: l.nombre,
          institucion: l.institucion_nombre || 'Sin organismo',
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
