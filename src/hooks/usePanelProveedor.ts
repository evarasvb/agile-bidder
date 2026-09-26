import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Panel del proveedor: a partir del RUT del cliente logueado deducimos qué vende
// (órdenes de compra donde es proveedor), sus mejores instituciones compradoras
// y palabras clave sugeridas. La RPC vive en la migración 20260923060000 y aún
// no está en los tipos generados, así que usamos el cliente sin tipar.
const sb = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  from: (t: string) => any;
};

export interface CompradorPanel {
  institucion: string;
  rut_demandante: string;
  n_oc: number;
  monto: number;
  ultima: string | null;
  seguida: boolean;
}
export interface ProductoPanel {
  producto: string;
  veces: number;
  monto: number;
}
export interface PanelProveedor {
  rut?: string;
  sin_rut?: boolean;
  error?: string;
  resumen?: { n_oc: number; monto_total: number; n_compradores: number; ultima: string | null };
  compradores?: CompradorPanel[];
  productos?: ProductoPanel[];
  keywords?: string[];
}

export function usePanelProveedor() {
  return useQuery({
    queryKey: ['panel-proveedor'],
    queryFn: async (): Promise<PanelProveedor> => {
      const { data, error } = await sb.rpc('cliente_panel_proveedor', { p_max_comp: 8, p_max_prod: 12 });
      if (error) throw error;
      return (data ?? {}) as PanelProveedor;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Resuelve la empresa dueña (clientes.id) para guardar el seguimiento con el
// mismo cliente_id que usa la RPC del panel.
async function resolverOwnerId(userId: string): Promise<string | null> {
  const { data: ownerId } = await sb.rpc('cliente_owner_id');
  if (ownerId) return ownerId as string;
  return userId ?? null;
}

export function useSeguirInstitucion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inst: { rut: string; nombre: string }) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverOwnerId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');
      const { error } = await sb
        .from('cliente_instituciones_seguidas')
        .upsert(
          { cliente_id: clienteId, rut_institucion: inst.rut, nombre_institucion: inst.nombre },
          { onConflict: 'cliente_id,rut_institucion' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['panel-proveedor'] });
      toast.success('Institución agregada a tu seguimiento');
    },
    onError: () => toast.error('No se pudo seguir la institución'),
  });
}

export function useDejarInstitucion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (rut: string) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      const clienteId = await resolverOwnerId(user.id);
      if (!clienteId) throw new Error('No se encontró el cliente');
      const { error } = await sb
        .from('cliente_instituciones_seguidas')
        .delete()
        .eq('cliente_id', clienteId)
        .eq('rut_institucion', rut);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['panel-proveedor'] });
      toast.success('Dejaste de seguir la institución');
    },
    onError: () => toast.error('No se pudo actualizar el seguimiento'),
  });
}

export const CLP_PANEL = (v: number) => '$' + Math.round(v || 0).toLocaleString('es-CL');
