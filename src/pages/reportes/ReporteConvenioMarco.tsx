import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, FileCheck, Inbox } from "lucide-react";
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
  useConvenioMarcoReport,
  formatCurrency,
  formatCompact,
  formatNumber,
  exportToCSV,
  CHART_COLORS,
} from "@/hooks/useReportes";

export default function ReporteConvenioMarco() {
  const { data: ordenes, isLoading } = useConvenioMarcoReport();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!ordenes) return [];
    if (!search) return ordenes;
    const q = search.toLowerCase();
    return ordenes.filter(
      (o) =>
        o.nombre.toLowerCase().includes(q) ||
        o.proveedor.toLowerCase().includes(q) ||
        o.institucion.toLowerCase().includes(q) ||
        o.codigo.toLowerCase().includes(q)
    );
  }, [ordenes, search]);

  const proveedorPie = useMemo(() => {
    if (!ordenes?.length) return [];
    const map = new Map<string, number>();
    for (const o of ordenes) {
      const key = o.proveedor;
      map.set(key, (map.get(key) || 0) + o.total);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [ordenes]);

  const topInstituciones = useMemo(() => {
    if (!ordenes?.length) return [];
    const map = new Map<string, number>();
    for (const o of ordenes) {
      const key = o.institucion;
      map.set(key, (map.get(key) || 0) + o.total);
    }
    return Array.from(map.entries())
      .map(([nombre, monto]) => ({
        nombre: nombre.length > 30 ? nombre.slice(0, 30) + "…" : nombre,
        monto,
      }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  }, [ordenes]);

  const handleExport = () => {
    exportToCSV(
      filtered.map((o) => ({
        Código: o.codigo,
        Nombre: o.nombre,
        Tipo: o.tipo,
        Total: o.total,
        Estado: o.estado,
        Proveedor: o.proveedor,
        Institución: o.institucion,
        Fecha: o.fechaCreacion || "—",
      })),
      "reporte_convenio_marco"
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
            title="Convenio Marco"
            subtitle="Análisis de órdenes de compra por convenio marco"
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
      ) : !ordenes?.length ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <FileCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No se encontraron órdenes de compra asociadas a convenio marco.
              Los datos se llenarán automáticamente cuando se importen órdenes de
              compra con tipo convenio marco.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Órdenes</p>
                <p className="text-2xl font-heading font-bold">{formatNumber(ordenes.length)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Monto Total</p>
                <p className="text-2xl font-heading font-bold">
                  {formatCompact(ordenes.reduce((s, o) => s + o.total, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Proveedores Únicos</p>
                <p className="text-2xl font-heading font-bold">
                  {new Set(ordenes.map((o) => o.proveedor)).size}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Top Instituciones por Monto
                </CardTitle>
              </CardHeader>
              <CardContent>
                {topInstituciones.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topInstituciones} layout="vertical" margin={{ left: 10 }}>
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
                        width={180}
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
                      <Bar dataKey="monto" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    <Inbox className="h-8 w-8 mr-2 opacity-50" />
                    Sin datos
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-heading font-semibold">
                  Concentración por Proveedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {proveedorPie.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={proveedorPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {proveedorPie.map((_, i) => (
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
                  Órdenes de Compra - Convenio Marco
                </CardTitle>
                <Input
                  placeholder="Buscar por código, nombre, proveedor..."
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
                      <TableHead className="font-semibold">Código</TableHead>
                      <TableHead className="font-semibold">Nombre</TableHead>
                      <TableHead className="font-semibold">Proveedor</TableHead>
                      <TableHead className="font-semibold">Institución</TableHead>
                      <TableHead className="font-semibold text-right">Total</TableHead>
                      <TableHead className="font-semibold">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((o, i) => (
                      <TableRow key={i} className="data-row">
                        <TableCell className="font-mono text-sm">{o.codigo}</TableCell>
                        <TableCell className="font-medium max-w-[180px] truncate">
                          {o.nombre}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm">
                          {o.proveedor}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                          {o.institucion}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(o.total)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {o.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No se encontraron órdenes
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Mostrando 50 de {filtered.length} órdenes
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
