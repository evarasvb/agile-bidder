import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface Institucion {
  id: string;
  nombre: string;
  rut: string;
  codigo?: string;
  tipo?: string;
  sector?: string;
  region?: string;
  comuna?: string;
  direccion?: string;
  total_licitaciones?: number;
  total_ordenes?: number;
  monto_total_compras?: number;
  created_at: string;
  updated_at: string;
}

export interface InstitucionDashboard {
  id: string;
  institucion_id: string;
  total_compras: number;
  monto_total_compras: number;
  promedio_por_compra: number;
  ultima_compra_fecha?: string;
  tendencia_compras?: string;
  categoria_gasto?: string;
  score_oportunidad: number;
  updated_at: string;
}

export interface InstitucionGestion {
  id: string;
  institucion_id: string;
  user_id?: string;
  estado_gestion: string;
  fecha_ultimo_contacto?: string;
  proximo_seguimiento?: string;
  notas?: string;
  prioridad: number;
  created_at: string;
  updated_at: string;
}

export interface InstitucionInteraccion {
  id: string;
  institucion_id: string;
  gestion_id?: string;
  user_id?: string;
  tipo_interaccion: string;
  descripcion?: string;
  resultado?: string;
  fecha_interaccion: string;
  created_at: string;
}

export interface ConductaPago {
  id: string;
  institucion_id: string;
  promedio_dias_pago?: number;
  ordenes_pagadas_a_tiempo: number;
  ordenes_pagadas_tardias: number;
  monto_pendiente: number;
  score_pago: number;
  ultima_actualizacion: string;
}

// Hook: Listar instituciones
export function useInstituciones(filters?: { 
  region?: string; 
  sector?: string; 
  search?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['instituciones', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('instituciones')
        .select('*')
        .order('monto_total_compras', { ascending: false, nullsFirst: false });

      if (filters?.region) {
        query = query.eq('region', filters.region);
      }
      if (filters?.sector) {
        query = query.eq('sector', filters.sector);
      }
      if (filters?.search) {
        query = query.or(`nombre.ilike.%${filters.search}%,rut.ilike.%${filters.search}%`);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Institucion[];
    },
  });
}

// Hook: Obtener una institución
export function useInstitucion(id: string | null) {
  return useQuery({
    queryKey: ['institucion', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from('instituciones')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Institucion;
    },
    enabled: !!id,
  });
}

// Hook: Dashboard de instituciones
export function useInstitucionesDashboard() {
  return useQuery({
    queryKey: ['instituciones-dashboard'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('instituciones_dashboard')
        .select('*, instituciones(nombre, rut, region)')
        .order('score_oportunidad', { ascending: false });
      if (error) throw error;
      return data as (InstitucionDashboard & { instituciones: Partial<Institucion> })[];
    },
  });
}

// Hook: Gestión comercial de instituciones
export function useInstitucionesGestion(userId?: string) {
  return useQuery({
    queryKey: ['instituciones-gestion', userId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('instituciones_gestion')
        .select('*, instituciones(nombre, rut, region)')
        .order('prioridad', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (InstitucionGestion & { instituciones: Partial<Institucion> })[];
    },
  });
}

// Hook: Crear/Actualizar gestión
export function useUpsertGestion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (gestion: Partial<InstitucionGestion>) => {
      const { data, error } = await (supabase as any)
        .from('instituciones_gestion')
        .upsert(gestion)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instituciones-gestion'] });
    },
  });
}

// Hook: Interacciones de una institución
export function useInstitucionInteracciones(institucionId: string | null) {
  return useQuery({
    queryKey: ['institucion-interacciones', institucionId],
    queryFn: async () => {
      if (!institucionId) return [];
      const { data, error } = await (supabase as any)
        .from('instituciones_interacciones')
        .select('*')
        .eq('institucion_id', institucionId)
        .order('fecha_interaccion', { ascending: false });
      if (error) throw error;
      return data as InstitucionInteraccion[];
    },
    enabled: !!institucionId,
  });
}

// Hook: Crear interacción
export function useCrearInteraccion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (interaccion: Partial<InstitucionInteraccion>) => {
      const { data, error } = await (supabase as any)
        .from('instituciones_interacciones')
        .insert(interaccion)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['institucion-interacciones', variables.institucion_id] });
    },
  });
}

// Hook: Conducta de pago
export function useConductaPago(institucionId: string | null) {
  return useQuery({
    queryKey: ['conducta-pago', institucionId],
    queryFn: async () => {
      if (!institucionId) return null;
      const { data, error } = await (supabase as any)
        .from('conducta_pago')
        .select('*')
        .eq('institucion_id', institucionId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as ConductaPago | null;
    },
    enabled: !!institucionId,
  });
}

// Hook: Estadísticas generales de instituciones
export function useInstitucionesStats() {
  return useQuery({
    queryKey: ['instituciones-stats'],
    queryFn: async () => {
      const { data, error, count } = await (supabase as any)
        .from('instituciones')
        .select('*', { count: 'exact', head: false })
        .limit(1);

      const { data: topData } = await (supabase as any)
        .from('instituciones')
        .select('monto_total_compras')
        .order('monto_total_compras', { ascending: false })
        .limit(10);

      const totalMonto = topData?.reduce((sum: number, i: any) => sum + (i.monto_total_compras || 0), 0) || 0;

      return {
        totalInstituciones: count || 0,
        montoTop10: totalMonto,
      };
    },
  });
}

// Hook: BI por institución
export function useBIInstitucion() {
  return useQuery({
    queryKey: ['bi-instituciones'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bi_oc_negocios_por_institucion')
        .select('*')
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}
