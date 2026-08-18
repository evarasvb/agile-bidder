import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ---- Types ----

export interface Vendedor {
  id: string;
  user_id: string | null;
  empresa_id: string | null;
  nombre: string;
  email: string;
  rol: string;
  avatar_url: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Asignacion {
  id: string;
  vendedor_id: string;
  pipeline_id: string;
  asignado_por: string | null;
  fecha_asignacion: string;
  notas: string | null;
  created_at: string;
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

export function useVendedorPipelineItems(vendedorId: string | undefined) {
  return useQuery({
    queryKey: [EQUIPO_KEY, 'pipeline-items', vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];
      const { data, error } = await (supabase
        .from as any)('asignaciones')
        .select(`
          id,
          pipeline_id,
          fecha_asignacion,
          notas,
          pipeline:pipeline_id (
            id,
            titulo,
            institucion,
            monto_estimado,
            fecha_cierre,
            etapa,
            match_score,
            oportunidad_tipo,
            created_at,
            updated_at
          )
        `)
        .eq('vendedor_id', vendedorId)
        .order('fecha_asignacion', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!vendedorId,
  });
}

export function usePipelineAsignaciones() {
  return useQuery({
    queryKey: [ASIGNACIONES_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from as any)('asignaciones')
        .select(`
          id,
          vendedor_id,
          pipeline_id,
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
      vendedorId,
      notas,
    }: {
      pipelineId: string;
      vendedorId: string;
      notas?: string;
    }) => {
      if (!user?.id) throw new Error('No autenticado');

      // Upsert: if assignment exists for this pipeline, update it
      const { data: existing } = await (supabase
        .from as any)('asignaciones')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await (supabase
          .from as any)('asignaciones')
          .update({
            vendedor_id: vendedorId,
            asignado_por: user.id,
            notas,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      const { data, error } = await (supabase
        .from as any)('asignaciones')
        .insert({
          pipeline_id: pipelineId,
          vendedor_id: vendedorId,
          asignado_por: user.id,
          notas,
        })
        .select()
        .single();

      if (error) throw error;

      // Also update the pipeline item's asignado_a field
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
