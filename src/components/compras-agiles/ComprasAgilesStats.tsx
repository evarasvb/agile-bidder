import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, CheckCircle2, AlertTriangle, DollarSign } from "lucide-react";
import { useComprasAgilesStats } from "@/hooks/useComprasAgiles";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/utils/clasificacion";

function formatCurrencyShort(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'red' | 'amber';
}

function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-accent/10 text-accent',
    amber: 'bg-amber-500/10 text-amber-600',
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComprasAgilesStats() {
  const { data: stats, isLoading } = useComprasAgilesStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardContent className="pt-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Compras"
        value={stats?.total || 0}
        subtitle="Activas en sistema"
        icon={ShoppingCart}
        color="blue"
      />
      <StatCard
        title="Con Match"
        value={stats?.conMatch || 0}
        subtitle="Productos coincidentes"
        icon={CheckCircle2}
        color="green"
      />
      <StatCard
        title="Urgentes"
        value={stats?.urgentes || 0}
        subtitle="Próximas a cerrar"
        icon={AlertTriangle}
        color="red"
      />
      <StatCard
        title="Monto Total"
        value={formatCurrencyShort(stats?.montoTotal || 0)}
        subtitle="Valor potencial"
        icon={DollarSign}
        color="amber"
      />
    </div>
  );
}
