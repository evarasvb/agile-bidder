import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Vendedor {
  id: string;
  user_id: string | null;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendedorAsignacion {
  id: string;
  licitacion_id: string;
  licitacion_codigo: string | null;
  vendedor_id: string;
  estado: string;
  fecha_cierre: string | null;
  monto_estimado: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface AsignacionDetalle {
  id: string;
  licitacion_id: string;
  licitacion_codigo: string | null;
  estado: string;
  fecha_cierre: string | null;
  monto_estimado: number | null;
  notas: string | null;
  created_at: string;
  vendedor_id: string;
  vendedor_nombre: string;
  vendedor_email: string;
}

export interface ReporteEquipo {
  vendedor_id: string;
  nombre: string;
  email: string;
  rol: string;
  total_negocios: number;
  postulados: number;
  adjudicados: number;
  monto_total: number;
  monto_adjudicado: number;
  tasa_adjudicacion: number;
}

export interface CalendarioEvento {
  id: string;
  vendedor_id: string;
  vendedor_nombre: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_evento: string;
  color: string;
  estado_asignacion: string | null;
  licitacion_codigo: string | null;
  monto_estimado: number | null;
}

// Hook para obtener todos los vendedores activos
export function useVendedores() {
  return useQuery({
    queryKey: ['vendedores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('activo', true)
        .order('nombre');
      
      if (error) throw error;
      return data as Vendedor[];
    },
  });
}

// Hook para crear un nuevo vendedor
export function useCreateVendedor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendedor: Omit<Vendedor, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('vendedores')
        .insert(vendedor)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedores'] });
      toast.success('Vendedor creado exitosamente');
    },
    onError: (error) => {
      toast.error('Error al crear vendedor: ' + error.message);
    },
  });
}

// Hook para obtener asignaciones de un vendedor
export function useVendedorAsignaciones(vendedorId: string | null) {
  return useQuery({
    queryKey: ['vendedor-asignaciones', vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];
      
      const { data, error } = await supabase
        .from('vendedor_asignaciones')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .order('fecha_cierre', { ascending: true });
      
      if (error) throw error;
      return data as VendedorAsignacion[];
    },
    enabled: !!vendedorId,
  });
}

// Hook para obtener todas las asignaciones con detalles
export function useAsignacionesDetalle() {
  return useQuery({
    queryKey: ['asignaciones-detalle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_asignaciones_detalle')
        .select('*')
        .order('fecha_cierre', { ascending: true });
      
      if (error) throw error;
      return data as AsignacionDetalle[];
    },
  });
}

// Hook para asignar una licitación a un vendedor
export function useAsignarLicitacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      licitacionId,
      licitacionCodigo,
      vendedorId,
      fechaCierre,
      montoEstimado,
      notas,
    }: {
      licitacionId: string;
      licitacionCodigo?: string;
      vendedorId: string;
      fechaCierre?: string;
      montoEstimado?: number;
      notas?: string;
    }) => {
      // Verificar si ya existe una asignación
      const { data: existing } = await supabase
        .from('vendedor_asignaciones')
        .select('id')
        .eq('licitacion_id', licitacionId)
        .maybeSingle();
      
      if (existing) {
        // Actualizar asignación existente
        const { data, error } = await supabase
          .from('vendedor_asignaciones')
          .update({
            vendedor_id: vendedorId,
            notas,
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
      
      // Crear nueva asignación
      const { data, error } = await supabase
        .from('vendedor_asignaciones')
        .insert({
          licitacion_id: licitacionId,
          licitacion_codigo: licitacionCodigo,
          vendedor_id: vendedorId,
          fecha_cierre: fechaCierre,
          monto_estimado: montoEstimado,
          notas,
          estado: 'asignada',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Crear evento en calendario
      await supabase.from('vendedor_calendario').insert({
        vendedor_id: vendedorId,
        asignacion_id: data.id,
        titulo: `Cierre: ${licitacionCodigo || licitacionId}`,
        fecha_inicio: fechaCierre || new Date().toISOString(),
        tipo_evento: 'cierre',
        color: '#ef4444',
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedor-asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['asignaciones-detalle'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-vendedor'] });
      toast.success('Licitación asignada exitosamente');
    },
    onError: (error) => {
      toast.error('Error al asignar licitación: ' + error.message);
    },
  });
}

// Hook para actualizar estado de asignación
export function useActualizarAsignacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      asignacionId,
      estado,
      notas,
    }: {
      asignacionId: string;
      estado?: string;
      notas?: string;
    }) => {
      const { data, error } = await supabase
        .from('vendedor_asignaciones')
        .update({ estado, notas })
        .eq('id', asignacionId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedor-asignaciones'] });
      queryClient.invalidateQueries({ queryKey: ['asignaciones-detalle'] });
      queryClient.invalidateQueries({ queryKey: ['reporte-equipo'] });
      toast.success('Asignación actualizada');
    },
    onError: (error) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });
}

// Hook para obtener reporte de equipo
export function useReporteEquipo() {
  return useQuery({
    queryKey: ['reporte-equipo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_reporte_equipo')
        .select('*')
        .order('total_negocios', { ascending: false });
      
      if (error) throw error;
      return data as ReporteEquipo[];
    },
  });
}

// Hook para obtener calendario de vendedores
export function useCalendarioVendedor(vendedorId?: string) {
  return useQuery({
    queryKey: ['calendario-vendedor', vendedorId],
    queryFn: async () => {
      let query = supabase
        .from('v_calendario_vendedor')
        .select('*')
        .order('fecha_inicio', { ascending: true });
      
      if (vendedorId) {
        query = query.eq('vendedor_id', vendedorId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as CalendarioEvento[];
    },
  });
}

// Hook para obtener asignación de una licitación específica
export function useLicitacionAsignacion(licitacionId: string) {
  return useQuery({
    queryKey: ['licitacion-asignacion', licitacionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_asignaciones_detalle')
        .select('*')
        .eq('licitacion_id', licitacionId)
        .maybeSingle();
      
      if (error) throw error;
      return data as AsignacionDetalle | null;
    },
  });
}
