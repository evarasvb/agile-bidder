// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { differenceInHours, parseISO, startOfDay, addDays } from 'date-fns';
import type { ClienteFiltros } from './useClienteFiltros';

// =============================================================================
// INTERFACES
// =============================================================================

export interface CompraAgilItem {
  id: string;
  compra_agil_id: string;
  codigo_producto: string | null;
  nombre_producto: string;
  descripcion_producto: string | null;
  cantidad: number;
  unidad: string | null;
}

export interface CompraAgil {
  id: string;
  codigo: string;
  nombre: string;
  organismo: string;
  monto: number | null;
  moneda: string | null;
  fecha_cierre: string | null;
  fecha_publicacion: string | null;
  estado: string | null;
  descripcion: string | null;
  match_encontrado: boolean;
  match_score: number;
  items: CompraAgilItem[];
  datos_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ComprasAgilesFilters {
  estado?: string;
  montoMin?: number;
  montoMax?: number;
  fechaCierre?: 'hoy' | 'proximos3' | 'proximos7' | 'todas';
  matchStatus?: 'con_match' | 'sin_match' | 'todos';
  clienteFiltros?: ClienteFiltros | null;
}

// =============================================================================
// MAPPER
// =============================================================================

function mapRowToCompraAgil(row: any): CompraAgil {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre || 'Sin título',
    organismo: row.organismo || row.nombre_organismo || 'Sin organismo',
    monto: row.monto ?? row.monto_estimado ?? row.monto_disponible ?? null,
    moneda: row.moneda ?? row.datos_json?.moneda ?? null,
    fecha_cierre: row.fecha_cierre || null,
    fecha_publicacion: row.fecha_publicacion || row.datos_json?.fecha_publicacion || null,
    estado: row.estado || null,
    descripcion: row.descripcion || null,
    match_encontrado: row.match_encontrado ?? false,
    match_score: row.match_score ?? 0,
    items: (row.compras_agiles_items || []).map((i: any) => ({
      id: i.id,
      compra_agil_id: i.compra_agil_id,
      codigo_producto: i.codigo_producto,
      nombre_producto: i.nombre_producto,
      descripcion_producto: i.descripcion ?? i.descripcion_producto,
      cantidad: i.cantidad,
      unidad: i.unidad,
    })),
    datos_json: row.datos_json || null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

// =============================================================================
// HOOKS PRINCIPALES
// =============================================================================

/**
 * Hook para listar compras ágiles con items incluidos
 * CORREGIDO: Ahora consulta tabla 'compras_agiles' con JOIN a 'compras_agiles_items'
 */
export function useComprasAgiles(filters?: ComprasAgilesFilters) {
  return useQuery({
    queryKey: ['compras_agiles', filters],
    queryFn: async (): Promise<CompraAgil[]> => {
      // CAMBIO CRÍTICO: Usar tabla compras_agiles (NO licitaciones)
      let query = supabase
        .from('compras_agiles')
        .select(`
          *,
          compras_agiles_items(*)
        `)
        .order('fecha_cierre', { ascending: true });

      // Filtros opcionales
      if (filters?.estado && filters.estado !== 'todas') {
        query = query.eq('estado', filters.estado);
      }

      if (filters?.montoMin) {
        query = query.gte('monto', filters.montoMin);
      }

      if (filters?.montoMax) {
        query = query.lte('monto', filters.montoMax);
      }

      // Filtro de fecha de cierre
      if (filters?.fechaCierre && filters.fechaCierre !== 'todas') {
        const today = startOfDay(new Date());
        const todayISO = today.toISOString();

        if (filters.fechaCierre === 'hoy') {
          const tomorrow = addDays(today, 1);
          query = query
            .gte('fecha_cierre', todayISO)
            .lt('fecha_cierre', tomorrow.toISOString());
        } else if (filters.fechaCierre === 'proximos3') {
          const in3 = addDays(today, 3);
          query = query
            .gte('fecha_cierre', todayISO)
            .lte('fecha_cierre', in3.toISOString());
        } else if (filters.fechaCierre === 'proximos7') {
          const in7 = addDays(today, 7);
          query = query
            .gte('fecha_cierre', todayISO)
            .lte('fecha_cierre', in7.toISOString());
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching compras_agiles:', error);
        throw error;
      }

      let compras = (data || []).map(mapRowToCompraAgil);

      // Filtro de match en memoria
      if (filters?.matchStatus === 'con_match') {
        compras = compras.filter(c => c.match_encontrado);
      } else if (filters?.matchStatus === 'sin_match') {
        compras = compras.filter(c => !c.match_encontrado);
      }

      console.log(`[useComprasAgiles] Loaded ${compras.length} compras ágiles`);
      return compras;
    },
    refetchInterval: 30000,
  });
}

/**
 * Hook para obtener detalle de una compra ágil por código
 * Incluye items relacionados
 */
export function useCompraAgil(codigo: string | null) {
  return useQuery({
    queryKey: ['compra_agil', codigo],
    queryFn: async (): Promise<CompraAgil | null> => {
      if (!codigo) return null;

      const { data, error } = await supabase
        .from('compras_agiles')
        .select(`
          *,
          compras_agiles_items(*)
        `)
        .eq('codigo', codigo)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return mapRowToCompraAgil(data);
    },
    enabled: !!codigo,
  });
}

/**
 * Hook para obtener estadísticas de compras ágiles
 */
export function useComprasAgilesStats() {
  return useQuery({
    queryKey: ['compras_agiles_stats'],
    queryFn: async () => {
      const { count: total, error: countError } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const { count: conMatch } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true })
        .eq('match_encontrado', true);

      const { data: montoData } = await supabase
        .from('compras_agiles')
        .select('monto');

      const montoTotal = (montoData || []).reduce(
        (sum, c) => sum + (c.monto || 0),
        0
      );

      // Compras urgentes (cierre < 24hrs)
      const tomorrow = addDays(new Date(), 1);
      const { count: urgentes } = await supabase
        .from('compras_agiles')
        .select('*', { count: 'exact', head: true })
        .gte('fecha_cierre', new Date().toISOString())
        .lt('fecha_cierre', tomorrow.toISOString());

      return {
        total: total || 0,
        conMatch: conMatch || 0,
        urgentes: urgentes || 0,
        montoTotal,
      };
    },
  });
}

/**
 * Hook para actualizar una compra ágil
 */
export function useUpdateCompraAgil() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      datos_json,
    }: {
      id: string;
      datos_json: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from('compras_agiles')
        .update({ datos_json })
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

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// =============================================================================

// Mantener compatibilidad con código existente que usa nombres antiguos
export { useComprasAgiles as useLicitaciones };
export { useCompraAgil as useLicitacion };
export { useCompraAgil as useLicitacionByCodigo };
export { useUpdateCompraAgil as useUpdateLicitacion };
export { useComprasAgilesStats as useLicitacionesStats };

// Tipos para backward compatibility
export type Licitacion = CompraAgil;
export type LicitacionesFilters = ComprasAgilesFilters;
