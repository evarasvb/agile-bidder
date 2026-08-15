import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Download, Search, Package, Building2, Trophy, Users,
  TrendingDown, Tag, Inbox, Crown, Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { FirmaVBHeader } from "@/components/layout/FirmaVBHeader";
import { formatCurrency, formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import {
  useCMProductos, useCMProductoDetalle, useCMProductoTendencia,
  type TipoOrigenCM, type CMProducto,
} from "@/hooks/useConvenioMarco";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function labelMes(mes: string): string {
  const d = new Date(mes);
  if (isNaN(d.getTime())) return mes;
  return `${MESES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

const TIPOS: { value: string; label: string }[] = [
  { value: "convenio_marco", label: "Convenio Marco" },
  { value: "compra_agil", label: "Compra Ágil" },
  { value: "trato_directo", label: "Trato Directo" },
  { value: "__all__", label: "Todos los orígenes" },
];

function precioRango(p: { precio_min: number | null; precio_max: number | null; precio_prom: number | null }) {
  if (p.precio_min == null) return "—";
  if (p.precio_min === p.precio_max) return formatCurrency(p.precio_min);
  return `${formatCurrency(p.precio_min)} – ${formatCurrency(p.precio_max ?? p.precio_min)}`;
}

function KPI({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold truncate">{value}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReporteConvenioMarco() {
  const [tipoSel, setTipoSel] = useState<string>("convenio_marco");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CMProducto | null>(null);

  const tipo: TipoOrigenCM = tipoSel === "__all__" ? null : (tipoSel as TipoOrigenCM);
  const { data, isLoading } = useCMProductos(search, tipo);
  const productos = data?.items ?? [];
  const total = data?.total ?? 0;

  const { data: detalle, isLoading: detalleLoading } = useCMProductoDetalle(selected?.producto_key ?? null, tipo);
  const { data: tendencia = [], isLoading: tendenciaLoading } = useCMProductoTendencia(selected?.producto_key ?? null, tipo);
  const serie = tendencia.map((t) => ({ ...t, label: labelMes(t.mes) }));

  // El proveedor con menor precio promedio = el precio a vencer.
  const mejorPrecio = detalle?.proveedores?.length
    ? Math.min(...detalle.proveedores.map((p) => p.precio_prom ?? Infinity))
    : null;

  const handleExport = () => {
    exportToCSV(
      productos.map((p) => ({
        Producto: p.producto,
        Codigo: p.codigo_producto || "—",
        Competidores: p.proveedores,
        Compradores: p.compradores,
        "Precio Min": p.precio_min ?? "",
        "Precio Prom": p.precio_prom ? Math.round(p.precio_prom) : "",
        "Precio Max": p.precio_max ?? "",
        "Monto Total": p.monto_total,
      })),
      "convenio_marco_productos"
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link to="/reportes">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
          </Link>
          <FirmaVBHeader
            title="Convenio Marco"
            subtitle="Explora productos: precios, competidores y compradores del mercado público"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={tipoSel} onValueChange={(v) => { setTipoSel(v); setSelected(null); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!productos.length}>
            <Download className="h-4 w-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Busca un producto (ej: papel, computador, guantes, tóner)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Lista de productos */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Buscando…" : <><span className="font-semibold text-foreground">{formatNumber(total)}</span> productos</>}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : productos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Sin productos para “{search}”</p>
                <p className="text-sm">Prueba otro término. La base se sigue nutriendo en segundo plano.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {productos.map((p) => {
                const active = selected?.producto_key === p.producto_key;
                return (
                  <button
                    type="button"
                    key={p.producto_key}
                    onClick={() => setSelected(p)}
                    className={`w-full text-left rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-muted/40 ${
                      active ? "border-primary bg-primary/5" : "border-border/60"
                    }`}
                  >
                    <p className="font-medium text-sm line-clamp-2">{p.producto}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {p.codigo_producto && (
                        <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{p.codigo_producto}</span>
                      )}
                      <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{p.proveedores} prov.</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.compradores} comp.</span>
                      <span className="font-medium text-foreground">{precioRango(p)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Ficha del producto */}
        <div className="lg:col-span-3">
          {!selected ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-20 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Elige un producto</h3>
                <p className="text-sm max-w-md mx-auto">
                  Selecciona un producto de la lista para ver su precio de referencia, quién lo vende
                  (competidores) y quién lo compra (instituciones).
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold leading-tight">{selected.producto}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  {selected.codigo_producto && <Badge variant="outline"><Tag className="h-3 w-3 mr-1" />{selected.codigo_producto}</Badge>}
                  {selected.ultima_compra && <span>Última compra: {new Date(selected.ultima_compra).toLocaleDateString("es-CL")}</span>}
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Precio sugerido" value={selected.precio_prom ? formatCurrency(Math.round(selected.precio_prom)) : "—"} icon={TrendingDown} />
                <KPI label="Rango" value={precioRango(selected)} icon={Tag} />
                <KPI label="Competidores" value={formatNumber(selected.proveedores)} icon={Trophy} />
                <KPI label="Monto transado" value={formatCompact(selected.monto_total)} icon={Building2} />
              </div>

              {/* Tendencia de precio */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Tendencia de precio</CardTitle>
                  <CardDescription>Precio promedio por mes (banda: mínimo–máximo pagado).</CardDescription>
                </CardHeader>
                <CardContent>
                  {tendenciaLoading ? (
                    <Skeleton className="h-[240px] w-full" />
                  ) : serie.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={54}
                          tickFormatter={(v) => formatCompact(Number(v))}
                        />
                        <RechartsTooltip
                          formatter={(value: number, name: string) => [formatCurrency(Number(value)),
                            name === "precio_prom" ? "Promedio" : name === "precio_max" ? "Máximo" : "Mínimo"]}
                          labelFormatter={(l) => `Mes: ${l}`}
                          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                        />
                        <Area type="monotone" dataKey="precio_max" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.08} />
                        <Area type="monotone" dataKey="precio_min" stroke="none" fill="hsl(var(--card))" fillOpacity={1} />
                        <Line type="monotone" dataKey="precio_prom" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : serie.length === 1 ? (
                    <div className="py-6 text-center">
                      <p className="text-2xl font-bold">{formatCurrency(serie[0].precio_prom)}</p>
                      <p className="text-sm text-muted-foreground">
                        Promedio de {serie[0].label} · {serie[0].ordenes} orden{serie[0].ordenes === 1 ? "" : "es"} · rango{" "}
                        {formatCurrency(serie[0].precio_min ?? serie[0].precio_prom)}–{formatCurrency(serie[0].precio_max ?? serie[0].precio_prom)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">La curva aparece cuando haya compras en más de un mes.</p>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                      <Inbox className="h-4 w-4" /> Sin historial de precio aún
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Competidores */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Competidores (quién lo vende)</CardTitle>
                  <CardDescription>Ordenados por monto. El precio más bajo es el que hay que vencer.</CardDescription>
                </CardHeader>
                <CardContent>
                  {detalleLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : detalle?.proveedores?.length ? (
                    <div className="rounded-lg border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Proveedor</TableHead>
                            <TableHead className="text-right">Órdenes</TableHead>
                            <TableHead className="text-right">Precio prom.</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.proveedores.map((pr, i) => {
                            const esMejor = pr.precio_prom != null && pr.precio_prom === mejorPrecio;
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-medium max-w-[220px] truncate">
                                  <span className="flex items-center gap-1">
                                    {esMejor && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                    {pr.proveedor}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">{pr.lineas}</TableCell>
                                <TableCell className={`text-right font-mono ${esMejor ? "text-emerald-600 font-semibold" : ""}`}>
                                  {pr.precio_prom ? formatCurrency(Math.round(pr.precio_prom)) : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">{formatCompact(pr.monto_total)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                      <Inbox className="h-4 w-4" /> Sin competidores registrados aún
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Compradores */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Compradores (quién lo compra)</CardTitle>
                  <CardDescription>Instituciones que más han comprado este producto.</CardDescription>
                </CardHeader>
                <CardContent>
                  {detalleLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : detalle?.compradores?.length ? (
                    <div className="rounded-lg border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Institución</TableHead>
                            <TableHead className="text-right">Órdenes</TableHead>
                            <TableHead className="text-right">Precio prom.</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.compradores.map((c, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium max-w-[220px] truncate">{c.comprador}</TableCell>
                              <TableCell className="text-right">{c.lineas}</TableCell>
                              <TableCell className="text-right font-mono">{c.precio_prom ? formatCurrency(Math.round(c.precio_prom)) : "—"}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{formatCompact(c.monto_total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                      <Inbox className="h-4 w-4" /> Sin compradores registrados aún
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
