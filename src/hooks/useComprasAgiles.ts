import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserSettings } from './useUserSettings';
import { esRegionActiva } from '@/utils/regiones';

export interface CompraAgil {
  id: string;
  codigo: string;
  nombre: string;
  organismo: string; // Mapeado desde nombre_organismo
  monto: number | null; // Mapeado desde monto_estimado
  fecha_cierre: string | null;
  estado: string | null;
  region: string | null;
  descripcion: string | null;
  link_oficial: string | null;
  match_encontrado: boolean;
  match_score: number | null;
  buen_pagador: boolean | null;
  datos_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Campos reales de la BD
  nombre_organismo?: string;
  monto_estimado?: number | null;
}

export interface ComprasAgilesFilters {
  estado?: string;
  region?: string;
  montoMin?: number;
  montoMax?: number;
}

export function useComprasAgiles(filters?: ComprasAgilesFilters) {
  const { data: userSettings } = useUserSettings();
  
  return useQuery({
    queryKey: ['compras_agiles', filters, userSettings?.regiones_config, userSettings?.regions],
    queryFn: async () => {
      let query = supabase
        .from('compras_agiles')
        .select('*')
        .order('fecha_cierre', { ascending: true });

      if (filters?.estado && filters.estado !== 'todas') {
        query = query.eq('estado', filters.estado);
      }

      if (filters?.region && filters.region !== 'todas') {
        query = query.eq('region', filters.region);
      }

      if (filters?.montoMin) {
        query = query.gte('monto_estimado', filters.montoMin);
      }

      if (filters?.montoMax) {
        query = query.lte('monto_estimado', filters.montoMax);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Mapear campos de BD a interfaz
      let compras = (data || []).map(compra => ({
        ...compra,
        organismo: compra.nombre_organismo || compra.organismo || '',
        monto: compra.monto_estimado || compra.monto || null,
      })) as CompraAgil[];
      
      // Filtrar por regiones activas del usuario (si está configurado)
      if (userSettings && (userSettings.regiones_config?.length > 0 || userSettings.regions?.length > 0)) {
        compras = compras.filter(compra => {
          if (!compra.region) return true; // Si no tiene región, mostrar
          return esRegionActiva(
            compra.region,
            userSettings.regiones_config || [],
            userSettings.regions || []
          );
        });
      }
      
      return compras;
    },
    refetchInterval: 30000,
  });
}

export function useCompraAgil(id: string | null) {
  return useQuery({
    queryKey: ['compra_agil', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as CompraAgil | null;
    },
    enabled: !!id,
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
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*');

      if (error) throw error;

      const compras = (data || []).map(c => {
        const cAny = c as any;
        return {
          ...c,
          organismo: cAny.nombre_organismo || c.organismo || '',
          monto: cAny.monto_estimado || c.monto || null,
        } as CompraAgil;
      });
      
      const total = compras.length;
      const conMatch = compras.filter(c => c.match_encontrado).length;
      const urgentes = compras.filter(c => c.estado === 'urgente').length;
      const montoTotal = compras.reduce((sum, c) => sum + (c.monto || 0), 0);

      return {
        total,
        conMatch,
        urgentes,
        montoTotal,
      };
    },
  });
}
