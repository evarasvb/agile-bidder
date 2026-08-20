import { useState } from "react";
import {
  Target,
  Zap,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Clock,
  Eye,
  Plus,
  Loader2,
  Sparkles,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Info,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDashboardKPIs,
  usePipelineByStage,
  useOportunidadesPorTipo,
  useCierresProximos,
  useUltimosMatches,
} from "@/hooks/useDashboardPrincipal";
import { useMatchingAI } from "@/hooks/useMatching";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  MetricCardSkeleton,
  ChartSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { ResumenEjecutivo } from "@/components/dashboard/ResumenEjecutivo";
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PIE_COLORS = [
  "hsl(var(--firmavb-blue))",
  "hsl(var(--firmavb-green))",
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatCompact = (value: number) => {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(0)}M`;
  return formatCurrency(value);
};

export default function Dashboard() {
  const {
    data: kpis,
    isLoading: kpisLoading,
    error: kpisError,
    refetch: refetchKPIs,
  } = useDashboardKPIs();
  const { data: pipelineData, isLoading: pipelineLoading } =
    usePipelineByStage();
  const { data: porTipoData, isLoading: porTipoLoading } =
    useOportunidadesPorTipo();
  const { data: cierresData, isLoading: cierresLoading } =
    useCierresProximos();
  const { data: matchesData, isLoading: matchesLoading } =
    useUltimosMatches();
  const { mutate: runMatching, isPending: isMatching } = useMatchingAI();
  const [matchingDialogOpen, setMatchingDialogOpen] = useState(false);
  const [matchingPreview, setMatchingPreview] = useState<{
    total: number;
    comprasAgiles: number;
    licitaciones: number;
  } | null>(null);

  const handleMatchingClick = async () => {
    try {
      const { data: comprasAgiles } = await supabase
        .from("compras_agiles")
        .select("codigo", { count: "exact" })
        .or("match_encontrado.eq.false,match_encontrado.is.null")
        .limit(1000);

      const { data: licitaciones } = await supabase
        .from("licitaciones")
        .select("id_licitacion", { count: "exact" })
        .eq("procesada", false)
        .limit(1000);

      const total =
        (comprasAgiles?.length || 0) + (licitaciones?.length || 0);

      if (total === 0) {
        toast({
          title: "Sin oportunidades nuevas",
          description: "Todas las oportunidades ya han sido procesadas",
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
      console.error("Error loading preview:", error);
      runMatching();
    }
  };

  const handleConfirmMatching = () => {
    setMatchingDialogOpen(false);
    runMatching();
  };

  const handleForceRefresh = async () => {
    await refetchKPIs();
    toast({
      title: "Datos actualizados",
      description: "Se han recargado las métricas del dashboard",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
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
                disabled={kpisLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${kpisLoading ? "animate-spin" : ""}`}
                />
                Actualizar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Actualiza las métricas del dashboard
              </p>
            </TooltipContent>
          </Tooltip>

          <Dialog
            open={matchingDialogOpen}
            onOpenChange={setMatchingDialogOpen}
          >
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
                <p className="text-xs">
                  Analiza oportunidades y encuentra matches con tu inventario
                  usando IA
                </p>
              </TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-firmavb-blue" />
                  Ejecutar Matching con IA
                </DialogTitle>
                <DialogDescription>
                  El sistema analizará las compras ágiles y licitaciones
                  pendientes para encontrar matches con tu inventario.
                </DialogDescription>
              </DialogHeader>
              {matchingPreview && (
                <div className="space-y-4 py-4">
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm font-medium mb-3">
                      Resumen de procesamiento:
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Total a procesar:
                        </span>
                        <span className="font-semibold">
                          {matchingPreview.total}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Compras Ágiles:
                        </span>
                        <span className="font-medium">
                          {matchingPreview.comprasAgiles}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Licitaciones:
                        </span>
                        <span className="font-medium">
                          {matchingPreview.licitaciones}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-900 dark:text-blue-100">
                      <strong>Nota:</strong> El proceso puede tomar varios
                      minutos. Los resultados se mostrarán automáticamente al
                      finalizar.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMatchingDialogOpen(false)}
                >
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
                    "Ejecutar Matching"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="gap-1.5 px-3 py-1.5 border-firmavb-green cursor-help"
              >
                <span className="h-2 w-2 rounded-full bg-firmavb-green animate-pulse" />
                En vivo
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Sistema activo y actualizando datos en tiempo real
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Resumen ejecutivo del negocio (datos reales del pipeline) */}
      <ResumenEjecutivo />

      {/* Error Banner */}
      {kpisError && (
        <div className="bg-firmavb-red/10 border border-firmavb-red/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-firmavb-red">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Error al cargar datos del dashboard
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchKPIs()}
            className="border-firmavb-red/30 text-firmavb-red hover:bg-firmavb-red/10"
          >
            Reintentar
          </Button>
        </div>
      )}

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpisLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              title="Oportunidades Activas"
              value={kpis?.oportunidadesActivas || 0}
              icon={Target}
              color="blue"
              trend={kpis?.oportunidadesActivasTrend}
            />
            <KPICard
              title="Match Score Promedio"
              value={`${kpis?.matchScorePromedio || 0}%`}
              icon={Zap}
              color="green"
              trend={kpis?.matchScorePromedioTrend}
            />
            <KPICard
              title="Monto en Pipeline"
              value={formatCompact(kpis?.montoEnPipeline || 0)}
              icon={DollarSign}
              color="amber"
              trend={kpis?.montoEnPipelineTrend}
            />
            <KPICard
              title="Tasa de Éxito"
              value={`${kpis?.tasaExito || 0}%`}
              icon={TrendingUp}
              color="emerald"
              trend={kpis?.tasaExitoTrend}
            />
          </>
        )}
      </div>

      {/* Row 2: Two Charts Side by Side */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Pipeline por Etapa */}
        {pipelineLoading ? (
          <ChartSkeleton />
        ) : (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-firmavb-blue" />
                Pipeline por Etapa
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!pipelineData?.length ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">Sin datos de pipeline</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={pipelineData} barCategoryGap="20%">
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="etapa"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "monto")
                          return [formatCompact(value), "Monto"];
                        return [value, "Cantidad"];
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      name="Cantidad"
                      fill="hsl(var(--firmavb-blue))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Oportunidades por Tipo */}
        {porTipoLoading ? (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <div className="h-[280px] flex items-center justify-center">
                <Skeleton className="h-40 w-40 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-firmavb-green" />
                Oportunidades por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!porTipoData?.length ||
              porTipoData.every((d) => d.count === 0) ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">Sin datos</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={porTipoData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="tipo"
                      label={({ tipo, count }) => `${tipo}: ${count}`}
                      labelLine={false}
                    >
                      {porTipoData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3: Cierres Próximos + Últimos Matches */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Cierres Próximos */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-firmavb-amber" />
              Cierres Próximos (7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cierresLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !cierresData?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  Sin oportunidades por cerrar esta semana
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Título</TableHead>
                      <TableHead className="font-semibold">
                        Institución
                      </TableHead>
                      <TableHead className="font-semibold">Cierre</TableHead>
                      <TableHead className="font-semibold">Match</TableHead>
                      <TableHead className="font-semibold">Etapa</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cierresData.map((item) => (
                      <TableRow key={item.codigo} className="data-row">
                        <TableCell>
                          <p className="font-medium text-sm line-clamp-1 max-w-[200px]">
                            {item.nombre}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-[150px]">
                            {item.institucion}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.diasRestantes <= 2
                                ? "border-firmavb-red text-firmavb-red"
                                : "border-firmavb-amber text-firmavb-amber"
                            }
                          >
                            {item.diasRestantes === 0
                              ? "¡Hoy!"
                              : item.diasRestantes === 1
                                ? "Mañana"
                                : `${item.diasRestantes}d`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.match_score ? (
                            <span className="font-mono text-sm font-medium">
                              {item.match_score}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {item.etapa}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            to={
                              item.tipo === "Compra Ágil"
                                ? `/compras-agiles/${item.codigo}`
                                : `/licitaciones/${item.codigo}`
                            }
                          >
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Últimos Matches */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-firmavb-green" />
              Últimos Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !matchesData?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Sin matches recientes</p>
                <p className="text-xs mt-1">
                  Ejecuta el Matching IA para encontrar oportunidades
                </p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Título</TableHead>
                      <TableHead className="font-semibold">Score</TableHead>
                      <TableHead className="font-semibold">
                        Institución
                      </TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchesData.map((item) => (
                      <TableRow key={item.codigo} className="data-row">
                        <TableCell>
                          <p className="font-medium text-sm line-clamp-1 max-w-[200px]">
                            {item.nombre}
                          </p>
                        </TableCell>
                        <TableCell>
                          {item.match_score ? (
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-firmavb-green"
                                  style={{
                                    width: `${item.match_score}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm font-mono font-medium">
                                {item.match_score}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground line-clamp-1 max-w-[140px]">
                            {item.institucion}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              item.tipo === "Compra Ágil"
                                ? "bg-firmavb-blue text-white"
                                : "bg-firmavb-green text-white"
                            }
                          >
                            {item.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to={
                                item.tipo === "Compra Ágil"
                                  ? `/compras-agiles/${item.codigo}`
                                  : `/licitaciones/${item.codigo}`
                              }
                            >
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Link to="/mis-oportunidades">
                              <Button variant="ghost" size="sm">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Activity Feed */}
      <ActivityFeed />
    </div>
  );
}

// --- KPI Card Component ---
interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: "blue" | "green" | "amber" | "emerald";
  trend: number | null;
}

function KPICard({ title, value, icon: Icon, color, trend }: KPICardProps) {
  const colorClasses = {
    blue: "text-firmavb-blue bg-firmavb-blue/10",
    green: "text-firmavb-green bg-firmavb-green/10",
    amber: "text-firmavb-amber bg-firmavb-amber/10",
    emerald: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
  };

  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== null && trend !== undefined && (
            <Badge
              variant="outline"
              className={
                trend >= 0
                  ? "text-firmavb-green border-firmavb-green/30"
                  : "text-firmavb-red border-firmavb-red/30"
              }
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trend >= 0 ? "+" : ""}
              {trend}%
            </Badge>
          )}
        </div>
        <p className="text-2xl font-heading font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
      </CardContent>
    </Card>
  );
}
