import { useState, useMemo } from "react";
import { Swords, Download, Search, Building2, Package, Crown, Target, DollarSign, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportHero } from "@/components/reportes/ReportHero";
import { formatCurrency, formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import { useBIStats, useTopProveedores, useProveedorDetalle, rangoDePreset, type BIProveedor, type PeriodoPreset } from "@/hooks/useBI";
import { PeriodoSelector } from "@/components/reportes/PeriodoSelector";

export default function ReporteCompetidores() {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<BIProveedor | null>(null);
  const [preset, setPreset] = useState<PeriodoPreset>("total");
  const periodo = rangoDePreset(preset);

  const { data: stats } = useBIStats(periodo);
  const { data, isLoading } = useTopProveedores(search, 60, periodo);
  const items = data?.items ?? [];
  const { data: detalle, isLoading: detalleLoading } = useProveedorDetalle(sel?.proveedor ?? null);

  // Concentración: participación acumulada del top 5 (sobre el mercado total).
  const top5 = useMemo(() => (search ? null : items.slice(0, 5).reduce((s, p) => s + (p.share ?? 0), 0)), [items, search]);

  const handleExport = () => exportToCSV(items.map((p, i) => ({
    Rank: i + 1, Competidor: p.proveedor, "Monto adjudicado": p.monto_total,
    "Participación %": p.share ?? "", Órdenes: p.ordenes,
  })), "reporte_competidores");

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Competidores"
        subtitle="Inteligencia competitiva: quién domina el mercado público y qué tan concentrado está"
        icon={Swords}
        accent="red"
        kpis={[
          { label: "Competidores", value: stats ? formatNumber(stats.proveedores) : "…", icon: Swords },
          { label: "Concentración top 5", value: top5 != null ? `${top5.toFixed(1)}%` : "—", icon: PieChart },
          { label: "Transado", value: stats ? formatCompact(stats.monto_total) : "…", icon: DollarSign },
          { label: "Líder", value: items[0]?.proveedor ? `${(items[0].share ?? 0).toFixed(1)}%` : "…", icon: Crown },
        ]}
        right={<PeriodoSelector value={preset} onChange={setPreset} />}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar competidor…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!items.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Ranking con barras de participación */}
        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Participación de mercado</CardTitle>
            <CardDescription>Ranking por monto adjudicado en el mercado público. Haz clic para el detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">Sin competidores para “{search}”.</p>
            ) : (
              <div className="space-y-2.5 max-h-[68vh] overflow-auto pr-1">
                {items.map((p, i) => {
                  const active = sel?.proveedor === p.proveedor;
                  return (
                    <button key={p.proveedor} type="button" onClick={() => setSel(p)}
                      className={`w-full text-left rounded-lg border p-3 transition-all hover:border-primary/40 ${active ? "border-primary bg-primary/5" : "border-border/60"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-5 shrink-0">{i === 0 ? <Crown className="h-4 w-4 text-amber-500" /> : `#${i + 1}`}</span>
                          <span className="font-medium text-sm truncate">{p.proveedor}</span>
                        </span>
                        <span className="font-mono text-sm shrink-0">{formatCompact(p.monto_total)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 pl-7">
                        <Progress value={Math.min(100, p.share ?? 0)} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-12 text-right">{(p.share ?? 0).toFixed(1)}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalle del competidor */}
        <div className="lg:col-span-2">
          {!sel ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-20 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Analiza a un competidor</h3>
                <p className="text-sm max-w-xs mx-auto">Descubre qué vende y a qué instituciones les gana.</p>
              </CardContent>
            </Card>
          ) : (
            <div key={sel.proveedor} className="space-y-4 animate-slide-in">
              <div>
                <h2 className="text-lg font-bold leading-tight">{sel.proveedor}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatCompact(sel.monto_total)} · {(sel.share ?? 0).toFixed(1)}% del mercado · {formatNumber(sel.compradores)} clientes
                </p>
                {periodo && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    El desglose de productos y clientes es histórico total (no filtrado por período).
                  </p>
                )}
              </div>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Sus productos fuertes</CardTitle></CardHeader>
                <CardContent>
                  {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    : detalle?.productos?.length ? (
                    <div className="space-y-1.5">
                      {detalle.productos.slice(0, 8).map((pr, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{pr.producto}</span>
                          <span className="font-mono text-muted-foreground shrink-0">{formatCompact(pr.monto)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground py-4 text-center">Sin datos aún</p>}
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> Sus clientes</CardTitle></CardHeader>
                <CardContent>
                  {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    : detalle?.compradores?.length ? (
                    <div className="space-y-1.5">
                      {detalle.compradores.slice(0, 8).map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{c.comprador}</span>
                          <span className="font-mono text-muted-foreground shrink-0">{formatCompact(c.monto)}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground py-4 text-center">Sin datos aún</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
