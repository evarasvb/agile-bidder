import { useState } from "react";
import {
  Target,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Loader2,
  Sparkles,
  RefreshCw,
  Inbox,
  AlertTriangle,
  Info,
  BarChart3,
  Newspaper,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useDashboardKPIs,
  usePipelineByStage,
  useOportunidadesPorTipo,
  useNoticiasInstituciones,
} from "@/hooks/useDashboardPrincipal";
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
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  MetricCardSkeleton,
  ChartSkeleton,
} from "@/components/dashboard/DashboardSkeleton";
import { PrimerosPasos } from "@/components/dashboard/PrimerosPasos";
import { ActivationOnboarding } from "@/components/dashboard/ActivationOnboarding";
import { DatoCuriosoCard } from "@/components/dashboard/DatoCuriosoCard";
import { TutorialBienvenida } from "@/components/dashboard/TutorialBienvenida";
import { ResumenEjecutivo } from "@/components/dashboard/ResumenEjecutivo";
import { PanelProveedorCard } from "@/components/dashboard/PanelProveedorCard";
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";
import { Skeleton } from "@/components/ui/skeleton";
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
  const navigate = useNavigate();
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
  const { data: noticiasData, isLoading: noticiasLoading } =
    useNoticiasInstituciones();
  // "Buscar oportunidades para mí": corre el match del PROPIO cliente y lleva a
  // la bandeja. Antes era "Ejecutar Matching IA" con un diálogo que contaba
  // oportunidades de TODO el sistema (jerga + números ajenos al cliente).
  const [isMatching, setIsMatching] = useState(false);
  const handleBuscarParaMi = async () => {
    setIsMatching(true);
    try {
      await supabase.rpc("generar_matches_ca_para_mi");
      toast({
        title: "¡Listo!",
        description: "Buscamos coincidencias nuevas con tu inventario.",
      });
      navigate("/oportunidades");
    } catch {
      toast({
        title: "No se pudo buscar ahora",
        description: "El robot lo hará automáticamente en unos minutos.",
      });
    } finally {
      setIsMatching(false);
    }
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
      {/* Onboarding de activación: 3 pasos core para estar operativo */}
      <ActivationOnboarding />

      {/* Guía de primeros pasos para clientes nuevos (se auto-oculta al completar) */}
      <PrimerosPasos />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <FirmaVBHeader
          title="Dashboard"
          subtitle="Resumen de oportunidades y rendimiento"
        />
        <div className="flex items-center gap-3">
          <TutorialBienvenida />
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleBuscarParaMi}
                disabled={isMatching}
                className="bg-firmavb-blue hover:bg-firmavb-blue/90 text-white shadow-lg"
              >
                {isMatching ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Buscar oportunidades para mí
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Cruza las compras del Estado con tu inventario y te lleva a tu bandeja
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Resumen ejecutivo del negocio (datos reales del pipeline) */}
      <ResumenEjecutivo />

      {/* Panel del proveedor: qué vende según sus OC, keywords sugeridas y clientes a seguir */}
      <PanelProveedorCard />

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

      {/* (Se eliminó la fila de 4 KPI de mercado: duplicaba y hasta contradecía
          al Resumen Ejecutivo de arriba — dos "Tasa de éxito" con fuentes
          distintas a centímetros de distancia. El Resumen habla del negocio
          DEL cliente, que es lo que importa.) */}

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
              <p className="text-xs text-muted-foreground">
                Cuántas oportunidades tienes en cada estado del proceso.
              </p>
            </CardHeader>
            <CardContent>
              {!pipelineData?.length ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                  <Inbox className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">Sin datos de pipeline</p>
                </div>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(280, pipelineData.length * 34)}
                >
                  {/* Barras horizontales: con muchas etapas, los nombres se leen
                      completos a la izquierda en vez de encimarse abajo. */}
                  <BarChart
                    data={pipelineData}
                    layout="vertical"
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="etapa"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                      axisLine={false}
                      tickLine={false}
                      width={130}
                      interval={0}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [value, "Oportunidades"]}
                    />
                    <Bar
                      dataKey="count"
                      name="Oportunidades"
                      fill="hsl(var(--firmavb-blue))"
                      radius={[0, 4, 4, 0]}
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
                Oportunidades abiertas por tipo
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Reparto entre Compras Ágiles y Licitaciones.
              </p>
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
                    <Legend
                      formatter={(value: string, entry: any) =>
                        `${value} (${entry?.payload?.count ?? 0})`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <DatoCuriosoCard />

      {/* Row 4: Noticias de tus instituciones */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading font-semibold flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-firmavb-blue" />
            Noticias de tus instituciones
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Lo último de las instituciones donde ya postulaste o tienes match. Para saber qué pasa con ellas antes de tu próxima oferta.
          </p>
        </CardHeader>
        <CardContent>
          {noticiasLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !noticiasData?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Todavía no hay noticias para mostrar</p>
              <p className="text-xs mt-1">
                Aparecen apenas postules o tengas match con alguna institución
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {noticiasData.map((n) => (
                <a
                  key={n.noticia_id}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs font-semibold text-firmavb-blue truncate mb-1">
                    {n.institucion}
                  </p>
                  <p className="text-sm line-clamp-2">{n.texto}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {n.fuente.replace(/^Noticia:\s*/, "")}
                    {n.fecha && ` · ${new Date(n.fecha).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}`}
                  </p>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
  subtitle?: string;
}

function KPICard({ title, value, icon: Icon, color, trend, subtitle }: KPICardProps) {
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
        {subtitle && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
