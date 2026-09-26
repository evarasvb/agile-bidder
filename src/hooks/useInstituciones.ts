import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types (alineados a las tablas reales: instituciones se identifica por `rut`, no por `id`)
export interface Institucion {
  rut: string;
  nombre: string | null;
  codigo_entidad?: string | null;
  sector?: string | null;
  region?: string | null;
  comuna?: string | null;
  direccion?: string | null;
  oc_total?: number | null;
  oc_monto_total?: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InstitucionDashboard {
  rut: string | null;
  nombre: string | null;
  region: string | null;
  comuna: string | null;
  sector: string | null;
  oc_total: number | null;
  oc_monto_total: number | null;
  pago_promedio_dias: number | null;
  estado_gestion: string | null;
  prioridad: number | null;
  asignado_a: string | null;
  bloqueada: boolean | null;
  motivo_bloqueo: string | null;
  notas: string | null;
  etiquetas: string[] | null;
}

export interface InstitucionGestion {
  rut: string;
  asignado_a?: string | null;
  bloqueada?: boolean;
  estado?: string;
  etiquetas?: string[] | null;
  motivo_bloqueo?: string | null;
  notas?: string | null;
  prioridad?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InstitucionInteraccion {
  id: string;
  rut: string;
  tipo: string;
  resumen?: string | null;
  resultado?: string | null;
  proxima_accion?: string | null;
  proxima_fecha?: string | null;
  created_at: string;
}

export interface ConductaPago {
  id: string;
  rut_institucion: string;
  institucion?: string | null;
  unidad_compra?: string | null;
  periodo?: string | null;
  dias_promedio_pago?: number | null;
  porcentaje_morosidad?: number | null;
  muestras?: number | null;
  fuente?: string | null;
  created_at: string;
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
      let query = supabase
        .from('instituciones')
        .select('*')
        .order('oc_monto_total', { ascending: false, nullsFirst: false });

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
      return (data || []).map((i) => ({
        rut: i.rut,
        nombre: i.nombre,
        codigo_entidad: i.codigo_entidad,
        sector: i.sector,
        region: i.region,
        comuna: i.comuna,
        direccion: i.domicilio_legal,
        oc_total: i.oc_total,
        oc_monto_total: i.oc_monto_total,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })) as Institucion[];
    },
  });
}

// Hook: Obtener una institución (por rut)
export function useInstitucion(rut: string | null) {
  return useQuery({
    queryKey: ['institucion', rut],
    queryFn: async () => {
      if (!rut) return null;
      const { data, error } = await supabase
        .from('instituciones')
        .select('*')
        .eq('rut', rut)
        .single();
      if (error) throw error;
      return {
        rut: data.rut,
        nombre: data.nombre,
        codigo_entidad: data.codigo_entidad,
        sector: data.sector,
        region: data.region,
        comuna: data.comuna,
        direccion: data.domicilio_legal,
        oc_total: data.oc_total,
        oc_monto_total: data.oc_monto_total,
        created_at: data.created_at,
        updated_at: data.updated_at,
      } as Institucion;
    },
    enabled: !!rut,
  });
}

// Hook: Dashboard de instituciones (vista con gestión comercial ya unida)
export function useInstitucionesDashboard() {
  return useQuery({
    queryKey: ['instituciones-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instituciones_dashboard')
        .select('*')
        .order('oc_monto_total', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as InstitucionDashboard[];
    },
  });
}

// Hook: Gestión comercial de instituciones
export function useInstitucionesGestion(asignadoA?: string) {
  return useQuery({
    queryKey: ['instituciones-gestion', asignadoA],
    queryFn: async () => {
      let query = supabase
        .from('instituciones_gestion')
        .select('*, instituciones(nombre, rut, region)')
        .order('prioridad', { ascending: false });

      if (asignadoA) {
        query = query.eq('asignado_a', asignadoA);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as (InstitucionGestion & { instituciones: Partial<Institucion> | null })[];
    },
  });
}

// Hook: Crear/Actualizar gestión
export function useUpsertGestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gestion: InstitucionGestion) => {
      const { data, error } = await supabase
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
export function useInstitucionInteracciones(rut: string | null) {
  return useQuery({
    queryKey: ['institucion-interacciones', rut],
    queryFn: async () => {
      if (!rut) return [];
      const { data, error } = await supabase
        .from('instituciones_interacciones')
        .select('*')
        .eq('rut', rut)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as InstitucionInteraccion[];
    },
    enabled: !!rut,
  });
}

// Hook: Crear interacción
export function useCrearInteraccion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interaccion: Omit<InstitucionInteraccion, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('instituciones_interacciones')
        .insert(interaccion)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['institucion-interacciones', variables.rut] });
    },
  });
}

// Hook: Conducta de pago (última muestra registrada para la institución)
export function useConductaPago(rutInstitucion: string | null) {
  return useQuery({
    queryKey: ['conducta-pago', rutInstitucion],
    queryFn: async () => {
      if (!rutInstitucion) return null;
      const { data, error } = await supabase
        .from('conducta_pago')
        .select('*')
        .eq('rut_institucion', rutInstitucion)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as ConductaPago | null;
    },
    enabled: !!rutInstitucion,
  });
}

// Hook: Estadísticas generales de instituciones
export function useInstitucionesStats() {
  return useQuery({
    queryKey: ['instituciones-stats'],
    queryFn: async () => {
      const { count } = await supabase
        .from('instituciones')
        .select('*', { count: 'exact', head: true });

      const { data: topData } = await supabase
        .from('instituciones')
        .select('oc_monto_total')
        .order('oc_monto_total', { ascending: false })
        .limit(10);

      const totalMonto = topData?.reduce((sum: number, i) => sum + (i.oc_monto_total || 0), 0) || 0;

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
      const { data, error } = await supabase
        .from('bi_oc_negocios_por_institucion')
        .select('*')
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}
