import { useState } from "react";
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
  Inbox,
  BarChart3,
  Zap,
  Info,
  HelpCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  useDashboardMetrics, 
  useWeeklyMatchData, 
  useLicitacionesUrgentes 
} from "@/hooks/useDashboard";
import { useOportunidadesStats } from "@/hooks/useOportunidades";
import { useMatchingAI } from "@/hooks/useMatching";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  MetricCardSkeleton, 
  ChartSkeleton, 
  ValueCardSkeleton, 
  UrgentListSkeleton, 
  StatsCardSkeleton 
} from "@/components/dashboard/DashboardSkeleton";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OportunidadesTable } from "@/components/dashboard/OportunidadesTable";
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useDashboardMetrics();
  const { data: weeklyData, isLoading: chartLoading, error: chartError } = useWeeklyMatchData();
  const { data: urgentes, isLoading: urgentesLoading, error: urgentesError } = useLicitacionesUrgentes();
  const { data: stats, isLoading: statsLoading } = useOportunidadesStats();
  const { mutate: runMatching, isPending: isMatching } = useMatchingAI();
  const [matchingDialogOpen, setMatchingDialogOpen] = useState(false);
  const [matchingPreview, setMatchingPreview] = useState<{ total: number; comprasAgiles: number; licitaciones: number } | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(0)}M`;
    }
    return formatCurrency(value);
  };

  if (metricsError) {
    console.error('[Dashboard] Metrics error:', metricsError);
  }

  const handleMatchingClick = async () => {
    // Cargar preview antes de ejecutar
    try {
      const { data: comprasAgiles } = await supabase
        .from('compras_agiles')
        .select('codigo', { count: 'exact' })
        .or('match_encontrado.eq.false,match_encontrado.is.null')
        .limit(1000);
      
      const { data: licitaciones } = await supabase
        .from('licitaciones')
        .select('id_licitacion', { count: 'exact' })
        .eq('procesada', false)
        .limit(1000);

      const total = (comprasAgiles?.length || 0) + (licitaciones?.length || 0);
      
      if (total === 0) {
        toast({
          title: 'Sin compras ágiles nuevas',
          description: 'Todas las compras ágiles ya han sido procesadas'
        });
        return;
      }

      setMatchingPreview({
        total,
        comprasAgiles: comprasAgiles?.length || 0,
        licitaciones: licitaciones?.length || 0,
      });
      setMatchingDialogOpen(true);
    } catch (error) {
      console.error('Error loading preview:', error);
      // Si falla el preview, ejecutar directamente
      runMatching();
    }
  };

  const handleConfirmMatching = () => {
    setMatchingDialogOpen(false);
    runMatching();
  };

  const handleForceRefresh = async () => {
    await refetchMetrics();
    toast({
      title: "Datos actualizados",
      description: "Se han recargado las métricas del dashboard",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with FirmaVB Branding */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <FirmaVBHeader 
          title="Dashboard"
          subtitle="Resumen de oportunidades y rendimiento"
        />
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleForceRefresh}
                disabled={metricsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Actualiza las métricas del dashboard</p>
            </TooltipContent>
          </Tooltip>

          <Dialog open={matchingDialogOpen} onOpenChange={setMatchingDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button 
                    onClick={handleMatchingClick}
                    disabled={isMatching}
                    className="bg-firmavb-blue hover:bg-firmavb-blue/90 text-white shadow-lg"
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
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Analiza compras ágiles y encuentra matches con tu inventario usando IA</p>
              </TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-firmavb-blue" />
                  Ejecutar Matching con IA
                </DialogTitle>
                <DialogDescription>
                  El sistema analizará las compras ágiles y licitaciones pendientes para encontrar matches con tu inventario.
                </DialogDescription>
              </DialogHeader>
              {matchingPreview && (
                <div className="space-y-4 py-4">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm font-medium mb-3">Resumen de procesamiento:</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total a procesar:</span>
                        <span className="font-semibold">{matchingPreview.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Compras Ágiles:</span>
                        <span className="font-medium">{matchingPreview.comprasAgiles}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Licitaciones:</span>
                        <span className="font-medium">{matchingPreview.licitaciones}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                      <strong>Nota:</strong> El proceso puede tomar varios minutos dependiendo de la cantidad de compras ágiles. 
                      Los resultados se mostrarán automáticamente al finalizar.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMatchingDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmMatching}
                  disabled={isMatching}
                  className="bg-firmavb-blue hover:bg-firmavb-blue/90"
                >
                  {isMatching ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Ejecutar Matching'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-firmavb-green cursor-help">
                <span className="h-2 w-2 rounded-full bg-firmavb-green animate-pulse" />
                En vivo
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Sistema activo y actualizando datos en tiempo real</p>
            </TooltipContent>
          </Tooltip>
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

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricsLoading || statsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Oportunidades Activas"
              value={stats?.oportunidadesActivas || metrics?.licitacionesActivas || 0}
              subtitle={`${stats?.totalOportunidades || metrics?.totalLicitaciones || 0} total`}
              icon={Target}
              color="blue"
            />
            <MetricCard
              title="Match Rate"
              value={`${stats?.matchRate || metrics?.porcentajeMatches || 0}%`}
              subtitle={`${stats?.conMatch || metrics?.matchesEncontrados || 0} matches encontrados`}
              icon={Zap}
              color="green"
              trend={stats?.matchRate ? `${stats.matchRate}%` : undefined}
            />
            <MetricCard
              title="Ofertas Enviadas"
              value={metrics?.ofertasEnviadas || 0}
              subtitle={`${metrics?.ofertasPendientes || 0} pendientes`}
              icon={FileCheck}
              color="amber"
            />
            <MetricCard
              title="Valor Potencial"
              value={formatCompact(stats?.valorPotencial || metrics?.valorPotencial || 0)}
              subtitle="En oportunidades con match"
              icon={Gavel}
              color="emerald"
            />
          </>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Chart Section - Takes 2 columns */}
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
              <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-firmavb-blue" />
                Tendencia Semanal
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
                  <BarChart data={weeklyData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis 
                      dataKey="semana" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-md)',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Bar
                      dataKey="licitaciones"
                      name="Licitaciones"
                      fill="hsl(var(--firmavb-celeste))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="matches"
                      name="Matches"
                      fill="hsl(var(--firmavb-green))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Value Summary Card */}
          {metricsLoading ? (
            <ValueCardSkeleton />
          ) : (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-firmavb-blue to-firmavb-blue/80 text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('/placeholder.svg')] opacity-5" />
              <CardContent className="pt-6 relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium opacity-90">Valor Total Oportunidades</span>
                  <Gavel className="h-5 w-5 opacity-80" />
                </div>
                <p className="text-3xl font-heading font-bold font-mono tracking-tight">
                  {formatCompact(stats?.valorTotal || metrics?.valorTotal || 0)}
                </p>
                <p className="text-sm opacity-80 mt-1">
                  En {stats?.totalOportunidades || metrics?.totalLicitaciones || 0} oportunidades activas
                </p>
              </CardContent>
            </Card>
          )}

          {/* Urgent Listings */}
          {urgentesLoading ? (
            <UrgentListSkeleton />
          ) : urgentesError ? (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="py-6 text-center text-firmavb-red">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-70" />
                <p className="text-sm">Error al cargar urgentes</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-firmavb-amber" />
                  Cierran Pronto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!urgentes?.length ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin licitaciones urgentes</p>
                  </div>
                ) : (
                  urgentes.slice(0, 4).map((lic) => (
                    <div
                      key={lic.id_licitacion}
                      className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lic.titulo}</p>
                          <p className="text-xs text-muted-foreground truncate">{lic.organismo}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-firmavb-amber border-firmavb-amber/30">
                          {lic.diasRestantes}d
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
                {urgentes && urgentes.length > 4 && (
                  <Link to="/licitaciones">
                    <Button variant="ghost" className="w-full text-firmavb-blue hover:text-firmavb-blue hover:bg-firmavb-blue/10">
                      Ver todas ({urgentes.length})
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          {statsLoading ? (
            <StatsCardSkeleton />
          ) : (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-firmavb-green" />
                  Estadísticas Rápidas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tasa de match</span>
                  <span className="font-semibold text-firmavb-green">{stats?.matchRate || 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Con match</span>
                  <span className="font-semibold">{stats?.conMatch || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Valor promedio</span>
                  <span className="font-semibold font-mono">{formatCompact(stats?.valorPromedio || 0)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Activity Feed and Opportunities Table */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <OportunidadesTable />
        </div>
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'amber' | 'emerald';
  trend?: string;
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend }: MetricCardProps) {
  const colorClasses = {
    blue: 'text-firmavb-blue bg-firmavb-blue/10',
    green: 'text-firmavb-green bg-firmavb-green/10',
    amber: 'text-firmavb-amber bg-firmavb-amber/10',
    emerald: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
  };

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend && (
            <Badge variant="outline" className="text-firmavb-green border-firmavb-green/30">
              <TrendingUp className="h-3 w-3 mr-1" />
              {trend}
            </Badge>
          )}
        </div>
        <p className="text-2xl font-heading font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}