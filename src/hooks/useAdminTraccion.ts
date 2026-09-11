import { useQuery } from '@tanstack/react-query';
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

export interface CampanasResumen {
  webinar: Record<string, number>;
  webinar_por_campana: { campana: string; total: number; enviados: number; pendientes: number; bajas: number }[];
  prospects: Record<string, number>;
  prospects_total: number;
}

export function useTraccionResumen() {
  return useQuery({
    queryKey: ['admin_traccion_resumen'],
    queryFn: async () => (await (supabase.rpc as any)('admin_traccion_resumen')).data as TraccionResumen | null,
  });
}

export function useClientesNuevos(dias = 30) {
  return useQuery({
    queryKey: ['admin_clientes_nuevos', dias],
    queryFn: async () => ((await (supabase.rpc as any)('admin_clientes_nuevos', { dias, lim: 200 })).data ?? []) as ClienteNuevo[],
  });
}

export function useCampanasResumen() {
  return useQuery({
    queryKey: ['admin_campanas_resumen'],
    queryFn: async () => (await (supabase.rpc as any)('admin_campanas_resumen')).data as CampanasResumen | null,
  });
}
