import { Search, Gavel, Clock, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LiveFeed } from "@/components/dashboard/LiveFeed";

const metrics = [
  {
    title: "Oportunidades Escaneadas Hoy",
    value: 247,
    subtitle: "Última actualización: hace 2 min",
    icon: Search,
    trend: { value: 12, isPositive: true },
    variant: "primary" as const,
  },
  {
    title: "Ofertas Enviadas",
    value: 18,
    subtitle: "8 aceptadas, 6 pendientes",
    icon: Gavel,
    trend: { value: 25, isPositive: true },
    variant: "success" as const,
  },
  {
    title: "Matches Pendientes",
    value: 5,
    subtitle: "Requieren revisión manual",
    icon: Clock,
    variant: "warning" as const,
  },
  {
    title: "Total Ganado (Est.)",
    value: "$2.450.000",
    subtitle: "Últimos 30 días",
    icon: TrendingUp,
    trend: { value: 18, isPositive: true },
    variant: "success" as const,
  },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
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
            <h3 className="text-sm font-semibold text-foreground mb-4">Rendimiento Hoy</h3>
            <div className="space-y-4">
              <ProgressStat label="Tasa de Match" value={78} color="success" />
              <ProgressStat label="Ofertas Aceptadas" value={65} color="primary" />
              <ProgressStat label="Cobertura de Stock" value={92} color="success" />
            </div>
          </div>

          {/* Recent Wins */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Últimas Adjudicaciones</h3>
            <div className="space-y-3">
              <WinItem 
                title="Detergente Industrial 5L" 
                amount={150000} 
                organism="Municipalidad de Santiago" 
              />
              <WinItem 
                title="Jabón Líquido Antibacterial" 
                amount={89500} 
                organism="Hospital San José" 
              />
              <WinItem 
                title="Papel Toalla 250m" 
                amount={67800} 
                organism="SENAME" 
              />
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

function WinItem({ 
  title, 
  amount, 
  organism 
}: { 
  title: string; 
  amount: number; 
  organism: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{organism}</p>
      </div>
      <span className="font-mono text-sm font-semibold text-success">
        ${amount.toLocaleString("es-CL")}
      </span>
    </div>
  );
}
