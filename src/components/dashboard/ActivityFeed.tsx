import { useEffect, useState } from "react";
import { Activity, Loader2, Inbox, CheckCircle, XCircle, Info, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SystemLogEntry {
  id: string;
  created_at: string;
  tipo: string;
  severidad: string;
  mensaje: string;
  licitacion_id: string | null;
}

function useActivityFeed() {
  return useQuery({
    queryKey: ['activity-feed'],
    queryFn: async (): Promise<SystemLogEntry[]> => {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) {
        console.error('[ActivityFeed] Error:', error);
        throw error;
      }
      
      return data || [];
    },
    refetchInterval: 30000,
  });
}

export function ActivityFeed() {
  const { data: logs = [], isLoading, error, refetch } = useActivityFeed();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('activity-feed-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs',
        },
        (payload) => {
          console.log('[ActivityFeed] New log received:', payload);
          queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
          queryClient.invalidateQueries({ queryKey: ['system-health'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getIcon = (severidad: string) => {
    switch (severidad.toLowerCase()) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-success shrink-0" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-firmavb-red shrink-0" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-firmavb-blue shrink-0" />;
    }
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), "HH:mm", { locale: es });
  };

  const getComponentName = (tipo: string) => {
    const components: Record<string, string> = {
      'match': 'Matching',
      'scraping': 'Scraper',
      'oferta_generada': 'Ofertas',
      'oferta_enviada': 'Ofertas',
      'sistema': 'Sistema',
    };
    return components[tipo] || tipo;
  };

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="flex flex-col items-center justify-center py-8 text-firmavb-red">
          <XCircle className="h-10 w-10 mb-3 opacity-70" />
          <p className="text-sm font-medium">Error al cargar actividad</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3"
            onClick={() => refetch()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-firmavb-blue" />
          <h3 className="font-semibold text-foreground">Actividad del Sistema</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">En vivo</span>
        </div>
      </div>

      {/* Feed Content */}
      <ScrollArea className="flex-1 max-h-[300px]">
        <div className="p-4 space-y-2">
          {isLoading ? (
            // Skeleton loaders
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm font-medium">Todo tranquilo</p>
              <p className="text-xs">El bot está escaneando licitaciones...</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Forzar Escaneo
              </Button>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors font-mono text-xs"
              >
                <span className="text-muted-foreground w-12 shrink-0">
                  [{formatTime(log.created_at)}]
                </span>
                <span className="text-firmavb-blue w-16 shrink-0 truncate">
                  {getComponentName(log.tipo)}
                </span>
                {getIcon(log.severidad)}
                <span className="text-foreground truncate flex-1">
                  {log.mensaje}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
