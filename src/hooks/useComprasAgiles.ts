import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays, parseISO, startOfDay, addDays } from 'date-fns';

// Tipo base de la BD - usar directamente los campos que existen
type CompraAgilRow = Database['public']['Tables']['compras_agiles']['Row'];

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
}

export function useComprasAgiles(filters?: ComprasAgilesFilters) {
  return useQuery({
    queryKey: ['compras_agiles', filters],
    queryFn: async () => {
      let query = supabase
        .from('compras_agiles')
        .select('*')
        .order('fecha_cierre', { ascending: true, nullsFirst: false });

      // Aplicar filtros opcionales
      if (filters?.estado && filters.estado !== 'todas') {
        query = query.eq('estado', filters.estado);
      }

      if (filters?.region && filters.region !== 'todas') {
        query = query.eq('region', filters.region);
      }

      if (filters?.montoMin) {
        query = query.gte('monto', filters.montoMin);
      }

      if (filters?.montoMax) {
        query = query.lte('monto', filters.montoMax);
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
        console.error('Error fetching compras_agiles:', error);
        throw error;
      }

      // Mapear campos de BD a interfaz (sin filtros que excluyan datos reales)
      const compras = (data || []).map((compra: CompraAgilRow): CompraAgil => {
        // Convertir datos_json de Json a Record<string, unknown>
        const datosJson = compra.datos_json;
        const datosJsonRecord = datosJson && typeof datosJson === 'object' && !Array.isArray(datosJson)
          ? datosJson as Record<string, unknown>
          : Array.isArray(datosJson)
          ? { items: datosJson }
          : null;
        
        return {
          id: compra.id,
          codigo: compra.codigo,
          nombre: compra.nombre,
          organismo: compra.organismo,
          monto: compra.monto,
          fecha_cierre: compra.fecha_cierre,
          estado: compra.estado,
          region: compra.region,
          descripcion: compra.descripcion,
          link_oficial: compra.link_oficial,
          match_encontrado: compra.match_encontrado ?? false,
          match_score: compra.match_score,
          datos_json: datosJsonRecord,
          created_at: compra.created_at,
          updated_at: compra.updated_at,
        };
      });
      
      return compras;
    },
    refetchInterval: 30000,
  });
}

export function useCompraAgil(id: string | null) {
  return useQuery({
    queryKey: ['compra_agil', id],
    queryFn: async (): Promise<CompraAgil | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      const datosJson = data.datos_json;
      const datosJsonRecord = datosJson && typeof datosJson === 'object' && !Array.isArray(datosJson)
        ? datosJson as Record<string, unknown>
        : Array.isArray(datosJson)
        ? { items: datosJson }
        : null;

      return {
        id: data.id,
        codigo: data.codigo,
        nombre: data.nombre,
        organismo: data.organismo,
        monto: data.monto,
        fecha_cierre: data.fecha_cierre,
        estado: data.estado,
        region: data.region,
        descripcion: data.descripcion,
        link_oficial: data.link_oficial,
        match_encontrado: data.match_encontrado ?? false,
        match_score: data.match_score,
        datos_json: datosJsonRecord,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
      
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .eq('codigo', codigo)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      const datosJson = data.datos_json;
      const datosJsonRecord = datosJson && typeof datosJson === 'object' && !Array.isArray(datosJson)
        ? datosJson as Record<string, unknown>
        : Array.isArray(datosJson)
        ? { items: datosJson }
        : null;

      return {
        id: data.id,
        codigo: data.codigo,
        nombre: data.nombre,
        organismo: data.organismo,
        monto: data.monto,
        fecha_cierre: data.fecha_cierre,
        estado: data.estado,
        region: data.region,
        descripcion: data.descripcion,
        link_oficial: data.link_oficial,
        match_encontrado: data.match_encontrado ?? false,
        match_score: data.match_score,
        datos_json: datosJsonRecord,
        created_at: data.created_at,
        updated_at: data.updated_at,
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
      // Usar count para obtener el total sin traer todos los datos
      const { count: total, error: countError } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // Obtener stats agregados con consultas separadas
      const { count: conMatch } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true })
        .eq('match_encontrado', true);

      // Calcular monto total con una consulta más eficiente
      const { data: montoData } = await supabase
        .from('compras_agiles')
        .select('monto');

      const montoTotal = (montoData || []).reduce((sum, c) => sum + (c.monto || 0), 0);

      // Contar urgentes (si el estado existe)
      const { count: urgentes } = await supabase
        .from('compras_agiles')
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
