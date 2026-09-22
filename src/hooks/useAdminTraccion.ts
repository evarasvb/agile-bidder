import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TraccionResumen {
  clientes_total: number;
  clientes_7d: number;
  clientes_30d: number;
  activados: number;
  con_oferta: number;
  plan_pro: number;
  conectados_7d: number;
}

export interface ClienteNuevo {
  id: string;
  empresa_nombre: string | null;
  email: string | null;
  created_at: string;
  plan: string | null;
  industrias: string[] | null;
  palabras_clave_busqueda: string[] | null;
  items_inventario: number;
  ofertas: number;
  last_sign_in_at: string | null;
}

// Actividad + gestión comercial (clientes_gestion vía admin_clientes_actividad).
export interface ClienteActividad extends ClienteNuevo {
  estado_gestion: string;
  prioridad: number;
  notas: string | null;
  proxima_accion: string | null;
  proxima_fecha: string | null;
  etiquetas: string[] | null;
}

export interface CampanasResumen {
  webinar: Record<string, number>;
  webinar_por_campana: { campana: string; total: number; enviados: number; pendientes: number; bajas: number }[];
  prospects: Record<string, number>;
  prospects_total: number;
}

export function useTraccionResumen() {
  return useQuery({
    queryKey: ['admin_traccion_resumen'],
    queryFn: async () => (await supabase.rpc('admin_traccion_resumen')).data as unknown as TraccionResumen | null,
  });
}

export function useClientesNuevos(dias = 30) {
  return useQuery({
    queryKey: ['admin_clientes_nuevos', dias],
    queryFn: async () => ((await supabase.rpc('admin_clientes_nuevos', { dias, lim: 200 })).data ?? []) as ClienteNuevo[],
  });
}

export function useCampanasResumen() {
  return useQuery({
    queryKey: ['admin_campanas_resumen'],
    queryFn: async () => (await supabase.rpc('admin_campanas_resumen')).data as unknown as CampanasResumen | null,
  });
}

// Actividad de TODOS los clientes (no solo los nuevos): última conexión,
// inventario y ofertas, para saber quién usa el sistema y quién no.
export function useClientesActividad() {
  return useQuery({
    // Sin tope práctico: la RPC ordena por última conexión ascendente y, si se
    // truncara con un límite bajo, un negocio con más clientes que ese límite
    // perdería justo a los que sí se conectaron hace poco (quedarían fuera del
    // corte). 20000 es "todos" para cualquier escala realista de este negocio.
    queryKey: ['admin_clientes_actividad'],
    queryFn: async () => ((await supabase.rpc('admin_clientes_actividad', { lim: 20000 })).data ?? []) as ClienteActividad[],
  });
}

export interface GuardarGestionInput {
  cliente_id: string;
  estado: string;
  prioridad: number;
  notas: string | null;
  proxima_accion: string | null;
  proxima_fecha: string | null;
  etiquetas: string[] | null;
}

// Guarda el pipeline comercial de un cliente (estado, prioridad, notas,
// próxima acción/fecha, etiquetas) desde la tabla de Actividad de Tracción.
export function useGuardarClienteGestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardarGestionInput) => {
      const { error } = await supabase.rpc('admin_cliente_gestion_guardar', {
        p_cliente_id: input.cliente_id,
        p_estado: input.estado,
        p_prioridad: input.prioridad,
        p_notas: input.notas,
        p_proxima_accion: input.proxima_accion,
        p_proxima_fecha: input.proxima_fecha,
        p_etiquetas: input.etiquetas,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_clientes_actividad'] });
    },
  });
}
