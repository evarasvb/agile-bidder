import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useClienteOwner } from '@/hooks/useCliente';

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
  const { data: clienteOwner } = useClienteOwner();
  const clienteId = clienteOwner?.id;
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['avisos', user?.id],
    enabled: !!user?.id,
    // Realtime (más abajo) es la vía principal para enterarse de avisos
    // nuevos; este intervalo queda solo de respaldo por si el socket se cae
    // (antes era la única vía, cada 60s).
    refetchInterval: 5 * 60_000,
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

  // Campanita en vivo: se suscribe a los cambios de notificaciones_log del
  // propio cliente (INSERT = aviso nuevo, UPDATE = otra pestaña/dispositivo
  // marcó leído) y refresca la lista al toque en vez de esperar el poll.
  useEffect(() => {
    if (!clienteId || !user?.id) return;
    const uid = user.id;
    const channel = supabase
      .channel(`notificaciones-log-${clienteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones_log', filter: `cliente_id=eq.${clienteId}` },
        () => qc.invalidateQueries({ queryKey: ['avisos', uid] }),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notificaciones_log', filter: `cliente_id=eq.${clienteId}` },
        () => qc.invalidateQueries({ queryKey: ['avisos', uid] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId, user?.id, qc]);

  return query;
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
