import { useState } from "react";
import { Wifi, WifiOff, Shield, ShieldOff, Power, AlertTriangle, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExtensionStatus } from "@/hooks/useExtensionStatus";
import { SystemHealthIndicator } from "@/components/dashboard/SystemHealthIndicator";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function StatusBar() {
  const [autoBidEnabled, setAutoBidEnabled] = useState(false);
  const { isConnected, lastActivity, lastAction, isLoading, refetch } = useExtensionStatus();
  const sessionActive = true; // Mock state for MP session

  const formatLastActivity = () => {
    if (!lastActivity) return "Sin actividad";
    return formatDistanceToNow(lastActivity, { addSuffix: true, locale: es });
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-white/95 backdrop-blur-sm shadow-sm">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        {/* Left: Page Title Area */}
        <div className="flex items-center gap-4">
          <h2 className="text-base sm:text-lg font-semibold text-foreground">Centro de Control</h2>
          <SystemHealthIndicator />
        </div>

        {/* Right: Status Indicators (ocultos en móvil para no desbordar) */}
        <div className="hidden lg:flex items-center gap-6">
          {/* Extension Status with Realtime */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-help">
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    isLoading ? "bg-muted-foreground animate-pulse" :
                    isConnected ? "bg-online animate-pulse-soft" : "bg-offline"
                  )} />
                  <span className="text-xs text-muted-foreground">Extensión:</span>
                </div>
                <div className="flex items-center gap-1">
                  {isConnected ? (
                    <Wifi className="h-4 w-4 text-online" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-offline" />
                  )}
                  <span className={cn(
                    "text-sm font-medium",
                    isConnected ? "text-online" : "text-offline"
                  )}>
                    {isLoading ? "Verificando..." : isConnected ? "Conectada" : "Desconectada"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => refetch()}
                >
                  <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="space-y-1 text-xs">
                <p><strong>Última actividad:</strong> {formatLastActivity()}</p>
                {lastAction && <p><strong>Acción:</strong> {lastAction.replace(/-/g, ' ')}</p>}
                <p className="text-muted-foreground">Se actualiza en tiempo real</p>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Session Status */}
          <StatusIndicator
            label="Sesión MP"
            isActive={sessionActive}
            activeIcon={Shield}
            inactiveIcon={ShieldOff}
            activeText="Activa"
            inactiveText="Expirada"
          />

          {/* Auto-Bid Toggle */}
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="flex items-center gap-2">
              <Power className={cn(
                "h-4 w-4 transition-colors",
                autoBidEnabled ? "text-success" : "text-muted-foreground"
              )} />
              <span className="text-sm font-medium text-foreground">Auto-Bid</span>
            </div>
            <Switch
              checked={autoBidEnabled}
              onCheckedChange={setAutoBidEnabled}
              className="data-[state=checked]:bg-success"
            />
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              autoBidEnabled ? "text-success" : "text-muted-foreground"
            )}>
              {autoBidEnabled ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {!isLoading && !isConnected && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 sm:px-6 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span className="text-xs sm:text-sm text-warning font-medium">
            ⚠️ Extensión no detectada. Inicia sesión en Mercado Público para activar Auto-Bids.
          </span>
        </div>
      )}
    </header>
  );
}

interface StatusIndicatorProps {
  label: string;
  isActive: boolean;
  activeIcon: React.ElementType;
  inactiveIcon: React.ElementType;
  activeText: string;
  inactiveText: string;
}

function StatusIndicator({
  label,
  isActive,
  activeIcon: ActiveIcon,
  inactiveIcon: InactiveIcon,
  activeText,
  inactiveText,
}: StatusIndicatorProps) {
  const Icon = isActive ? ActiveIcon : InactiveIcon;
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className={cn(
          "h-2 w-2 rounded-full",
          isActive ? "bg-online animate-pulse-soft" : "bg-offline"
        )} />
        <span className="text-xs text-muted-foreground">{label}:</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon className={cn(
          "h-4 w-4",
          isActive ? "text-online" : "text-offline"
        )} />
        <span className={cn(
          "text-sm font-medium",
          isActive ? "text-online" : "text-offline"
        )}>
          {isActive ? activeText : inactiveText}
        </span>
      </div>
    </div>
  );
}
