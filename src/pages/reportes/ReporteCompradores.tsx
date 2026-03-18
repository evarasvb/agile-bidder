import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Building2, Inbox } from "lucide-react";
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
  useCompradoresReport,
  formatCurrency,
  formatCompact,
  formatNumber,
  exportToCSV,
  CHART_COLORS,
} from "@/hooks/useReportes";

export default function ReporteCompradores() {
  const { data: compradores, isLoading } = useCompradoresReport();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");

  const tipos = useMemo(() => {
    if (!compradores) return [];
    const set = new Set(compradores.map((c) => c.tipo));
    return Array.from(set).sort();
  }, [compradores]);

  const filtered = useMemo(() => {
    if (!compradores) return [];
    let result = compradores;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) || c.rut.toLowerCase().includes(q)
      );
    }
    if (tipoFilter) {
      result = result.filter((c) => c.tipo === tipoFilter);
    }
    return result;
  }, [compradores, search, tipoFilter]);

  const top10 = useMemo(
    () =>
      (compradores || []).slice(0, 10).map((c) => ({
        nombre: c.nombre.length > 25 ? c.nombre.slice(0, 25) + "…" : c.nombre,
        monto: c.montoTotal,
      })),
    [compradores]
  );

  const tipoPie = useMemo(() => {
    if (!compradores) return [];
    const map = new Map<string, number>();
    for (const c of compradores) {
      map.set(c.tipo, (map.get(c.tipo) || 0) + c.montoTotal);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [compradores]);

  const handleExport = () => {
    exportToCSV(
      filtered.map((c) => ({
        Institución: c.nombre,
        RUT: c.rut,
        Tipo: c.tipo,
        Región: c.region,
        "Monto Total": c.montoTotal,
        Licitaciones: c.totalLicitaciones,
        Órdenes: c.totalOrdenes,
        "Score Pago": c.scorePago ?? "—",
      })),
      "reporte_compradores"
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
            title="Compradores"
            subtitle="Análisis de instituciones compradoras"
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
      ) : !compradores?.length ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Aún no se han registrado instituciones compradoras en el sistema.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Instituciones</p>
                <p className="text-2xl font-heading font-bold">{formatNumber(compradores.length)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Monto Total Comprado</p>
                <p className="text-2xl font-heading font-bold">
                  {formatCompact(compradores.reduce((s, c) => s + c.montoTotal, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Tipos de Institución</p>
                <p className="text-2xl font-heading font-bold">{tipos.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Top 10 Compradores por Monto
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
                      width={150}
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
                    <Bar dataKey="monto" fill="hsl(var(--firmavb-amber))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Distribución por Tipo de Institución
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tipoPie.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={tipoPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {tipoPie.map((_, i) => (
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
                  Tabla de Instituciones
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Todos los tipos</option>
                    {tipos.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Buscar institución..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Institución</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold">Región</TableHead>
                      <TableHead className="font-semibold text-right">Monto Total</TableHead>
                      <TableHead className="font-semibold text-right">Licitaciones</TableHead>
                      <TableHead className="font-semibold text-right">Órdenes</TableHead>
                      <TableHead className="font-semibold text-right">Score Pago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((c) => (
                      <TableRow key={c.id} className="data-row">
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {c.nombre}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {c.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.region}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(c.montoTotal)}
                        </TableCell>
                        <TableCell className="text-right">{c.totalLicitaciones}</TableCell>
                        <TableCell className="text-right">{c.totalOrdenes}</TableCell>
                        <TableCell className="text-right">
                          {c.scorePago !== null ? (
                            <Badge
                              variant="outline"
                              className={
                                c.scorePago >= 80
                                  ? "border-firmavb-green text-firmavb-green"
                                  : c.scorePago >= 50
                                    ? "border-firmavb-amber text-firmavb-amber"
                                    : "border-firmavb-red text-firmavb-red"
                              }
                            >
                              {c.scorePago}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron instituciones
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Mostrando 50 de {filtered.length} instituciones
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
