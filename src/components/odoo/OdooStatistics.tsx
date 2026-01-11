import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Send, CheckCircle2 } from 'lucide-react';

interface OdooOpportunity {
  id: number;
  name: string;
  expected_revenue: number;
  stage_id?: [number, string];
  create_date?: string;
}

interface OdooStatisticsProps {
  opportunities: OdooOpportunity[];
  isLoading: boolean;
}

export function OdooStatistics({ opportunities, isLoading }: OdooStatisticsProps) {
  // Calculate statistics
  const totalOpportunities = opportunities.length;
  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.expected_revenue || 0), 0);
  const wonOpportunities = opportunities.filter(opp => 
    opp.stage_id?.[1]?.toLowerCase().includes('ganado') || 
    opp.stage_id?.[1]?.toLowerCase().includes('won')
  ).length;
  const successRate = totalOpportunities > 0 
    ? Math.round((wonOpportunities / totalOpportunities) * 100) 
    : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const stats = [
    {
      title: 'Oportunidades Enviadas',
      value: totalOpportunities.toString(),
      icon: Send,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Valor Total Sincronizado',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Tasa de Éxito',
      value: `${successRate}%`,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Ganadas',
      value: wonOpportunities.toString(),
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estadísticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Estadísticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.map((stat, index) => (
          <div key={index} className="flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
              <p className="text-lg font-semibold text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
