import { useState } from "react";
import { Package, Download, Search, Trophy, Users, DollarSign, Building2, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportHero } from "@/components/reportes/ReportHero";
import { formatCurrency, formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import { useCMStats, useCMProductos, useCMProductoDetalle, type CMProducto } from "@/hooks/useConvenioMarco";

export default function ReporteProductos() {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<CMProducto | null>(null);

  const { data: stats } = useCMStats(null);            // todos los orígenes
  const { data, isLoading } = useCMProductos(search, null);
  const productos = data?.items ?? [];
  const { data: detalle, isLoading: detalleLoading } = useCMProductoDetalle(sel?.producto_key ?? null, null);

  const handleExport = () => exportToCSV(productos.map((p) => ({
    Producto: p.producto, Código: p.codigo_producto || "—", Proveedores: p.proveedores,
    Compradores: p.compradores, "Precio prom": p.precio_prom ? Math.round(p.precio_prom) : "", "Monto total": p.monto_total,
  })), "reporte_productos");

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Productos"
        subtitle="Qué demanda el Estado: productos por monto transado, precio de referencia y quién los vende y compra"
        icon={Package}
        accent="green"
        kpis={[
          { label: "Productos", value: stats ? formatNumber(stats.productos) : "…", icon: Package },
          { label: "Transado", value: stats ? formatCompact(stats.monto_total) : "…", icon: DollarSign },
          { label: "Proveedores", value: stats ? formatNumber(stats.proveedores) : "…", icon: Trophy },
          { label: "Compradores", value: stats ? formatNumber(stats.compradores) : "…", icon: Building2 },
        ]}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar producto (ej: papel, notebook, guantes)…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!productos.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <p className="text-sm text-muted-foreground px-1">
            {isLoading ? "Buscando…" : <><span className="font-semibold text-foreground">{formatNumber(data?.total ?? 0)}</span> productos</>}
          </p>
          {isLoading ? (
            <div className="space-y-2">{[...Array(7)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : productos.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-10 text-center text-muted-foreground text-sm">Sin productos para “{search}”.</CardContent></Card>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {productos.map((p) => {
                const active = sel?.producto_key === p.producto_key;
                return (
                  <button key={p.producto_key} type="button" onClick={() => setSel(p)}
                    className={`w-full text-left rounded-lg border p-3 transition-all hover:border-primary/50 ${active ? "border-primary bg-primary/5" : "border-border/60"}`}>
                    <p className="font-medium text-sm line-clamp-2">{p.producto}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Trophy className="h-3 w-3" />{p.proveedores}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.compradores}</span>
                      <span className="font-medium text-foreground ml-auto">{formatCompact(p.monto_total)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          {!sel ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-20 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Elige un producto</h3>
                <p className="text-sm max-w-md mx-auto">Verás su precio de referencia, quién lo vende y quién lo compra.</p>
              </CardContent>
            </Card>
          ) : (
            <div key={sel.producto_key} className="space-y-4 animate-slide-in">
              <div>
                <h2 className="text-lg font-bold leading-tight">{sel.producto}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {sel.codigo_producto && <span className="inline-flex items-center gap-1"><Tag className="h-3 w-3" />{sel.codigo_producto}</span>}
                  <span>Precio prom: <b className="text-foreground">{sel.precio_prom ? formatCurrency(Math.round(sel.precio_prom)) : "—"}</b></span>
                  <span>{formatCompact(sel.monto_total)} transado</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> Quién lo vende</CardTitle></CardHeader>
                  <CardContent>
                    {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                      : detalle?.proveedores?.length ? (
                        <div className="space-y-1.5">
                          {detalle.proveedores.slice(0, 8).map((pr, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{pr.proveedor}</span>
                              <span className="font-mono text-muted-foreground shrink-0">{pr.precio_prom ? formatCurrency(Math.round(pr.precio_prom)) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p>}
                  </CardContent>
                </Card>
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Quién lo compra</CardTitle></CardHeader>
                  <CardContent>
                    {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                      : detalle?.compradores?.length ? (
                        <div className="space-y-1.5">
                          {detalle.compradores.slice(0, 8).map((c, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate">{c.comprador}</span>
                              <span className="font-mono text-muted-foreground shrink-0">{formatCompact(c.monto_total)}</span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p>}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
