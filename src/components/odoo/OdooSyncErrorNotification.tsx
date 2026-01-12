import { useState } from 'react';
import { AlertCircle, Bell, X, RefreshCw, ChevronDown, ChevronUp, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useOdooSyncErrors } from '@/hooks/useOdooNotifications';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OdooSyncErrorNotificationProps {
  onRetry?: (ofertaId: string, licitacionId: string) => void;
}

export function OdooSyncErrorNotification({ onRetry }: OdooSyncErrorNotificationProps) {
  const { undismissedErrors, undismissedCount, dismissError, dismissAll, clearAll, retrySync } = useOdooSyncErrors();
  const [isOpen, setIsOpen] = useState(false);

  const handleRetry = (errorId: string) => {
    const error = retrySync(errorId);
    if (error && onRetry) {
      onRetry(error.oferta_id, error.licitacion_id);
    }
  };

  if (undismissedCount === 0) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${undismissedCount} errores de sincronización Odoo`}
        >
          <Bell className="h-5 w-5" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {undismissedCount > 9 ? '9+' : undismissedCount}
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0 bg-background border shadow-lg z-[100]">
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="font-medium">Errores de Sincronización Odoo</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                dismissAll();
              }}
              className="text-xs h-7"
            >
              Marcar leídos
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                clearAll();
              }}
              className="h-7 w-7"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <ScrollArea className="max-h-80">
          {undismissedErrors.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No hay errores pendientes
            </div>
          ) : (
            <div className="divide-y">
              {undismissedErrors.map((error) => (
                <div key={error.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {error.licitacion_titulo}
                      </p>
                      <p className="text-xs text-destructive mt-1">
                        {error.error_message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(error.created_at), "d 'de' MMMM, HH:mm", { locale: es })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          handleRetry(error.id);
                        }}
                        className="h-7 w-7"
                        title="Reintentar sincronización"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          dismissError(error.id);
                        }}
                        className="h-7 w-7"
                        title="Descartar"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setIsOpen(false);
              window.location.href = '/odoo/dashboard';
            }}
          >
            Ver dashboard de Odoo
            <ExternalLink className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
