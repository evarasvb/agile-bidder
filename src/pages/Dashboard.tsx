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
  Tooltip, 
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
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
        toast.info('No hay compras ágiles nuevas para procesar', {
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
        toast.info('No hay compras ágiles nuevas para procesar', {
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
                  {formatCompact(stats?.valorPotencial || metrics?.valorPotencial || 0)}
                </p>
                <p className="text-xs opacity-80 mt-2">
                  De {stats?.conMatch || metrics?.matchesEncontrados || 0} oportunidades con match
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
                <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-firmavb-orange" />
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
                    className="w-full mt-2 text-firmavb-blue hover:text-firmavb-blue hover:bg-firmavb-blue/10"
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
                <CardTitle className="text-base font-heading font-semibold">Rendimiento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ProgressStat 
                  label="Match Rate" 
                  value={stats?.matchRate || metrics?.porcentajeMatches || 0} 
                  color="blue" 
                />
                <ProgressStat 
                  label="Tasa de Éxito" 
                  value={metrics?.tasaExito || 0} 
                  color="green" 
                />
                <ProgressStat 
                  label="Ofertas Activas" 
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

      {/* Oportunidades Table */}
      <OportunidadesTable />

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
      bg: 'bg-firmavb-green/10',
      icon: 'text-firmavb-green',
      border: 'border-firmavb-green/20',
    },
    amber: {
      bg: 'bg-firmavb-orange/10',
      icon: 'text-firmavb-orange',
      border: 'border-firmavb-orange/20',
    },
    emerald: {
      bg: 'bg-firmavb-green/10',
      icon: 'text-firmavb-green',
      border: 'border-firmavb-green/20',
    },
    red: {
      bg: 'bg-firmavb-red/10',
      icon: 'text-firmavb-red',
      border: 'border-firmavb-red/20',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card className={`border-border/50 shadow-sm hover:shadow-md transition-all duration-200 ${colors.border} card-hover`}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-heading font-bold font-mono text-foreground">
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
            <TrendingUp className="h-3 w-3 text-firmavb-green" />
            <span className="text-xs font-medium text-firmavb-green">{trend}</span>
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
    <div className={`rounded-lg border p-3 transition-all duration-200 ${
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
          className={isVeryUrgent ? "bg-firmavb-red" : ""}
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
          <span className="text-xs font-mono font-medium text-firmavb-blue">{tender.match_score}%</span>
        </div>
      )}
    </div>
  );
}

interface ProgressStatProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'amber';
}

function ProgressStat({ label, value, color }: ProgressStatProps) {
  const colorClasses = {
    blue: 'bg-firmavb-blue',
    green: 'bg-firmavb-green',
    amber: 'bg-firmavb-orange',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{value}%</span>
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
