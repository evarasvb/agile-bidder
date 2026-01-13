import { useState } from 'react';
import { Bell, BellOff, Check, CheckCheck, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useRealtimeNotifications, useBrowserNotifications } from '@/hooks/useRealtimeNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface NotificationBellProps {
  clienteId?: string | null;
  className?: string;
}

export function NotificationBell({ clienteId, className }: NotificationBellProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    notifications,
    unreadCount,
    isEnabled,
    setIsEnabled,
    markAsRead,
    markAllAsRead,
    clearAll
  } = useRealtimeNotifications({
    clienteId,
    soundEnabled
  });

  const { permission, requestPermission } = useBrowserNotifications();

  const getNotificationIcon = (tipo: string) => {
    switch (tipo) {
      case 'nuevo_match': return '🎯';
      case 'cierre_proximo': return '⏰';
      case 'nueva_licitacion': return '📋';
      default: return '🔔';
    }
  };

  const getNotificationColor = (tipo: string) => {
    switch (tipo) {
      case 'nuevo_match': return 'bg-green-500/10 border-green-500/20';
      case 'cierre_proximo': return 'bg-amber-500/10 border-amber-500/20';
      case 'nueva_licitacion': return 'bg-blue-500/10 border-blue-500/20';
      default: return 'bg-muted';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("relative", className)}
        >
          {isEnabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
          {unreadCount > 0 && isEnabled && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">Notificaciones</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} nuevas</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Silenciar' : 'Activar sonido'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={markAllAsRead}
                title="Marcar todas como leídas"
              >
                <CheckCheck className="h-4 w-4" />
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearAll}
                title="Limpiar todas"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Settings */}
        <div className="p-3 bg-muted/50 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Notificaciones en tiempo real</span>
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {/* Browser notification permission */}
        {permission !== 'granted' && (
          <div className="p-3 bg-blue-500/10 border-y border-blue-500/20">
            <p className="text-xs text-muted-foreground mb-2">
              Activa las notificaciones del navegador para no perderte nada
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={requestPermission}
              className="w-full"
            >
              <Bell className="h-3 w-3 mr-2" />
              Activar notificaciones
            </Button>
          </div>
        )}

        <Separator />

        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No hay notificaciones</p>
              <p className="text-xs mt-1">
                Te avisaremos cuando haya nuevas oportunidades
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    !notification.leida && "bg-primary/5"
                  )}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.licitacion_id) {
                      window.location.href = `/licitaciones?id=${notification.licitacion_id}`;
                    }
                  }}
                >
                  <div className="flex gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-lg border shrink-0",
                      getNotificationColor(notification.tipo)
                    )}>
                      {getNotificationIcon(notification.tipo)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm line-clamp-1",
                          !notification.leida && "font-medium"
                        )}>
                          {notification.titulo}
                        </p>
                        {!notification.leida && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.mensaje}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(notification.timestamp, {
                            addSuffix: true,
                            locale: es
                          })}
                        </span>
                        {notification.score && (
                          <Badge variant="secondary" className="text-xs h-4">
                            {notification.score}% match
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
