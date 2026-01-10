import { useEffect, useState } from "react";
import { Activity, Loader2, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FeedItem {
  id: string;
  timestamp: Date;
  action: "scanning" | "matching" | "bidding";
  result: "success" | "pending" | "no_match";
  details: string;
  amount?: number;
  confidence?: number;
}

function useLicitacionesFeed() {
  return useQuery({
    queryKey: ['licitaciones_feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      // Transform licitaciones into feed items
      return (data || []).map((lic): FeedItem => ({
        id: lic.id_licitacion,
        timestamp: new Date(lic.created_at),
        action: lic.match_encontrado ? "matching" : lic.procesada ? "scanning" : "scanning",
        result: lic.match_encontrado ? "success" : lic.procesada ? "no_match" : "pending",
        details: `${lic.titulo} - ${lic.organismo}`,
        confidence: lic.match_score || undefined,
      }));
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function LiveFeed() {
  const { data: feed = [], isLoading } = useLicitacionesFeed();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getActionBadge = (action: FeedItem["action"]) => {
    switch (action) {
      case "scanning":
        return <Badge variant="outline" className="text-xs">Escaneando</Badge>;
      case "matching":
        return <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">Match</Badge>;
      case "bidding":
        return <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Oferta</Badge>;
    }
  };

  const getResultIndicator = (result: FeedItem["result"]) => {
    switch (result) {
      case "success":
        return <span className="h-2 w-2 rounded-full bg-success animate-pulse" />;
      case "pending":
        return <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />;
      case "no_match":
        return <span className="h-2 w-2 rounded-full bg-muted-foreground" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((currentTime.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    return format(date, "dd MMM", { locale: es });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Actividad Reciente</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">En vivo</span>
        </div>
      </div>

      {/* Feed Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Sin actividad reciente</p>
              <p className="text-xs">Las licitaciones aparecerán aquí</p>
            </div>
          ) : (
            feed.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                {getResultIndicator(item.result)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActionBadge(item.action)}
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground truncate">{item.details}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.amount && (
                      <span className="text-xs font-mono text-success font-medium">
                        ${item.amount.toLocaleString("es-CL")}
                      </span>
                    )}
                    {item.confidence && (
                      <span className="text-xs text-muted-foreground">
                        {item.confidence}% match
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}