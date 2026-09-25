import { useEffect, useRef } from 'react';
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
        .select('id, tipo, licitacion_id, datos, created_at')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      const notifs = data ?? [];
      // "Leída" es POR USUARIO (notificaciones_log_leidas), no por fila: la
      // campanita ahora la ve todo el equipo, y una sola columna compartida
      // en notificaciones_log haría que un miembro marcándola leída se la
      // marcara leída a todos los demás sin que la hayan visto.
      const ids = notifs.map((n: any) => n.id);
      let leidasIds = new Set<string>();
      if (ids.length) {
        const { data: leidas, error: errLeidas } = await sb
          .from('notificaciones_log_leidas')
          .select('notificacion_id')
          .in('notificacion_id', ids);
        if (errLeidas) throw errLeidas;
        leidasIds = new Set((leidas ?? []).map((l: any) => l.notificacion_id));
      }
      return notifs.map((n: any) => ({ ...n, leida: leidasIds.has(n.id) })) as Aviso[];
    },
  });

  // cliente_owner_id() (RPC security definer) en vez de useClienteOwner():
  // ese hook hace además un select a `clientes`, y su RLS solo deja ver la
  // fila propia (user_id = auth.uid()) — un vendedor invitado nunca vería la
  // fila de la empresa dueña y se quedaría sin campanita en vivo. El RPC solo
  // devuelve el uuid, sin pasar por esa restricción.
  const { data: clienteId } = useQuery({
    queryKey: ['cliente-owner-id', user?.id],
    enabled: !!user?.id,
    // Para un usuario recién autenticado, OnboardingGate dispara la creación
    // de su fila en `clientes` en paralelo a este RPC; si este corre primero
    // puede devolver null antes de que esa fila exista todavía. Reintenta
    // cada 15s mientras siga en null (en vez de cachearlo como definitivo).
    // Una vez resuelto sigue revalidando cada 5 min (no se detiene del todo):
    // si el dueño desactiva o saca al vendedor de la empresa mientras sigue
    // logueado, cliente_owner_id() cambia y sin esto la campanita quedaba
    // pegada a la empresa vieja el resto de la sesión (sin refetch por foco
    // de ventana, que está deshabilitado a nivel global).
    refetchInterval: (query) => (query.state.data ? 5 * 60_000 : 15_000),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('cliente_owner_id');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });

  // Campanita en vivo: se suscribe a los cambios de notificaciones_log del
  // propio cliente (INSERT = aviso nuevo, UPDATE = otra pestaña/dispositivo
  // marcó leído) y refresca la lista al toque en vez de esperar el poll.
  // Los eventos se agrupan (debounce corto) porque "Marcar leídas" puede
  // disparar un UPDATE por cada fila no leída — sin esto, una cuenta con
  // historial grande dispararía una ráfaga de refetch por un solo click.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!clienteId || !user?.id) return;
    const uid = user.id;
    const invalidar = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['avisos', uid] });
      }, 400);
    };
    const channel = supabase
      .channel(`notificaciones-log-${clienteId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones_log', filter: `cliente_id=eq.${clienteId}` },
        invalidar,
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notificaciones_log', filter: `cliente_id=eq.${clienteId}` },
        invalidar,
      )
      // "Leída" ahora vive en notificaciones_log_leidas (por usuario): esto
      // sincroniza en vivo cuando el propio usuario marca leído desde otra
      // pestaña/dispositivo.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones_log_leidas', filter: `user_id=eq.${uid}` },
        invalidar,
      )
      // Entre el snapshot inicial del useQuery y que el canal llegue a
      // SUBSCRIBED hay una ventana donde ninguno de los dos captura un
      // aviso nuevo (el query ya corrió, el canal todavía no escucha).
      // Al quedar SUBSCRIBED se fuerza un refetch para cerrar ese hueco.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') invalidar();
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [clienteId, user?.id, qc]);

  return query;
}

export function useMarcarAvisosLeidos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      // "Leída" es por usuario (ver useAvisos): se inserta un recibo propio
      // por cada aviso todavía no leído, en vez de tocar una columna
      // compartida por toda la empresa.
      const avisos = qc.getQueryData<Aviso[]>(['avisos', user.id]) ?? [];
      const noLeidos = avisos.filter((a) => !a.leida).map((a) => a.id);
      if (!noLeidos.length) return;
      const { error } = await sb
        .from('notificaciones_log_leidas')
        .upsert(
          noLeidos.map((id) => ({ notificacion_id: id, user_id: user.id })),
          { onConflict: 'notificacion_id,user_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  });
}

export function useMarcarAvisoLeido() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) return;
      const { error } = await sb
        .from('notificaciones_log_leidas')
        .upsert(
          { notificacion_id: id, user_id: user.id },
          { onConflict: 'notificacion_id,user_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  });
}
