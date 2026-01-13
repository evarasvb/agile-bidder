import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Sound for notifications
const NOTIFICATION_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

interface RealtimeNotification {
  id: string;
  tipo: 'nuevo_match' | 'cierre_proximo' | 'nueva_licitacion';
  titulo: string;
  mensaje: string;
  licitacion_id?: string;
  score?: number;
  timestamp: Date;
  leida: boolean;
}

interface UseRealtimeNotificationsOptions {
  clienteId?: string | null;
  soundEnabled?: boolean;
  onNewNotification?: (notification: RealtimeNotification) => void;
}

export function useRealtimeNotifications({
  clienteId,
  soundEnabled = true,
  onNewNotification
}: UseRealtimeNotificationsOptions = {}) {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isEnabled, setIsEnabled] = useState(true);

  // Initialize audio
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      audioRef.current.volume = 0.5;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current && isEnabled) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, [soundEnabled, isEnabled]);

  // Add notification
  const addNotification = useCallback((notification: Omit<RealtimeNotification, 'id' | 'timestamp' | 'leida'>) => {
    const newNotification: RealtimeNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      leida: false
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
    playSound();
    
    // Show toast notification
    const icon = notification.tipo === 'nuevo_match' ? '🎯' : 
                 notification.tipo === 'cierre_proximo' ? '⏰' : '📋';
    
    toast(notification.titulo, {
      description: notification.mensaje,
      icon,
      duration: 8000,
      action: notification.licitacion_id ? {
        label: 'Ver',
        onClick: () => {
          // Navigate to licitacion detail
          window.location.href = `/licitaciones?id=${notification.licitacion_id}`;
        }
      } : undefined
    });

    onNewNotification?.(newNotification);
  }, [playSound, onNewNotification]);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, leida: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
    setUnreadCount(0);
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Subscribe to realtime changes on licitaciones table
  useEffect(() => {
    if (!isEnabled) return;

    const channel = supabase
      .channel('licitaciones-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'licitaciones'
        },
        (payload) => {
          const licitacion = payload.new as any;
          addNotification({
            tipo: 'nueva_licitacion',
            titulo: '📋 Nueva Licitación',
            mensaje: `${licitacion.titulo?.substring(0, 80)}...`,
            licitacion_id: licitacion.id_licitacion
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'licitaciones'
        },
        (payload) => {
          const licitacion = payload.new as any;
          const oldLicitacion = payload.old as any;
          
          // Check if match_encontrado changed from false to true
          if (!oldLicitacion.match_encontrado && licitacion.match_encontrado && licitacion.match_score >= 50) {
            addNotification({
              tipo: 'nuevo_match',
              titulo: '🎯 ¡Nuevo Match Encontrado!',
              mensaje: `${licitacion.titulo?.substring(0, 60)}... - Score: ${licitacion.match_score}%`,
              licitacion_id: licitacion.id_licitacion,
              score: licitacion.match_score
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isEnabled, addNotification]);

  // Check for upcoming closures periodically
  useEffect(() => {
    if (!isEnabled) return;

    const checkUpcomingClosures = async () => {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const { data: urgentLicitaciones } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo, fecha_cierre, match_score')
        .eq('match_encontrado', true)
        .gte('fecha_cierre', now.toISOString())
        .lte('fecha_cierre', in24Hours.toISOString())
        .order('fecha_cierre', { ascending: true })
        .limit(5);

      if (urgentLicitaciones && urgentLicitaciones.length > 0) {
        // Check localStorage to avoid duplicate notifications
        const notifiedKey = 'notified_closures';
        const notified = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
        
        for (const lic of urgentLicitaciones) {
          if (!notified.includes(lic.id_licitacion)) {
            const hoursLeft = Math.ceil(
              (new Date(lic.fecha_cierre!).getTime() - now.getTime()) / (1000 * 60 * 60)
            );
            
            addNotification({
              tipo: 'cierre_proximo',
              titulo: '⏰ ¡Cierre Próximo!',
              mensaje: `"${lic.titulo?.substring(0, 50)}..." cierra en ${hoursLeft}h`,
              licitacion_id: lic.id_licitacion,
              score: lic.match_score || undefined
            });
            
            notified.push(lic.id_licitacion);
          }
        }
        
        localStorage.setItem(notifiedKey, JSON.stringify(notified.slice(-100)));
      }
    };

    // Check immediately and then every 30 minutes
    checkUpcomingClosures();
    const interval = setInterval(checkUpcomingClosures, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isEnabled, addNotification]);

  return {
    notifications,
    unreadCount,
    isEnabled,
    setIsEnabled,
    markAsRead,
    markAllAsRead,
    clearAll,
    addNotification // For manual notifications
  };
}

// Hook for requesting browser notification permissions
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Tu navegador no soporta notificaciones');
      return false;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    
    if (result === 'granted') {
      toast.success('¡Notificaciones activadas!');
      return true;
    } else {
      toast.error('Permiso de notificaciones denegado');
      return false;
    }
  }, []);

  const sendBrowserNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      });
    }
  }, [permission]);

  return {
    permission,
    requestPermission,
    sendBrowserNotification
  };
}
