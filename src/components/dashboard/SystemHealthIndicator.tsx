import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// Sep 2026: antes el estado salía de `system_logs`, tabla que dejó de escribirse
// el 4-sep. Resultado: TODOS los clientes veían "Sistema Inactivo" en rojo aunque
// la ingesta funcionaba cada pocos minutos. Ahora se mide lo que le importa al
// cliente: cuándo entró la última compra ágil desde Mercado Público.
export function useSystemHealth() {
  return useQuery({
    queryKey: ["system-health"],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("compras_agiles")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { created_at: string } | null)?.created_at ?? null;
    },
    refetchInterval: 5 * 60_000,
    staleTime: 2 * 60_000,
  });
}

const HORA = 60 * 60 * 1000;

export function SystemHealthIndicator() {
  const { data: ultima, isLoading, error } = useSystemHealth();
  const edad = ultima ? Date.now() - new Date(ultima).getTime() : null;

  // Verde: datos al día (< 3 h; la API de Mercado Público se degrada en horario
  // de oficina). Ámbar: atrasado. Rojo solo si no se pudo consultar.
  const status = isLoading
    ? { label: "Verificando…", color: "bg-muted-foreground", text: "text-muted-foreground", pulse: true }
    : error
      ? { label: "Sin conexión", color: "bg-firmavb-red", text: "text-firmavb-red", pulse: true }
      : edad !== null && edad < 3 * HORA
        ? { label: "Datos al día", color: "bg-success", text: "text-success", pulse: false }
        : { label: "Actualizando datos", color: "bg-warning", text: "text-warning", pulse: true };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 cursor-help px-3 py-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors">
          <div className={cn("h-2.5 w-2.5 rounded-full transition-colors", status.color, status.pulse && "animate-pulse")} />
          <span className={cn("text-xs font-medium", status.text)}>{status.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5 text-xs">
          <p className="font-medium">Conexión con Mercado Público</p>
          {ultima ? (
            <p>
              <span className="text-muted-foreground">Última compra ágil recibida:</span>{" "}
              {formatDistanceToNow(new Date(ultima), { addSuffix: true, locale: es })}
            </p>
          ) : (
            <p className="text-muted-foreground">Aún sin datos</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
