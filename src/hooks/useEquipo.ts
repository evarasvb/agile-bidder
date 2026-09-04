import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ---- Types ----

export interface Vendedor {
  id: string;
  user_id: string | null;
  nombre: string;
  email: string;
  rol: string;
  avatar_url: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendedorDashboard {
  vendedor_id: string;
  nombre: string;
  email: string;
  rol: string;
  avatar_url: string | null;
  telefono: string | null;
  activo: boolean;
  total_asignadas: number;
  postuladas: number;
  adjudicadas: number;
  monto_total: number;
  tasa_exito: number;
  ingresos_generados: number;
}

// ---- Hooks ----

const EQUIPO_KEY = 'equipo';
const ASIGNACIONES_KEY = 'asignaciones-pipeline';

export function useEquipoMembers() {
  return useQuery({
    queryKey: [EQUIPO_KEY, 'members'],
    queryFn: async (): Promise<Vendedor[]> => {
      const { data, error } = await (supabase
        .from as any)('vendedores')
        .select('*')
        .order('nombre');

      if (error) throw error;
      return (data || []) as Vendedor[];
    },
  });
}

export function useEquipoDashboard() {
  return useQuery({
    queryKey: [EQUIPO_KEY, 'dashboard'],
    queryFn: async (): Promise<VendedorDashboard[]> => {
      const { data, error } = await (supabase
        .from as any)('v_equipo_dashboard')
        .select('*')
        .order('ingresos_generados', { ascending: false });

      if (error) throw error;
      return (data || []) as VendedorDashboard[];
    },
  });
}

export function useVendedorDetail(vendedorId: string | undefined) {
  return useQuery({
    queryKey: [EQUIPO_KEY, 'detail', vendedorId],
    queryFn: async (): Promise<VendedorDashboard | null> => {
      if (!vendedorId) return null;
      const { data, error } = await (supabase
        .from as any)('v_equipo_dashboard')
        .select('*')
        .eq('vendedor_id', vendedorId)
        .maybeSingle();

      if (error) throw error;
      return data as VendedorDashboard | null;
    },
    enabled: !!vendedorId,
  });
}

// Antes /equipo y /dashboard/vendedores (GestionVendedores) eran dos
// sistemas de asignación paralelos: este leía de una tabla `asignaciones`
// que nunca existió, y el otro escribe en `vendedor_asignaciones` (real,
// con RLS correcta, pero sin uso). Ahora ambos escriben en
// vendedor_asignaciones — una sola fuente de verdad — usando el
// `oportunidad_id` (texto, el mismo id que usa compras_agiles/pipeline/
// ca_matches) como `licitacion_id`. Como no hay FK entre vendedor_asignaciones
// y pipeline, el cruce con los datos del pipeline (título, etapa, monto...)
// se hace acá en dos consultas en vez de un embed de PostgREST.
export function useVendedorPipelineItems(vendedorId: string | undefined) {
  return useQuery({
    queryKey: [EQUIPO_KEY, 'pipeline-items', vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];
      const { data: asignaciones, error } = await (supabase as any)
        .from('vendedor_asignaciones')
        .select('id, licitacion_id, fecha_asignacion, notas')
        .eq('vendedor_id', vendedorId)
        .order('fecha_asignacion', { ascending: false });

      if (error) throw error;
      if (!asignaciones?.length) return [];

      const oportunidadIds = asignaciones.map((a: any) => a.licitacion_id);
      const { data: pipelineRows, error: pipelineError } = await (supabase as any)
        .from('pipeline')
        .select('id, oportunidad_id, titulo, institucion, monto_estimado, fecha_cierre, etapa, match_score, oportunidad_tipo, created_at, updated_at')
        .in('oportunidad_id', oportunidadIds);

      if (pipelineError) throw pipelineError;
      const pipelineByOportunidad = new Map((pipelineRows || []).map((p: any) => [p.oportunidad_id, p]));

      return asignaciones.map((a: any) => ({
        ...a,
        pipeline: pipelineByOportunidad.get(a.licitacion_id) || null,
      }));
    },
    enabled: !!vendedorId,
  });
}

