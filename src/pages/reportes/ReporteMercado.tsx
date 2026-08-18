import { Download, TrendingUp, Inbox, FileText, DollarSign, Landmark, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { ReportHero } from "@/components/reportes/ReportHero";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMercadoReport,
  formatCurrency,
  formatCompact,
  formatNumber,
  exportToCSV,
  CHART_COLORS,
} from "@/hooks/useReportes";

export default function ReporteMercado() {
  const { data: mercado, isLoading } = useMercadoReport();

  const handleExportRegion = () => {
    if (!mercado) return;
    exportToCSV(
      mercado.porRegion.map((r) => ({
        Región: r.region,
        Cantidad: r.count,
        Monto: r.monto,
      })),
      "reporte_mercado_regiones"
    );
  };

  const handleExportMensual = () => {
    if (!mercado) return;
    exportToCSV(
      mercado.tendenciaMensual.map((m) => ({
        Mes: m.mes,
        Cantidad: m.count,
        Monto: m.monto,
      })),
      "reporte_mercado_tendencia"
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Mercado"
        subtitle="Vista general del mercado público: volúmenes, tendencia, regiones y tipos"
        icon={TrendingUp}
        kpis={[
          { label: "Oportunidades", value: mercado ? formatNumber(mercado.kpis.totalOportunidades) : "…", icon: Zap },
          { label: "Valor estimado", value: mercado ? formatCompact(mercado.kpis.valorTotal) : "…", icon: DollarSign },
          { label: "Licitaciones", value: mercado ? formatNumber(mercado.kpis.totalLicitaciones) : "…", icon: Landmark },
          { label: "Compras ágiles", value: mercado ? formatNumber(mercado.kpis.totalCompras) : "…", icon: FileText },
        ]}
        right={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/15" onClick={handleExportRegion} disabled={!mercado}>
              <Download className="h-4 w-4 mr-2" /> Regiones
            </Button>
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/15" onClick={handleExportMensual} disabled={!mercado}>
              <Download className="h-4 w-4 mr-2" /> Tendencia
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Skeleton className="h-[340px]" />
            <Skeleton className="h-[340px]" />
          </div>
        </div>
      ) : !mercado ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Los datos del mercado aparecerán cuando se importen licitaciones y compras ágiles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Licitaciones vs Compras Ágiles split */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Licitaciones vs Compras Ágiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Licitaciones", value: mercado.kpis.valorLicitaciones },
                        { name: "Compras Ágiles", value: mercado.kpis.valorCompras },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      <Cell fill="hsl(var(--firmavb-blue))" />
                      <Cell fill="hsl(var(--firmavb-green))" />
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number) => [formatCurrency(value), "Monto"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tendencia mensual */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Tendencia Mensual (Volumen)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mercado.tendenciaMensual.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mercado.tendenciaMensual}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                      <XAxis
                        dataKey="mes"
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="Cantidad"
                        stroke="hsl(var(--firmavb-blue))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <Inbox className="h-8 w-8 mr-2 opacity-50" />
                    Sin datos de tendencia
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tendencia mensual monto */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Tendencia Mensual (Valor)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mercado.tendenciaMensual.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={mercado.tendenciaMensual}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCompact(v)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(value: number) => [formatCurrency(value), "Monto"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="monto" name="Monto" fill="hsl(var(--firmavb-green))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                  <Inbox className="h-8 w-8 mr-2 opacity-50" />
                  Sin datos
                </div>
              )}
            </CardContent>
          </Card>

          {/* Distribución por región */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Distribución Geográfica (por Región)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mercado.porRegion.length ? (
                <ResponsiveContainer width="100%" height={Math.max(300, mercado.porRegion.length * 32)}>
                  <BarChart data={mercado.porRegion.slice(0, 16)} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => formatCompact(v)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="region"
                      tick={{ fontSize: 11 }}
                      width={180}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === "monto") return [formatCurrency(value), "Monto"];
                        return [value, "Cantidad"];
                      }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" name="Cantidad" fill="hsl(var(--firmavb-blue))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <Inbox className="h-8 w-8 mr-2 opacity-50" />
                  Sin datos regionales
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
