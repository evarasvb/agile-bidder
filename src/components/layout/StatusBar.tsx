import { useState } from "react";
import { Wifi, WifiOff, Shield, ShieldOff, Power, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const [autoBidEnabled, setAutoBidEnabled] = useState(false);
  const extensionConnected = true; // Mock state
  const sessionActive = true; // Mock state

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex h-full items-center justify-between px-6">
        {/* Left: Page Title Area */}
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">Centro de Control</h2>
        </div>

        {/* Right: Status Indicators */}
        <div className="flex items-center gap-6">
          {/* Extension Status */}
          <StatusIndicator
            label="Extensión"
            isActive={extensionConnected}
            activeIcon={Wifi}
            inactiveIcon={WifiOff}
            activeText="Conectada"
            inactiveText="Desconectada"
          />

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
      {!extensionConnected && (
        <div className="bg-warning/10 border-b border-warning/20 px-6 py-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm text-warning font-medium">
            ⚠️ Extensión no detectada. Por favor, inicia sesión en Mercado Público para activar Auto-Bids.
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
