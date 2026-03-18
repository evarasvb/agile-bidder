import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Package, Inbox } from "lucide-react";
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
} from "recharts";
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useProductosReport,
  formatCurrency,
  formatCompact,
  formatNumber,
  exportToCSV,
} from "@/hooks/useReportes";

export default function ReporteProductos() {
  const { data: productos, isLoading } = useProductosReport();
  const [search, setSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");

  const categorias = useMemo(() => {
    if (!productos) return [];
    const set = new Set(productos.map((p) => p.categoria));
    return Array.from(set).sort();
  }, [productos]);

  const filtered = useMemo(() => {
    if (!productos) return [];
    let result = productos;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.nombre.toLowerCase().includes(q));
    }
    if (categoriaFilter) {
      result = result.filter((p) => p.categoria === categoriaFilter);
    }
    return result;
  }, [productos, search, categoriaFilter]);

  const top10 = useMemo(
    () =>
      (productos || []).slice(0, 10).map((p) => ({
        nombre: p.nombre.length > 30 ? p.nombre.slice(0, 30) + "…" : p.nombre,
        monto: p.montoTotal,
      })),
    [productos]
  );

  const handleExport = () => {
    exportToCSV(
      filtered.map((p) => ({
        Producto: p.nombre,
        Categoría: p.categoria,
        "Cantidad Total": p.cantidadTotal,
        "Monto Total": p.montoTotal,
        "Precio Promedio": p.precioPromedio,
        "Precio Mín": p.precioMin,
        "Precio Máx": p.precioMax,
        Compras: p.compras,
      })),
      "reporte_productos"
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
            title="Productos"
            subtitle="Análisis de productos en compras públicas"
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
          <Skeleton className="h-[340px]" />
          <Skeleton className="h-[400px]" />
        </div>
      ) : !productos?.length ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
              No hay datos suficientes
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Aún no se han registrado productos en compras ágiles. Los datos
              aparecerán cuando se importen compras con detalle de ítems.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Productos Únicos</p>
                <p className="text-2xl font-heading font-bold">{formatNumber(productos.length)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Monto Total</p>
                <p className="text-2xl font-heading font-bold">
                  {formatCompact(productos.reduce((s, p) => s + p.montoTotal, 0))}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Categorías</p>
                <p className="text-2xl font-heading font-bold">{categorias.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Compras</p>
                <p className="text-2xl font-heading font-bold">
                  {formatNumber(productos.reduce((s, p) => s + p.compras, 0))}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Top 10 Productos por Volumen
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
                  <Bar dataKey="monto" fill="hsl(var(--firmavb-green))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Filter + Table */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base font-heading font-semibold">
                  Tabla de Productos
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    value={categoriaFilter}
                    onChange={(e) => setCategoriaFilter(e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Todas las categorías</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Buscar producto..."
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
                      <TableHead className="font-semibold">Producto</TableHead>
                      <TableHead className="font-semibold">Categoría</TableHead>
                      <TableHead className="font-semibold text-right">Cantidad</TableHead>
                      <TableHead className="font-semibold text-right">Monto Total</TableHead>
                      <TableHead className="font-semibold text-right">Precio Prom.</TableHead>
                      <TableHead className="font-semibold text-right">Rango Precio</TableHead>
                      <TableHead className="font-semibold text-right">Compras</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.slice(0, 50).map((p, i) => (
                      <TableRow key={i} className="data-row">
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {p.nombre}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {p.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatNumber(p.cantidadTotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(p.montoTotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {p.precioPromedio > 0 ? formatCurrency(p.precioPromedio) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {p.precioMin > 0
                            ? `${formatCurrency(p.precioMin)} – ${formatCurrency(p.precioMax)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{p.compras}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!filtered.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron productos
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {filtered.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Mostrando 50 de {filtered.length} productos
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
