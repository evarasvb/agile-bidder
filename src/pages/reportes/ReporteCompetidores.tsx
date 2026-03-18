import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Swords, Inbox } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompetidoresReport,
  formatCurrency,
  formatCompact,
  formatPercent,
  formatNumber,
  exportToCSV,
  CHART_COLORS,
} from "@/hooks/useReportes";

export default function ReporteCompetidores() {
  const { data: competidores, isLoading } = useCompetidoresReport();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!competidores) return [];
    if (!search) return competidores;
    const q = search.toLowerCase();
    return competidores.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) || c.rut.toLowerCase().includes(q)
    );
  }, [competidores, search]);

  const top10Bar = useMemo(
    () =>
      (competidores || []).slice(0, 10).map((c) => ({
        nombre: c.nombre.length > 25 ? c.nombre.slice(0, 25) + "…" : c.nombre,
        monto: c.totalAdjudicado,
        ganadas: c.licitacionesGanadas,
      })),
    [competidores]
  );

  const pieData = useMemo(() => {
    if (!competidores?.length) return [];
    const top5 = competidores.slice(0, 5).map((c) => ({
      name: c.nombre.length > 20 ? c.nombre.slice(0, 20) + "…" : c.nombre,
      value: c.totalAdjudicado,
    }));
    const rest = competidores.slice(5).reduce((s, c) => s + c.totalAdjudicado, 0);
    if (rest > 0) top5.push({ name: "Otros", value: rest });
    return top5;
  }, [competidores]);

  const handleExport = () => {
    exportToCSV(
      filtered.map((c) => ({
        Competidor: c.nombre,
        RUT: c.rut,
        "Licitaciones Ganadas": c.licitacionesGanadas,
        "Total Adjudicado": c.totalAdjudicado,
        "Participación %": c.participacion.toFixed(1),
      })),
      "reporte_competidores"
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to="/reportes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <FirmaVBHeader
            title="Competidores"
            subtitle="Inteligencia competitiva de adjudicaciones públicas"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!filtered.length}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Skeleton className="h-[340px]" />
            <Skeleton className="h-[340px]" />
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      ) : !competidores?.length ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <Swords className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Aún no se han registrado adjudicaciones. Los datos de competidores
              se generan automáticamente desde los registros de adjudicación.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Competidores Identificados</p>
                <p className="text-2xl font-heading font-bold">{formatNumber(competidores.length)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Adjudicado</p>
                <p className="text-2xl font-heading font-bold">
                  {formatCompact(competidores.reduce((s, c) => s + c.totalAdjudicado, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Licitaciones Analizadas</p>
                <p className="text-2xl font-heading font-bold">
                  {formatNumber(competidores.reduce((s, c) => s + c.licitacionesGanadas, 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Top 10 Competidores por Monto Adjudicado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={top10Bar} layout="vertical" margin={{ left: 10 }}>
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
                      dataKey="nombre"
                      tick={{ fontSize: 11 }}
                      width={150}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === "monto") return [formatCurrency(value), "Monto"];
                        return [value, "Adjudicaciones"];
                      }}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="monto" name="monto" fill="hsl(var(--firmavb-red))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Participación de Mercado
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
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
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <Inbox className="h-8 w-8 mr-2 opacity-50" />
                    Sin datos
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base font-heading font-semibold">
                  Tabla de Competidores
                </CardTitle>
                <Input
                  placeholder="Buscar competidor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Competidor</TableHead>
                      <TableHead className="font-semibold">RUT</TableHead>
                      <TableHead className="font-semibold text-right">Ganadas</TableHead>
                      <TableHead className="font-semibold text-right">Licit. Únicas</TableHead>
                      <TableHead className="font-semibold text-right">Total Adjudicado</TableHead>
                      <TableHead className="font-semibold text-right">Participación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((c, i) => (
                      <TableRow key={i} className="data-row">
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {c.nombre}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.rut}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{c.licitacionesGanadas}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{c.licitacionesUnicas}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(c.totalAdjudicado)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-firmavb-red"
                                style={{ width: `${Math.min(c.participacion, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono">
                              {formatPercent(c.participacion)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron competidores
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Mostrando 50 de {filtered.length} competidores
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
