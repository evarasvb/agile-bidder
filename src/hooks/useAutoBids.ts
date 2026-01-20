import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface AutoBidDashboard {
  id: string;
  user_id: string;
  activo: boolean;
  total_bids_enviados: number;
  total_bids_ganados: number;
  monto_total_ganado: number;
  tasa_exito: number;
  ultimo_bid_fecha?: string;
  configuracion: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AutoBidItem {
  id: string;
  dashboard_id?: string;
  user_id: string;
  producto_id?: string;
  nombre_producto: string;
  precio_minimo?: number;
  precio_maximo?: number;
  margen_objetivo: number;
  activo: boolean;
  total_bids: number;
  bids_ganados: number;
  created_at: string;
  updated_at: string;
}

// Hook: Obtener dashboard de auto-bids del usuario
export function useAutoBidDashboard() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['auto-bid-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await (supabase as any)
        .from('auto_bids_dashboard')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data as AutoBidDashboard | null;
    },
    enabled: !!user?.id,
  });
}

// Hook: Crear o actualizar dashboard
export function useUpsertAutoBidDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (dashboard: Partial<AutoBidDashboard>) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const { data, error } = await (supabase as any)
        .from('auto_bids_dashboard')
        .upsert({ ...dashboard, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as AutoBidDashboard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-bid-dashboard'] });
    },
  });
}

// Hook: Activar/Desactivar auto-bid
export function useToggleAutoBid() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (activo: boolean) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const { data, error } = await (supabase as any)
        .from('auto_bids_dashboard')
        .upsert({ user_id: user.id, activo })
        .select()
        .single();
      
      if (error) throw error;
      return data as AutoBidDashboard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-bid-dashboard'] });
    },
  });
}

// Hook: Listar items de auto-bid
export function useAutoBidItems() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['auto-bid-items', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await (supabase as any)
        .from('auto_bid_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AutoBidItem[];
    },
    enabled: !!user?.id,
  });
}

// Hook: Crear item de auto-bid
export function useCreateAutoBidItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (item: Partial<AutoBidItem>) => {
      if (!user?.id) throw new Error('Usuario no autenticado');
      
      const { data, error } = await (supabase as any)
        .from('auto_bid_items')
        .insert({ ...item, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data as AutoBidItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-bid-items'] });
    },
  });
}

// Hook: Actualizar item de auto-bid
export function useUpdateAutoBidItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutoBidItem> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('auto_bid_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as AutoBidItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-bid-items'] });
    },
  });
}

// Hook: Eliminar item de auto-bid
export function useDeleteAutoBidItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('auto_bid_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-bid-items'] });
    },
  });
}

// Hook: Estadísticas de auto-bid
export function useAutoBidStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['auto-bid-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: dashboard } = await (supabase as any)
        .from('auto_bids_dashboard')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const { data: items } = await (supabase as any)
        .from('auto_bid_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('activo', true);

      return {
        dashboard: dashboard as AutoBidDashboard | null,
        itemsActivos: items?.length || 0,
        totalBids: dashboard?.total_bids_enviados || 0,
        ganados: dashboard?.total_bids_ganados || 0,
        tasaExito: dashboard?.tasa_exito || 0,
        montoGanado: dashboard?.monto_total_ganado || 0,
      };
    },
    enabled: !!user?.id,
  });
}
