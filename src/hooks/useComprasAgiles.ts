import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import type { Database } from '@/integrations/supabase/types';
import { pasaFiltrosCliente, ClienteFiltros } from './useClienteFiltros';
import { differenceInDays, parseISO, startOfDay, addDays } from 'date-fns';

// Tipo base de la BD - usar tabla licitaciones
type LicitacionRow = Database['public']['Tables']['licitaciones']['Row'];

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
  fechaCierre?: string; // 'hoy' | 'proximos3' | 'proximos7' | 'todas'
  matchStatus?: string; // 'con_match' | 'sin_match' | 'todos'
  matchThreshold?: number; // 0-100, default 70
  clienteFiltros?: ClienteFiltros | null; // Filtros personalizados del cliente
}

export function useComprasAgiles(filters?: ComprasAgilesFilters) {
  return useQuery({
    queryKey: ['compras_agiles', filters],
    queryFn: async () => {
      // CAMBIO CRÍTICO: Usar tabla licitaciones en lugar de compras_agiles
      let query = supabase
        .from('licitaciones')
        .select('*')
        .order('fecha_cierre', { ascending: true, nullsFirst: false });

      // Aplicar filtros opcionales
      if (filters?.estado && filters.estado !== 'todas') {
        query = query.eq('estado', filters.estado);
      }

      if (filters?.montoMin) {
        query = query.gte('presupuesto', filters.montoMin);
      }

      if (filters?.montoMax) {
        query = query.lte('presupuesto', filters.montoMax);
      }

      // Filtro de match status
      if (filters?.matchStatus === 'con_match') {
        query = query.eq('match_encontrado', true);
      } else if (filters?.matchStatus === 'sin_match') {
        query = query.eq('match_encontrado', false);
      }

      // Filtro de fecha de cierre
      if (filters?.fechaCierre && filters.fechaCierre !== 'todas') {
        const today = startOfDay(new Date());
        const todayISO = today.toISOString();
        
        if (filters.fechaCierre === 'hoy') {
          const tomorrow = addDays(today, 1);
          query = query.gte('fecha_cierre', todayISO).lt('fecha_cierre', tomorrow.toISOString());
        } else if (filters.fechaCierre === 'proximos3') {
          const in3Days = addDays(today, 3);
          query = query.gte('fecha_cierre', todayISO).lte('fecha_cierre', in3Days.toISOString());
        } else if (filters.fechaCierre === 'proximos7') {
          const in7Days = addDays(today, 7);
          query = query.gte('fecha_cierre', todayISO).lte('fecha_cierre', in7Days.toISOString());
        }
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching licitaciones:', error);
        throw error;
      }

      // Debug: ver estructura real de datos
      if (data && data.length > 0) {
        console.log('[useComprasAgiles] Sample row keys:', Object.keys(data[0]));
        console.log('[useComprasAgiles] Sample row:', data[0]);
      }

      // Mapear campos - manejar diferentes schemas (licitaciones vs compras_agiles)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compras = (data || []).map((row: any, index: number): CompraAgil => {
        // La tabla licitaciones usa 'id_licitacion', compras_agiles usa 'codigo'
        const codigo = row.id_licitacion || row.codigo || row.id || '';
        
        // DEBUG: Log primeros 3 registros para verificar mapeo
        if (index < 3) {
          console.log(`[useComprasAgiles] Row ${index}:`, { 
            id_licitacion: row.id_licitacion, 
            codigo: row.codigo, 
            id: row.id,
            mapped_codigo: codigo 
          });
        }
        
        return {
          id: codigo,
          codigo: codigo,
          nombre: row.titulo || row.nombre || 'Sin título',
          organismo: row.organismo || 'Sin organismo',
          monto: row.presupuesto || row.monto || null,
          fecha_cierre: row.fecha_cierre || null,
          estado: row.estado || null,
          region: row.region || null,
          descripcion: row.descripcion || null,
          link_oficial: row.link_oficial || null,
          match_encontrado: row.match_encontrado ?? false,
          match_score: row.match_score ?? null,
          datos_json: row.datos_json || null,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || row.created_at || new Date().toISOString(),
        };
      });
      
      // Aplicar filtros personalizados del cliente
      const comprasFiltradas = filters?.clienteFiltros 
        ? compras.filter(compra => pasaFiltrosCliente(compra, filters.clienteFiltros!))
        : compras;
      
      return comprasFiltradas;
    },
    refetchInterval: 30000,
  });
}

export function useCompraAgil(id: string | null) {
  return useQuery({
    queryKey: ['compra_agil', id],
    queryFn: async (): Promise<CompraAgil | null> => {
      if (!id) return null;
      
      // FirmaVB usa columna 'codigo', no 'id_licitacion'
      // Usar any para evitar conflicto con tipos de Lovable Cloud
      const { data, error } = await (supabase as any)
        .from('licitaciones')
        .select('*')
        .eq('codigo', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      const codigo = row.codigo || row.id_licitacion || row.id || '';

      return {
        id: codigo,
        codigo: codigo,
        nombre: row.titulo || row.nombre || 'Sin título',
        organismo: row.organismo || 'Sin organismo',
        monto: row.presupuesto || row.monto || null,
        fecha_cierre: row.fecha_cierre || null,
        estado: row.estado || null,
        region: row.region || null,
        descripcion: row.descripcion || null,
        link_oficial: row.link_oficial || null,
        match_encontrado: row.match_encontrado ?? false,
        match_score: row.match_score ?? null,
        datos_json: row.datos_json || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      };
    },
    enabled: !!id,
  });
}

export function useCompraAgilByCodigo(codigo: string | undefined) {
  return useQuery({
    queryKey: ['compra_agil_codigo', codigo],
    queryFn: async (): Promise<CompraAgil | null> => {
      if (!codigo) return null;
      
      // FirmaVB usa columna 'codigo', no 'id_licitacion'
      // Usar any para evitar conflicto con tipos de Lovable Cloud
      const { data, error } = await (supabase as any)
        .from('licitaciones')
        .select('*')
        .eq('codigo', codigo)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      const codigoValue = row.codigo || row.id_licitacion || row.id || '';

      return {
        id: codigoValue,
        codigo: codigoValue,
        nombre: row.titulo || row.nombre || 'Sin título',
        organismo: row.organismo || 'Sin organismo',
        monto: row.presupuesto || row.monto || null,
        fecha_cierre: row.fecha_cierre || null,
        estado: row.estado || null,
        region: row.region || null,
        descripcion: row.descripcion || null,
        link_oficial: row.link_oficial || null,
        match_encontrado: row.match_encontrado ?? false,
        match_score: row.match_score ?? null,
        datos_json: row.datos_json || null,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || row.created_at || new Date().toISOString(),
      };
    },
    enabled: !!codigo,
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
      // Usar tabla licitaciones para stats
      const { count: total, error: countError } = await supabase
        .from('licitaciones')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Obtener stats agregados con consultas separadas
      const { count: conMatch } = await supabase
        .from('licitaciones')
        .select('*', { count: 'exact', head: true })
        .eq('match_encontrado', true);

      // Calcular monto total (usando presupuesto)
      const { data: montoData } = await supabase
        .from('licitaciones')
        .select('presupuesto');

      const montoTotal = (montoData || []).reduce((sum, c) => sum + (c.presupuesto || 0), 0);

      // Contar urgentes (si el estado existe)
      const { count: urgentes } = await supabase
        .from('licitaciones')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'urgente');

      return {
        total: total || 0,
        conMatch: conMatch || 0,
        urgentes: urgentes || 0,
        montoTotal,
      };
    },
  });
}
