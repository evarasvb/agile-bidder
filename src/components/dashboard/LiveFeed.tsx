import { useState, useEffect } from "react";
import { Activity, Search, Package, Gavel, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedItem {
  id: string;
  timestamp: Date;
  action: "scanning" | "matching" | "bidding";
  result: "success" | "no_match" | "pending" | "error";
  details: string;
  confidence?: number;
  amount?: number;
}

// Mock data generator
const generateMockFeed = (): FeedItem[] => [
  {
    id: "1",
    timestamp: new Date(Date.now() - 30000),
    action: "bidding",
    result: "success",
    details: 'Oferta enviada: "Detergente Industrial 5L" → Municipalidad de Santiago',
    amount: 150000,
  },
  {
    id: "2",
    timestamp: new Date(Date.now() - 120000),
    action: "matching",
    result: "success",
    details: 'Match encontrado: "Clorox 2L" ↔ SKU-CLX01 | Confianza: 95%',
    confidence: 95,
  },
  {
    id: "3",
    timestamp: new Date(Date.now() - 180000),
    action: "scanning",
    result: "no_match",
    details: 'Escaneando: 12 nuevas oportunidades en Región Metropolitana',
  },
  {
    id: "4",
    timestamp: new Date(Date.now() - 240000),
    action: "matching",
    result: "pending",
    details: 'Evaluando: "Papel Higiénico 400m" - Verificando stock',
  },
  {
    id: "5",
    timestamp: new Date(Date.now() - 300000),
    action: "bidding",
    result: "success",
    details: 'Oferta enviada: "Jabón Líquido 5L" → Hospital San José',
    amount: 89500,
  },
  {
    id: "6",
    timestamp: new Date(Date.now() - 360000),
    action: "scanning",
    result: "success",
    details: 'Ciclo completado: 45 oportunidades procesadas',
  },
];

export function LiveFeed() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(generateMockFeed());

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const newItem: FeedItem = {
        id: Date.now().toString(),
        timestamp: new Date(),
        action: ["scanning", "matching", "bidding"][Math.floor(Math.random() * 3)] as FeedItem["action"],
        result: ["success", "no_match", "pending"][Math.floor(Math.random() * 3)] as FeedItem["result"],
        details: "Procesando nuevas oportunidades...",
      };
      setFeedItems((prev) => [newItem, ...prev.slice(0, 9)]);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const getActionIcon = (action: FeedItem["action"]) => {
    switch (action) {
      case "scanning":
        return Search;
      case "matching":
        return Package;
      case "bidding":
        return Gavel;
    }
  };

  const getActionLabel = (action: FeedItem["action"]) => {
    switch (action) {
      case "scanning":
        return "Escaneo";
      case "matching":
        return "Matching";
      case "bidding":
        return "Oferta";
    }
  };

  const getResultIcon = (result: FeedItem["result"]) => {
    switch (result) {
      case "success":
        return CheckCircle2;
      case "no_match":
        return XCircle;
      case "pending":
        return Clock;
      case "error":
        return XCircle;
    }
  };

  const getResultStyles = (result: FeedItem["result"]) => {
    switch (result) {
      case "success":
        return "text-success bg-success/10";
      case "no_match":
        return "text-muted-foreground bg-muted";
      case "pending":
        return "text-warning bg-warning/10";
      case "error":
        return "text-destructive bg-destructive/10";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-success animate-pulse-soft" />
          <h3 className="text-base font-semibold text-foreground">Actividad en Vivo</h3>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
          En tiempo real
        </span>
      </div>

      {/* Feed List */}
      <div className="live-feed max-h-[400px] divide-y divide-border/50">
        {feedItems.map((item, index) => {
          const ActionIcon = getActionIcon(item.action);
          const ResultIcon = getResultIcon(item.result);
          
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-4 px-5 py-3.5 data-row",
                index === 0 && "animate-slide-in bg-accent/30"
              )}
            >
              {/* Timestamp */}
              <span className="font-mono text-xs text-muted-foreground min-w-[70px]">
                {formatTime(item.timestamp)}
              </span>

              {/* Action Badge */}
              <div className="flex items-center gap-1.5 min-w-[90px]">
                <ActionIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {getActionLabel(item.action)}
                </span>
              </div>

              {/* Details */}
              <p className="flex-1 text-sm text-foreground/80 line-clamp-2">
                {item.details}
              </p>

              {/* Result */}
              <div className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5",
                getResultStyles(item.result)
              )}>
                <ResultIcon className="h-3 w-3" />
                {item.amount && (
                  <span className="font-mono text-xs font-medium">
                    ${item.amount.toLocaleString("es-CL")}
                  </span>
                )}
                {item.confidence && (
                  <span className="font-mono text-xs font-medium">
                    {item.confidence}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
