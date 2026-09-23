import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Avisos persistentes del cliente (campanita). Leen notificaciones_log, que la RLS
// ya limita a las filas del propio usuario. La columna `leida` se agregó en la
// migración 20260923080000 y aún no está en los tipos generados.
const sb = supabase as unknown as { from: (t: string) => any };

export interface Aviso {
  id: string;
  tipo: string;
  licitacion_id: string | null;
  datos: Record<string, any> | null;
  leida: boolean;
  created_at: string;
}

export function useAvisos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['avisos', user?.id],
    enabled: !!user?.id,
    refetchInterval: 60000,
    queryFn: async (): Promise<Aviso[]> => {
      const { data, error } = await sb
        .from('notificaciones_log')
        .select('id, tipo, licitacion_id, datos, leida, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Aviso[];
    },
  });
}

export function useMarcarAvisosLeidos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await sb
        .from('notificaciones_log')
        .update({ leida: true })
        .eq('leida', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  });
}

export function useMarcarAvisoLeido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb
        .from('notificaciones_log')
        .update({ leida: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  });
}
