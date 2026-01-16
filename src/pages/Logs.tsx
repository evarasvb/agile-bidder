import { useState, useEffect } from "react";
import { Terminal, Filter, Download, Pause, Play, Trash2, Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSystemLogs, type SystemLog } from "@/hooks/useSystemLogs";

interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "success";
  source: string;
  message: string;
  tipo?: string;
}

// Mapear severidad de system_logs a level de LogEntry
function mapSeveridadToLevel(severidad: string): "info" | "warn" | "error" | "success" {
  switch (severidad) {
    case 'success': return 'success';
    case 'warning': return 'warn';
    case 'error': return 'error';
    default: return 'info';
  }
}

// Mapear tipo de log a source
function mapTipoToSource(tipo: string): string {
  switch (tipo) {
    case 'scraping': return 'Scanner';
    case 'match': return 'Matcher';
    case 'oferta_generada': return 'Ofertas';
    case 'oferta_enviada': return 'Ofertas';
    case 'error': return 'Sistema';
    default: return 'Sistema';
  }
}

export default function Logs() {
  const [isPaused, setIsPaused] = useState(false);
  // Polling automático cada 10 segundos cuando no está pausado
  const { data: systemLogs = [], isLoading } = useSystemLogs(100, {
    refetchInterval: isPaused ? false : 10000, // 10 segundos si no está pausado
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  // Transform system_logs to LogEntry format
  useEffect(() => {
    if (systemLogs.length > 0) {
      const transformedLogs: LogEntry[] = systemLogs.map((log: SystemLog) => ({
        id: log.id,
        timestamp: new Date(log.created_at),
        level: mapSeveridadToLevel(log.severidad),
        source: mapTipoToSource(log.tipo),
        message: log.mensaje,
        tipo: log.tipo,
      }));
      setLogs(transformedLogs);
    } else {
      setLogs([]);
    }
  }, [systemLogs]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const getLevelStyles = (level: LogEntry["level"]) => {
    switch (level) {
      case "info":
        return "text-primary bg-primary/10";
      case "success":
        return "text-success bg-success/10";
      case "warn":
        return "text-warning bg-warning/10";
      case "error":
        return "text-destructive bg-destructive/10";
    }
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Terminal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Logs del Sistema</h1>
            <p className="text-sm text-muted-foreground">
              Registro de actividad del sistema en tiempo real
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Reanudar
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pausar
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Limpiar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Buscar en logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className={cn(
            "h-2 w-2 rounded-full",
            isPaused ? "bg-warning" : "bg-success animate-pulse-soft"
          )} />
          {isPaused ? "Pausado" : "En vivo"}
        </div>
      </div>

      {/* Log Console */}
      <div className="rounded-xl border border-border bg-[hsl(220_30%_8%)] shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-[hsl(220_30%_10%)]">
          <span className="h-3 w-3 rounded-full bg-destructive/80" />
          <span className="h-3 w-3 rounded-full bg-warning/80" />
          <span className="h-3 w-3 rounded-full bg-success/80" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">
            FirmaVB Console — {filteredLogs.length} entries
          </span>
        </div>
        <div className="live-feed max-h-[500px] divide-y divide-border/20 font-mono text-sm">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Cargando logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No hay logs disponibles</p>
              <p className="text-xs">
                {systemLogs.length === 0 
                  ? "Los logs del sistema aparecerán aquí cuando haya actividad"
                  : "No hay logs que coincidan con los filtros seleccionados"}
              </p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-2.5 hover:bg-[hsl(220_30%_12%)] transition-colors",
                  index === 0 && !isPaused && "animate-slide-in bg-[hsl(220_30%_12%)]"
                )}
              >
                <span className="text-muted-foreground min-w-[70px] text-xs">
                  {formatTime(log.timestamp)}
                </span>
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-5 min-w-[60px] justify-center font-semibold uppercase border-0",
                    getLevelStyles(log.level)
                  )}
                >
                  {log.level}
                </Badge>
                <span className="text-primary min-w-[120px] text-xs">
                  [{log.source}]
                </span>
                <span className="text-[hsl(220_15%_75%)] flex-1 text-xs">
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}