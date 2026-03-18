import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Users, Inbox } from "lucide-react";
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
  useProveedoresReport,
  formatCurrency,
  formatCompact,
  formatPercent,
  exportToCSV,
  CHART_COLORS,
} from "@/hooks/useReportes";

export default function ReporteProveedores() {
  const { data: proveedores, isLoading } = useProveedoresReport();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!proveedores) return [];
    if (!search) return proveedores;
    const q = search.toLowerCase();
    return proveedores.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) || p.rut.toLowerCase().includes(q)
    );
  }, [proveedores, search]);

  const top10 = useMemo(
    () =>
      (proveedores || []).slice(0, 10).map((p) => ({
        nombre: p.nombre.length > 25 ? p.nombre.slice(0, 25) + "…" : p.nombre,
        monto: p.montoTotal,
      })),
    [proveedores]
  );

  const pieData = useMemo(() => {
    if (!proveedores?.length) return [];
    const top5 = proveedores.slice(0, 5).map((p) => ({
      name: p.nombre.length > 20 ? p.nombre.slice(0, 20) + "…" : p.nombre,
      value: p.montoTotal,
    }));
    const rest = proveedores.slice(5).reduce((sum, p) => sum + p.montoTotal, 0);
    if (rest > 0) top5.push({ name: "Otros", value: rest });
    return top5;
  }, [proveedores]);

  const handleExport = () => {
    exportToCSV(
      filtered.map((p) => ({
        Proveedor: p.nombre,
        RUT: p.rut,
        Adjudicaciones: p.adjudicaciones,
        "Monto Total": p.montoTotal,
        "Participación %": p.participacion.toFixed(1),
      })),
      "reporte_proveedores"
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
            title="Proveedores"
            subtitle="Análisis de proveedores adjudicados"
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
      ) : !proveedores?.length ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Aún no se han registrado adjudicaciones de proveedores. Los datos
              se llenarán automáticamente cuando se procesen licitaciones.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Proveedores</p>
                <p className="text-2xl font-heading font-bold">{proveedores.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Adjudicado</p>
                <p className="text-2xl font-heading font-bold">
                  {formatCompact(proveedores.reduce((s, p) => s + p.montoTotal, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Adjudicaciones</p>
                <p className="text-2xl font-heading font-bold">
                  {proveedores.reduce((s, p) => s + p.adjudicaciones, 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Top 10 Proveedores por Monto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
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
                      width={140}
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
                    <Bar dataKey="monto" fill="hsl(var(--firmavb-blue))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Concentración de Mercado
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

          {/* Filter + Table */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base font-heading font-semibold">
                  Tabla de Proveedores
                </CardTitle>
                <Input
                  placeholder="Buscar por nombre o RUT..."
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
                      <TableHead className="font-semibold">Proveedor</TableHead>
                      <TableHead className="font-semibold">RUT</TableHead>
                      <TableHead className="font-semibold text-right">Adjudicaciones</TableHead>
                      <TableHead className="font-semibold text-right">Monto Total</TableHead>
                      <TableHead className="font-semibold text-right">Participación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((p, i) => (
                      <TableRow key={i} className="data-row">
                        <TableCell className="font-medium max-w-[250px] truncate">
                          {p.nombre}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{p.rut}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{p.adjudicaciones}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(p.montoTotal)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-firmavb-blue"
                                style={{ width: `${Math.min(p.participacion, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-mono">
                              {formatPercent(p.participacion)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No se encontraron proveedores
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Mostrando 50 de {filtered.length} proveedores
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
