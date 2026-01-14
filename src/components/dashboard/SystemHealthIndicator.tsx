import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface SystemLog {
  id: string;
  created_at: string;
  severidad: string;
  tipo: string;
  mensaje: string;
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemLog | null> => {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[SystemHealth] Error fetching:', error);
        throw error;
      }
      
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  });
}

export function SystemHealthIndicator() {
  const { data: lastLog, isLoading, error } = useSystemHealth();
  
  // Check if system is healthy
  const isHealthy = lastLog && 
    lastLog.severidad !== 'error' && 
    new Date(lastLog.created_at) > new Date(Date.now() - 2 * 60 * 60 * 1000); // Within last 2 hours
  
  // If no logs exist at all, treat as idle (not unhealthy)
  const isIdle = !lastLog && !error;
  
  const getStatusInfo = () => {
    if (isLoading) {
      return {
        label: "Verificando...",
        color: "bg-muted-foreground",
        textColor: "text-muted-foreground",
        animate: true,
      };
    }
    
    if (error) {
      return {
        label: "Error de conexión",
        color: "bg-firmavb-red",
        textColor: "text-firmavb-red",
        animate: true,
      };
    }
    
    if (isIdle) {
      return {
        label: "Sistema Inactivo",
        color: "bg-warning",
        textColor: "text-warning",
        animate: true,
      };
    }
    
    if (isHealthy) {
      return {
        label: "Sistema Online",
        color: "bg-success",
        textColor: "text-success",
        animate: false,
      };
    }
    
    return {
      label: "Sistema Inactivo",
      color: "bg-firmavb-red",
      textColor: "text-firmavb-red",
      animate: true,
    };
  };
  
  const status = getStatusInfo();
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors">
          <div className={cn(
            "h-2.5 w-2.5 rounded-full transition-colors",
            status.color,
            status.animate && "animate-pulse"
          )} />
          <span className={cn("text-xs font-medium", status.textColor)}>
            {status.label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5 text-xs">
          <p className="font-medium">Estado del Sistema</p>
          {lastLog ? (
            <>
              <p>
                <span className="text-muted-foreground">Último evento:</span>{" "}
                {formatDistanceToNow(new Date(lastLog.created_at), { addSuffix: true, locale: es })}
              </p>
              <p>
                <span className="text-muted-foreground">Tipo:</span>{" "}
                {lastLog.tipo}
              </p>
              <p>
                <span className="text-muted-foreground">Mensaje:</span>{" "}
                {lastLog.mensaje.slice(0, 50)}...
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Sin registros de actividad</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
