import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Oportunidad {
  codigo: string;
  nombre: string;
  institucion_nombre: string;
  estado: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  presupuesto_estimado: number | null;
  match_score: number | null;
  match_encontrado: boolean;
  tipo_proceso: 'compra_agil' | 'licitacion';
  link_oficial: string | null;
  procesada: boolean;
}

export interface OportunidadesFilters {
  tipo_proceso?: 'compra_agil' | 'licitacion' | 'all';
  estado?: string;
  organismo?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  soloConMatch?: boolean;
}

export interface UseOportunidadesOptions {
  filters?: OportunidadesFilters;
  page?: number;
  pageSize?: number;
  orderBy?: 'fecha_cierre' | 'fecha_publicacion' | 'presupuesto_estimado' | 'match_score';
  orderAsc?: boolean;
}

export function useOportunidades(options: UseOportunidadesOptions = {}) {
  const { 
    filters = {}, 
    page = 1, 
    pageSize = 20, 
    orderBy = 'fecha_cierre',
    orderAsc = true 
  } = options;

  return useQuery({
    queryKey: ['oportunidades', filters, page, pageSize, orderBy, orderAsc],
    queryFn: async () => {
      // Query oportunidades_all view
      const { data, error, count } = await (supabase
        .from('oportunidades_all' as any)
        .select('*', { count: 'exact' }) as any)
        .order(orderBy, { ascending: orderAsc })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) {
        console.error('[Oportunidades] Error fetching:', error);
        throw error;
      }

      // Apply client-side filtering for type-safety
      let filtered = (data || []) as Oportunidad[];

      if (filters.tipo_proceso && filters.tipo_proceso !== 'all') {
        filtered = filtered.filter(o => o.tipo_proceso === filters.tipo_proceso);
      }
      if (filters.estado) {
        filtered = filtered.filter(o => o.estado === filters.estado);
      }
      if (filters.organismo) {
        filtered = filtered.filter(o => 
          o.institucion_nombre?.toLowerCase().includes(filters.organismo!.toLowerCase())
        );
      }
      if (filters.soloConMatch) {
        filtered = filtered.filter(o => o.match_encontrado);
      }

      return {
        data: filtered,
        total: count || filtered.length,
        page,
        pageSize,
        totalPages: Math.ceil((count || filtered.length) / pageSize),
      };
    },
    staleTime: 30000,
  });
}

export function useOportunidadesStats() {
  return useQuery({
    queryKey: ['oportunidades', 'stats'],
    queryFn: async () => {
      // Get stats from licitaciones table (compras ágiles)
      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, estado, match_encontrado, presupuesto, fecha_cierre');

      if (licError) throw licError;

      // Get stats from licitaciones_bi (licitaciones grandes)
      const { count: licitacionesBICount, error: biError } = await supabase
        .from('licitaciones_bi')
        .select('*', { count: 'exact', head: true });

      if (biError) throw biError;

      const now = new Date();
      const comprasAgiles = licitaciones?.length || 0;
      const licitacionesGrandes = licitacionesBICount || 0;
      const totalOportunidades = comprasAgiles + licitacionesGrandes;
      
      const activas = licitaciones?.filter(l => 
        l.fecha_cierre && new Date(l.fecha_cierre) > now
      )?.length || 0;
      
      const conMatch = licitaciones?.filter(l => l.match_encontrado)?.length || 0;
      const matchRate = comprasAgiles > 0 ? Math.round((conMatch / comprasAgiles) * 100) : 0;
      
      const valorPotencial = licitaciones
        ?.filter(l => l.match_encontrado && l.presupuesto)
        ?.reduce((sum, l) => sum + (l.presupuesto || 0), 0) || 0;

      return {
        totalOportunidades,
        comprasAgiles,
        licitacionesGrandes,
        oportunidadesActivas: activas,
        conMatch,
        matchRate,
        valorPotencial,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