export function usePipelineAsignaciones() {
  return useQuery({
    queryKey: [ASIGNACIONES_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vendedor_asignaciones')
        .select(`
          id,
          vendedor_id,
          licitacion_id,
          fecha_asignacion,
          vendedores:vendedor_id (
            id,
            nombre,
            email,
            avatar_url
          )
        `);

      if (error) throw error;
      return data || [];
    },
  });
}

export function useAsignarPipeline() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      pipelineId,
      oportunidadId,
      vendedorId,
      montoEstimado,
      fechaCierre,
      notas,
    }: {
      pipelineId: string;
      oportunidadId: string;
      vendedorId: string;
      montoEstimado?: number;
      fechaCierre?: string;
      notas?: string;
    }) => {
      if (!user?.id) throw new Error('No autenticado');

      // Upsert: si ya existe una asignación para esta oportunidad, se actualiza.
      const { data: existing } = await (supabase as any)
        .from('vendedor_asignaciones')
        .select('id')
        .eq('licitacion_id', oportunidadId)
        .maybeSingle();

      let data;
      if (existing) {
        const res = await (supabase as any)
          .from('vendedor_asignaciones')
          .update({
            vendedor_id: vendedorId,
            asignado_por: user.id,
            notas,
          })
          .eq('id', existing.id)
          .select()
          .single();
        if (res.error) throw res.error;
        data = res.data;
      } else {
        const res = await (supabase as any)
          .from('vendedor_asignaciones')
          .insert({
            licitacion_id: oportunidadId,
            licitacion_codigo: oportunidadId,
            vendedor_id: vendedorId,
            asignado_por: user.id,
            monto_estimado: montoEstimado,
            fecha_cierre: fechaCierre,
            estado: 'asignada',
            notas,
          })
          .select()
          .single();
        if (res.error) throw res.error;
        data = res.data;
      }

      // Refleja la asignación en la tarjeta del pipeline también.
      await supabase
        .from('pipeline')
        .update({ asignado_a: vendedorId })
        .eq('id', pipelineId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ASIGNACIONES_KEY] });
      queryClient.invalidateQueries({ queryKey: [EQUIPO_KEY] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast.success('Vendedor asignado exitosamente');
    },
    onError: (error) => {
      toast.error('Error al asignar: ' + error.message);
    },
  });
}

export interface InvitacionResultado {
  ok: boolean;
  email: string;
  activation_url: string;
  email_enviado: boolean;
  email_error?: string | null;
}

export function useInvitarMiembro() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      nombre,
      email,
      rol,
      telefono,
    }: {
      nombre: string;
      email: string;
      rol: string;
      telefono?: string;
    }): Promise<InvitacionResultado> => {
      // La edge function crea el miembro (pendiente + token), envía el email de
      // activación y devuelve el enlace para compartir. Pasamos el origin actual
      // para construir el enlace correcto (localhost/preview/producción).
      const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await supabase.functions.invoke('invitar-miembro', {
        body: { nombre, email, rol, telefono, app_url: appUrl },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as InvitacionResultado;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: [EQUIPO_KEY] });
      if (res.email_enviado) {
        toast.success('Invitación enviada por email');
      } else {
        toast.warning('Miembro creado. No se pudo enviar el email — comparte el enlace manualmente.');
      }
    },
    onError: (error: Error) => {
      toast.error('Error al invitar: ' + error.message);
    },
  });
}

export function useUpdateVendedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Vendedor> & { id: string }) => {
      const { data, error } = await (supabase
        .from as any)('vendedores')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EQUIPO_KEY] });
      toast.success('Vendedor actualizado');
    },
    onError: (error) => {
      toast.error('Error al actualizar: ' + error.message);
    },
  });
}

export function useToggleVendedorActivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { data, error } = await (supabase
        .from as any)('vendedores')
        .update({ activo, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { activo }) => {
      queryClient.invalidateQueries({ queryKey: [EQUIPO_KEY] });
      toast.success(activo ? 'Vendedor activado' : 'Vendedor desactivado');
    },
    onError: (error) => {
      toast.error('Error: ' + error.message);
    },
  });
}
