import { useState } from "react";
import { Building2, Download, Search, Package, Users, DollarSign, FileText, Crown, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportHero } from "@/components/reportes/ReportHero";
import { formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import { useBIStats, useTopCompradores, useCompradorDetalle, rangoDePreset, type BIComprador, type PeriodoPreset } from "@/hooks/useBI";
import { PeriodoSelector } from "@/components/reportes/PeriodoSelector";

export default function ReporteCompradores() {
  const [search, setSearch] = useState("");
  const [sel, setSel] = useState<BIComprador | null>(null);
  const [preset, setPreset] = useState<PeriodoPreset>("total");
  const periodo = rangoDePreset(preset);

  const { data: stats } = useBIStats(periodo);
  const { data, isLoading } = useTopCompradores(search, 80, periodo);
  const items = data?.items ?? [];
  const { data: detalle, isLoading: detalleLoading } = useCompradorDetalle(sel?.comprador ?? null);

  const handleExport = () => exportToCSV(items.map((c) => ({
    Institución: c.comprador, Órdenes: c.ordenes, Proveedores: c.proveedores,
    "Monto total": c.monto_total, "Participación %": c.share ?? "",
  })), "reporte_compradores");

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Compradores"
        subtitle="Instituciones que compran: ranking por volumen, a quién le compran y qué compran"
        icon={Landmark}
        accent="orange"
        kpis={[
          { label: "Instituciones", value: stats ? formatNumber(stats.compradores) : "…", icon: Building2 },
          { label: "Transado", value: stats ? formatCompact(stats.monto_total) : "…", icon: DollarSign },
          { label: "Órdenes", value: stats ? formatNumber(stats.ordenes) : "…", icon: FileText },
          { label: "Proveedores", value: stats ? formatNumber(stats.proveedores) : "…", icon: Users },
        ]}
        right={<PeriodoSelector value={preset} onChange={setPreset} />}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar institución…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!items.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de compradores</CardTitle>
            <CardDescription>Instituciones por monto comprado. Haz clic para el detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">{search ? `Sin instituciones para “${search}”.` : "Aún no hay datos para mostrar."}</p>
            ) : (
              <div className="rounded-lg border overflow-auto max-h-[68vh]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Institución</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="w-[130px]">Mercado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((c, i) => {
                      const active = sel?.comprador === c.comprador;
                      return (
                        <TableRow key={c.comprador} onClick={() => setSel(c)} className={`cursor-pointer ${active ? "bg-primary/5" : ""}`}>
                          <TableCell className="text-muted-foreground">{i === 0 ? <Crown className="h-4 w-4 text-amber-500" /> : i + 1}</TableCell>
                          <TableCell className="font-medium max-w-[240px] truncate">{c.comprador}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatCompact(c.monto_total)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={Math.min(100, c.share ?? 0)} className="h-1.5 w-16" />
                              <span className="text-xs text-muted-foreground w-10">{(c.share ?? 0).toFixed(1)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {!sel ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-20 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Elige una institución</h3>
                <p className="text-sm max-w-xs mx-auto">Verás qué compra y a qué proveedores les compra más (tu competencia).</p>
              </CardContent>
            </Card>
          ) : (
            <div key={sel.comprador} className="space-y-4 animate-slide-in">
              <div>
                <h2 className="text-lg font-bold leading-tight">{sel.comprador}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatCompact(sel.monto_total)} · {formatNumber(sel.ordenes)} órdenes · {formatNumber(sel.proveedores)} proveedores
                </p>
                {periodo && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    El desglose de qué compra y a quién le compra es histórico total (no filtrado por período).
                  </p>
                )}
              </div>
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Qué compra</CardTitle></CardHeader>
                <CardContent>
                  {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    : detalle?.productos?.length ? (
                      <div className="space-y-1.5">
                        {detalle.productos.map((pr, i) => (
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
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> A quién le compra</CardTitle></CardHeader>
                <CardContent>
                  {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    : detalle?.proveedores?.length ? (
                      <div className="space-y-1.5">
                        {detalle.proveedores.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{p.proveedor}</span>
                            <span className="font-mono text-muted-foreground shrink-0">{formatCompact(p.monto)}</span>
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
