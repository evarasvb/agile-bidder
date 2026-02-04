import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, subWeeks, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export interface DashboardMetrics {
  totalLicitaciones: number;
  licitacionesActivas: number;
  matchesEncontrados: number;
  porcentajeMatches: number;
  ofertasPendientes: number;
  ofertasEnviadas: number;
  ofertasGanadas: number;
  tasaExito: number;
  valorPotencial: number;
}

export interface WeeklyMatchData {
  semana: string;
  matches: number;
  licitaciones: number;
}

export interface LicitacionUrgente {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  fecha_cierre: string;
  presupuesto: number | null;
  diasRestantes: number;
  match_score: number | null;
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async (): Promise<DashboardMetrics> => {
      console.log('[Dashboard] Fetching metrics...');
      
      // Fetch licitaciones - use count for efficiency
      const { data: licitaciones, error: licError, count: licCount } = await supabase
        .from('licitaciones')
        .select('codigo, estado, procesada, match_encontrado, presupuesto_estimado', { count: 'exact' });
      
      if (licError) {
        console.error('[Dashboard] Error fetching licitaciones:', licError);
        throw licError;
      }
      
      console.log(`[Dashboard] Found ${licitaciones?.length || 0} licitaciones`);

      // Fetch ofertas
      const { data: ofertas, error: ofError } = await supabase
        .from('ofertas')
        .select('estado');
      
      if (ofError) {
        console.error('[Dashboard] Error fetching ofertas:', ofError);
        throw ofError;
      }
      
      console.log(`[Dashboard] Found ${ofertas?.length || 0} ofertas`);

      const total = licitaciones?.length || 0;
      const activas = licitaciones?.filter(l => 
        l.estado === 'publicada' || !l.procesada
      )?.length || 0;
      const conMatch = licitaciones?.filter(l => l.match_encontrado)?.length || 0;
      
      const ofertasList = ofertas || [];
      const pendientes = ofertasList.filter(o => 
        ['borrador', 'revision', 'aprobada'].includes(o.estado)
      ).length;
      const enviadas = ofertasList.filter(o => 
        ['enviada', 'ganada', 'perdida'].includes(o.estado)
      ).length;
      const ganadas = ofertasList.filter(o => o.estado === 'ganada').length;

      const valorPotencial = licitaciones
        ?.filter(l => l.match_encontrado && l.presupuesto_estimado)
        ?.reduce((sum, l) => sum + (l.presupuesto_estimado || 0), 0) || 0;

      const metrics = {
        totalLicitaciones: total,
        licitacionesActivas: activas,
        matchesEncontrados: conMatch,
        porcentajeMatches: total > 0 ? Math.round((conMatch / total) * 100) : 0,
        ofertasPendientes: pendientes,
        ofertasEnviadas: enviadas,
        ofertasGanadas: ganadas,
        tasaExito: enviadas > 0 ? Math.round((ganadas / enviadas) * 100) : 0,
        valorPotencial,
      };
      
      console.log('[Dashboard] Metrics calculated:', metrics);
      return metrics;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data fresh for 10 seconds
  });
}

export function useWeeklyMatchData() {
  return useQuery({
    queryKey: ['dashboard', 'weekly-matches'],
    queryFn: async (): Promise<WeeklyMatchData[]> => {
      const { data: licitaciones, error } = await supabase
        .from('licitaciones')
        .select('created_at, match_encontrado')
        .gte('created_at', subWeeks(new Date(), 6).toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      // Group by week
      const weeklyData: Record<string, { matches: number; total: number }> = {};
      
      for (let i = 5; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'dd MMM', { locale: es });
        weeklyData[weekKey] = { matches: 0, total: 0 };
      }

      licitaciones?.forEach(lic => {
        const weekStart = startOfWeek(parseISO(lic.created_at), { weekStartsOn: 1 });
        const weekKey = format(weekStart, 'dd MMM', { locale: es });
        
        if (weeklyData[weekKey]) {
          weeklyData[weekKey].total += 1;
          if (lic.match_encontrado) {
            weeklyData[weekKey].matches += 1;
          }
        }
      });

      return Object.entries(weeklyData).map(([semana, data]) => ({
        semana,
        matches: data.matches,
        licitaciones: data.total,
      }));
    },
  });
}

export function useLicitacionesUrgentes() {
  return useQuery({
    queryKey: ['dashboard', 'urgentes'],
    queryFn: async (): Promise<LicitacionUrgente[]> => {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('licitaciones')
        .select('*')
        .gte('fecha_cierre', now.toISOString())
        .order('fecha_cierre', { ascending: true })
        .limit(5);
      
      if (error) throw error;

      return (data || []).map(lic => {
        const fechaCierre = lic.fecha_cierre ? new Date(lic.fecha_cierre) : now;
        const diasRestantes = Math.ceil((fechaCierre.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id_licitacion: lic.id_licitacion,
          titulo: lic.titulo,
          organismo: lic.organismo,
          fecha_cierre: lic.fecha_cierre || '',
          presupuesto: lic.presupuesto,
          diasRestantes: Math.max(0, diasRestantes),
          match_score: lic.match_score,
        };
      });
    },
  });
}
