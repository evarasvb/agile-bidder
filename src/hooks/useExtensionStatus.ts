import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';

// Time threshold to consider extension as "connected" (5 minutes)
const CONNECTION_THRESHOLD_MS = 5 * 60 * 1000;

interface ExtensionStatus {
  isConnected: boolean;
  lastActivity: Date | null;
  activeKeysCount: number;
  lastAction: string | null;
}

export function useExtensionStatus() {
  const { data: cliente } = useCliente();
  const queryClient = useQueryClient();
  const [realtimeStatus, setRealtimeStatus] = useState<{
    lastActivity: Date | null;
    lastAction: string | null;
  }>({ lastActivity: null, lastAction: null });

  // Fetch initial status from database
  const { data: dbStatus, isLoading } = useQuery({
    queryKey: ['extension-status', cliente?.id],
    placeholderData: (prev) => prev, // no parpadear a "Verificando" en cada recarga
    queryFn: async () => {
      if (!cliente?.id) return null;

      // Get the most recent activity
      const { data: recentActivity, error: activityError } = await supabase
        .from('extension_activity_log')
        .select('created_at, action')
        .eq('cliente_id', cliente.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activityError) throw activityError;

      // Get count of active API keys
      const { count: activeKeysCount, error: keysError } = await supabase
        .from('extension_api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', cliente.id)
        .eq('activa', true);

      if (keysError) throw keysError;

      return {
        lastActivity: recentActivity?.created_at 
          ? new Date(recentActivity.created_at) 
          : null,
        lastAction: recentActivity?.action || null,
        activeKeysCount: activeKeysCount || 0,
      };
    },
    enabled: !!cliente?.id,
    refetchInterval: 60000, // Refetch every minute as fallback
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!cliente?.id) return;

    const channel = supabase
      .channel('extension-activity-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'extension_activity_log',
          filter: `cliente_id=eq.${cliente.id}`,
        },
        (payload) => {
          const newActivity = payload.new as { created_at: string; action: string };
          setRealtimeStatus({
            lastActivity: new Date(newActivity.created_at),
            lastAction: newActivity.action,
          });
          // Also invalidate the query to ensure consistency
          queryClient.invalidateQueries({ queryKey: ['extension-status', cliente.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cliente?.id, queryClient]);

  // Calculate connection status
  const calculateConnectionStatus = useCallback((): ExtensionStatus => {
    const now = new Date();
    
    // Use realtime status if available and more recent, otherwise use DB status
    const lastActivity = realtimeStatus.lastActivity || dbStatus?.lastActivity || null;
    const lastAction = realtimeStatus.lastAction || dbStatus?.lastAction || null;
    const activeKeysCount = dbStatus?.activeKeysCount || 0;

    const isConnected = lastActivity 
      ? (now.getTime() - lastActivity.getTime()) < CONNECTION_THRESHOLD_MS
      : false;

    return {
      isConnected,
      lastActivity,
      activeKeysCount,
      lastAction,
    };
  }, [dbStatus, realtimeStatus]);

  // Recalculate status every 30 seconds to update connection state
  const [status, setStatus] = useState<ExtensionStatus>(calculateConnectionStatus);
  
  useEffect(() => {
    setStatus(calculateConnectionStatus());
    
    const interval = setInterval(() => {
      setStatus(calculateConnectionStatus());
    }, 30000);

    return () => clearInterval(interval);
  }, [calculateConnectionStatus]);

  return {
    ...status,
    isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['extension-status', cliente?.id] }),
  };
}
