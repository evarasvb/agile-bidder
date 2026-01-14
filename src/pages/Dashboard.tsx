import { 
  Search, 
  Gavel, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Target,
  ArrowRight,
  Trophy,
  FileCheck,
  Loader2,
  Sparkles,
  RefreshCw,
  Inbox
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  useDashboardMetrics, 
  useWeeklyMatchData, 
  useLicitacionesUrgentes 
} from "@/hooks/useDashboard";
import { useMatchingAI } from "@/hooks/useMatching";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { 
  MetricCardSkeleton, 
  ChartSkeleton, 
  ValueCardSkeleton, 
  UrgentListSkeleton, 
  StatsCardSkeleton 
} from "@/components/dashboard/DashboardSkeleton";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useDashboardMetrics();
  const { data: weeklyData, isLoading: chartLoading, error: chartError } = useWeeklyMatchData();
  const { data: urgentes, isLoading: urgentesLoading, error: urgentesError } = useLicitacionesUrgentes();
  const { mutate: runMatching, isPending: isMatching } = useMatchingAI();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Show error toast
  if (metricsError) {
    console.error('[Dashboard] Metrics error:', metricsError);
  }

  const handleForceRefresh = async () => {
    await refetchMetrics();
    toast({
      title: "Datos actualizados",
      description: "Se han recargado las métricas del dashboard",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Resumen de oportunidades y rendimiento
            {metrics && metrics.totalLicitaciones > 0 && (
              <span className="ml-2 text-firmavb-blue">
                ({metrics.totalLicitaciones} licitaciones en sistema)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceRefresh}
            disabled={metricsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button 
            onClick={() => runMatching()}
            disabled={isMatching}
            className="bg-gradient-to-r from-firmavb-blue to-firmavb-blue/80 hover:from-firmavb-blue/90 hover:to-firmavb-blue/70 shadow-lg shadow-firmavb-blue/25"
          >
            {isMatching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Ejecutar Matching IA
              </>
            )}
          </Button>
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-firmavb-blue animate-pulse" />
            Actualizado en vivo
          </Badge>
        </div>
      </div>

      {/* Error Banner */}
      {metricsError && (
        <div className="bg-firmavb-red/10 border border-firmavb-red/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-firmavb-red">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Error al cargar datos del dashboard</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchMetrics()}
            className="border-firmavb-red/30 text-firmavb-red hover:bg-firmavb-red/10"
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Licitaciones Activas"
              value={metrics?.licitacionesActivas || 0}
              subtitle={`${metrics?.totalLicitaciones || 0} total escaneadas`}
              icon={Search}
              color="blue"
            />
            <MetricCard
              title="Matches Encontrados"
              value={metrics?.matchesEncontrados || 0}
              subtitle={`${metrics?.porcentajeMatches || 0}% tasa de match`}
              icon={Target}
              color="green"
              trend={metrics?.porcentajeMatches ? `${metrics.porcentajeMatches}%` : undefined}
            />
            <MetricCard
              title="Ofertas Pendientes"
              value={metrics?.ofertasPendientes || 0}
              subtitle="Listas para enviar"
              icon={FileCheck}
              color="amber"
            />
            <MetricCard
              title="Tasa de Éxito"
              value={`${metrics?.tasaExito || 0}%`}
              subtitle={`${metrics?.ofertasGanadas || 0} de ${metrics?.ofertasEnviadas || 0} ganadas`}
              icon={Trophy}
              color="emerald"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Chart - Takes 2 columns */}
        {chartLoading ? (
          <ChartSkeleton />
        ) : chartError ? (
          <Card className="xl:col-span-2 border-border/50 shadow-sm">
            <CardContent className="h-[320px] flex flex-col items-center justify-center text-firmavb-red">
              <AlertTriangle className="h-10 w-10 mb-3 opacity-70" />
              <p className="text-sm font-medium">Error al cargar gráfico</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="xl:col-span-2 border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-firmavb-blue" />
                Evolución Semanal de Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!weeklyData?.length ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">Sin datos para mostrar</p>
                  <p className="text-xs">Los datos aparecerán cuando haya actividad</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="matchesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--firmavb-blue))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--firmavb-blue))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="licitacionesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152, 70%, 45%)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(152, 70%, 45%)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="semana" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="licitaciones"
                      name="Licitaciones"
                      stroke="hsl(152, 70%, 45%)"
                      fill="url(#licitacionesGradient)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="matches"
                      name="Matches"
                      stroke="hsl(var(--firmavb-blue))"
                      fill="url(#matchesGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sidebar Stats */}
        <div className="space-y-4">
          {/* Value Summary */}
          {metricsLoading ? (
            <ValueCardSkeleton />
          ) : (
            <Card className="border-border/50 shadow-sm bg-gradient-to-br from-firmavb-blue to-firmavb-blue/80 text-white">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium opacity-90">Valor Potencial</span>
                  <Gavel className="h-5 w-5 opacity-80" />
                </div>
                <p className="text-2xl font-bold font-mono">
                  {formatCurrency(metrics?.valorPotencial || 0)}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  Basado en licitaciones con match
                </p>
              </CardContent>
            </Card>
          )}

          {/* Próximas a Vencer */}
          {urgentesLoading ? (
            <UrgentListSkeleton />
          ) : urgentesError ? (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="py-8 flex flex-col items-center justify-center text-firmavb-red">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-70" />
                <p className="text-sm">Error al cargar</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-firmavb-red" />
                  Próximas a Vencer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!urgentes?.length ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin licitaciones urgentes</p>
                  </div>
                ) : (
                  urgentes.map((lic) => (
                    <UrgentTenderCard key={lic.id_licitacion} tender={lic} />
                  ))
                )}
                {urgentes && urgentes.length > 0 && (
                  <Button 
                    asChild 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2"
                  >
                    <Link to="/licitaciones">
                      Ver todas
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          {metricsLoading ? (
            <StatsCardSkeleton />
          ) : (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Estado del Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressStat 
                  label="Licitaciones Procesadas" 
                  value={metrics?.totalLicitaciones ? 
                    Math.round(((metrics.totalLicitaciones - (metrics.licitacionesActivas)) / metrics.totalLicitaciones) * 100) : 0
                  } 
                  color="blue" 
                />
                <ProgressStat 
                  label="Tasa de Match" 
                  value={metrics?.porcentajeMatches || 0} 
                  color="green" 
                />
                <ProgressStat 
                  label="Ofertas Enviadas" 
                  value={metrics?.ofertasEnviadas && metrics?.ofertasPendientes ? 
                    Math.round((metrics.ofertasEnviadas / (metrics.ofertasEnviadas + metrics.ofertasPendientes)) * 100) : 0
                  } 
                  color="amber" 
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed />
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'emerald' | 'red';
  trend?: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend }: MetricCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-firmavb-blue/10',
      icon: 'text-firmavb-blue',
      border: 'border-firmavb-blue/20',
    },
    green: {
      bg: 'bg-success/10',
      icon: 'text-success',
      border: 'border-success/20',
    },
    amber: {
      bg: 'bg-warning/10',
      icon: 'text-warning',
      border: 'border-warning/20',
    },
    emerald: {
      bg: 'bg-success/10',
      icon: 'text-success',
      border: 'border-success/20',
    },
    red: {
      bg: 'bg-firmavb-red/10',
      icon: 'text-firmavb-red',
      border: 'border-firmavb-red/20',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card className={`border-border/50 shadow-sm hover:shadow-md transition-shadow ${colors.border}`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={`rounded-lg p-2.5 ${colors.bg}`}>
            <Icon className={`h-5 w-5 ${colors.icon}`} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-xs font-medium text-success">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface UrgentTenderCardProps {
  tender: {
    id_licitacion: string;
    titulo: string;
    organismo: string;
    diasRestantes: number;
    presupuesto: number | null;
    match_score: number | null;
  };
}

function UrgentTenderCard({ tender }: UrgentTenderCardProps) {
  const isVeryUrgent = tender.diasRestantes <= 2;
  
  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      isVeryUrgent 
        ? 'border-firmavb-red/30 bg-firmavb-red/5' 
        : 'border-border hover:bg-muted/50'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground line-clamp-1">
            {tender.titulo}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {tender.organismo}
          </p>
        </div>
        <Badge 
          variant={isVeryUrgent ? "destructive" : "secondary"}
          className="shrink-0"
        >
          {tender.diasRestantes === 0 
            ? 'Hoy' 
            : tender.diasRestantes === 1 
            ? 'Mañana' 
            : `${tender.diasRestantes}d`}
        </Badge>
      </div>
      {tender.match_score && (
        <div className="mt-2 flex items-center gap-1">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full rounded-full bg-firmavb-blue"
              style={{ width: `${tender.match_score}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {tender.match_score}%
          </span>
        </div>
      )}
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
  color: 'blue' | 'green' | 'amber';
}) {
  const colorClasses = {
    green: 'bg-success',
    blue: 'bg-firmavb-blue',
    amber: 'bg-warning',
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
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
