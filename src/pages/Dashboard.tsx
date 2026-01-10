import { Search, Gavel, Clock, TrendingUp, Inbox } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LiveFeed } from "@/components/dashboard/LiveFeed";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard_metrics'],
    queryFn: async () => {
      // Get licitaciones stats
      const { data: licitaciones, error: licError } = await supabase
        .from('licitaciones')
        .select('*');
      
      if (licError) throw licError;

      const total = licitaciones?.length || 0;
      const conMatch = licitaciones?.filter(l => l.match_encontrado)?.length || 0;
      const pendientes = licitaciones?.filter(l => !l.procesada)?.length || 0;

      return {
        oportunidadesEscaneadas: total,
        ofertasEnviadas: 0, // Will come from ofertas table when created
        matchesPendientes: pendientes,
        licitacionesConMatch: conMatch,
      };
    },
  });
}

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();

  const dashboardMetrics = [
    {
      title: "Licitaciones Escaneadas",
      value: metricsLoading ? "..." : metrics?.oportunidadesEscaneadas || 0,
      subtitle: "Total en base de datos",
      icon: Search,
      variant: "primary" as const,
    },
    {
      title: "Ofertas Enviadas",
      value: metricsLoading ? "..." : metrics?.ofertasEnviadas || 0,
      subtitle: "Pendiente de implementar",
      icon: Gavel,
      variant: "success" as const,
    },
    {
      title: "Licitaciones Nuevas",
      value: metricsLoading ? "..." : metrics?.matchesPendientes || 0,
      subtitle: "Sin procesar",
      icon: Clock,
      variant: "warning" as const,
    },
    {
      title: "Con Match",
      value: metricsLoading ? "..." : metrics?.licitacionesConMatch || 0,
      subtitle: "Licitaciones con productos compatibles",
      icon: TrendingUp,
      variant: "success" as const,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Live Feed - Takes 2 columns */}
        <div className="xl:col-span-2">
          <LiveFeed />
        </div>

        {/* Quick Stats Sidebar */}
        <div className="space-y-4">
          {/* Today's Performance */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Estado del Sistema</h3>
            <div className="space-y-4">
              <ProgressStat 
                label="Licitaciones Procesadas" 
                value={metrics?.oportunidadesEscaneadas ? Math.round(((metrics.oportunidadesEscaneadas - (metrics.matchesPendientes || 0)) / metrics.oportunidadesEscaneadas) * 100) : 0} 
                color="success" 
              />
              <ProgressStat 
                label="Tasa de Match" 
                value={metrics?.oportunidadesEscaneadas ? Math.round(((metrics.licitacionesConMatch || 0) / metrics.oportunidadesEscaneadas) * 100) : 0} 
                color="primary" 
              />
            </div>
          </div>

          {/* Recent Wins */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Últimas Adjudicaciones</h3>
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Sin adjudicaciones aún</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressStat({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: number; 
  color: "success" | "primary" | "warning"; 
}) {
  const colorClasses = {
    success: "bg-success",
    primary: "bg-primary",
    warning: "bg-warning",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}