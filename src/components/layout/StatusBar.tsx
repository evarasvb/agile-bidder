import { Link } from "react-router-dom";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InfoHint } from "@/components/ui/info-hint";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";
import { SystemHealthIndicator } from "@/components/dashboard/SystemHealthIndicator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// Barra superior: SOLO estados reales. Antes mostraba "Sesión MP: Activa"
// (hardcodeado, mentía si expiraba) y un toggle "Auto-Bid ON/OFF" que no hacía
// nada (estado local sin persistencia, y la sección Auto-Bids ya no existe).
// Prometer control falso rompe la confianza: se eliminaron ambos.
export function StatusBar() {
  const { isConnected, lastActivity, lastAction, isLoading, refetch, activeKeysCount } = useExtensionStatus();
  const { user } = useAuth();
  const esAdmin = (user?.email || "").toLowerCase() === "evaras@firmavb.cl";
  const sinInstalar = !isLoading && !isConnected && (activeKeysCount ?? 0) === 0;

  const formatLastActivity = () => {
    if (!lastActivity) return "Sin actividad";
    return formatDistanceToNow(lastActivity, { addSuffix: true, locale: es });
  };

  return (
    <header className="lg:sticky lg:top-0 z-20 h-12 lg:h-16 border-b border-border bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        {/* Left: Page Title Area */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <h2 className="text-sm sm:text-lg font-semibold text-foreground truncate flex items-center gap-1.5">
            Centro de Control
            <InfoHint text="Estado en vivo de tu conexión con Mercado Público: si la extensión de Chrome de firmavb está conectada para ayudarte a postular." />
          </h2>
          {esAdmin && <SystemHealthIndicator />}
        </div>

        {/* Right: estado de la extensión (también visible en móvil, como punto) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/configuracion/extension"
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className={cn(
                "h-2 w-2 rounded-full transition-colors",
                isLoading ? "bg-muted-foreground animate-pulse" :
                isConnected ? "bg-online animate-pulse-soft" : "bg-offline"
              )} />
              <span className="hidden sm:inline text-xs text-muted-foreground">Extensión:</span>
              {isConnected ? (
                <Wifi className="h-4 w-4 text-online" />
              ) : (
                <WifiOff className="h-4 w-4 text-offline" />
              )}
              <span className={cn(
                "hidden sm:inline text-sm font-medium",
                isConnected ? "text-online" : "text-offline"
              )}>
                {isLoading ? "Verificando..." : isConnected ? "Conectada" : sinInstalar ? "No instalada" : "Desconectada"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex h-6 w-6"
                onClick={(e) => { e.preventDefault(); refetch(); }}
              >
                <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p><strong>Última actividad:</strong> {formatLastActivity()}</p>
              {lastAction && <p><strong>Acción:</strong> {lastAction.replace(/-/g, ' ')}</p>}
              <p className="text-muted-foreground">Toca para ver cómo conectarla</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* La franja naranja se retiró: el indicador "Extensión: Desconectada" de arriba ya avisa y enlaza a la guía. */}
    </header>
  );
}
