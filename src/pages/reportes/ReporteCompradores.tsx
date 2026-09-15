import { useMemo, useState } from "react";
import { Building2, Package, Users, DollarSign, FileText, Crown, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ReportHero } from "@/components/reportes/ReportHero";
import { formatCompact, formatNumber } from "@/hooks/useReportes";
import { useBIStats, useTopCompradores, useCompradorDetalle, rangoDePreset, type BIComprador, type PeriodoPreset } from "@/hooks/useBI";
import { PeriodoSelector } from "@/components/reportes/PeriodoSelector";

/** Fila del ranking: la institución más su posición por monto (fija aunque se reordene la tabla). */
type FilaComprador = BIComprador & { posicion: number };

const COLUMNAS_COMPRADORES: DataTableColumn<FilaComprador>[] = [
  {
    id: "posicion",
    header: "#",
    headerClassName: "w-8",
    className: "text-muted-foreground",
    sortValue: (c) => c.posicion,
    cell: (c) => (c.posicion === 1 ? <Crown className="h-4 w-4 text-amber-500" /> : c.posicion),
  },
  {
    id: "comprador",
    header: "Institución",
    className: "font-medium max-w-[240px] truncate",
    sortValue: (c) => c.comprador,
    cell: (c) => c.comprador,
  },
  { id: "ordenes", header: "Órdenes", align: "right", sortValue: (c) => c.ordenes, cell: (c) => formatNumber(c.ordenes) },
  { id: "proveedores", header: "Proveedores", align: "right", sortValue: (c) => c.proveedores, cell: (c) => formatNumber(c.proveedores) },
  {
    id: "monto",
    header: "Monto",
    align: "right",
    className: "font-mono text-sm",
    sortValue: (c) => c.monto_total,
    exportValue: (c) => Math.round(c.monto_total),
    cell: (c) => formatCompact(c.monto_total),
  },
  {
    id: "share",
    header: "Mercado",
    headerClassName: "w-[130px]",
    sortValue: (c) => c.share,
    exportValue: (c) => (c.share == null ? "" : `${c.share.toFixed(1)}%`),
    cell: (c) => (
      <div className="flex items-center gap-2">
        <Progress value={Math.min(100, c.share ?? 0)} className="h-1.5 w-16" />
        <span className="text-xs text-muted-foreground w-10">{(c.share ?? 0).toFixed(1)}%</span>
      </div>
    ),
  },
];

export default function ReporteCompradores() {
  const [sel, setSel] = useState<BIComprador | null>(null);
  const [preset, setPreset] = useState<PeriodoPreset>("total");
  const periodo = rangoDePreset(preset);

  const { data: stats } = useBIStats(periodo);
  const { data, isLoading } = useTopCompradores("", 200, periodo);
  const filas = useMemo<FilaComprador[]>(() => (data?.items ?? []).map((c, i) => ({ ...c, posicion: i + 1 })), [data]);
  const { data: detalle, isLoading: detalleLoading } = useCompradorDetalle(sel?.comprador ?? null);

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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de compradores</CardTitle>
            <CardDescription>Instituciones por monto comprado. Haz clic para el detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable<FilaComprador>
              storageKey="reporte-compradores"
              rows={filas}
              rowKey={(c) => c.comprador}
              columns={COLUMNAS_COMPRADORES}
              loading={isLoading}
              itemLabel="instituciones"
              searchText={(c) => c.comprador}
              searchPlaceholder="Buscar institución…"
              defaultSort={{ id: "monto", dir: "desc" }}
              exportFileName="reporte_compradores"
              emptyMessage="Aún no hay datos para mostrar."
              maxHeight="68vh"
              onRowClick={(c) => setSel(c)}
              rowClassName={(c) => (sel?.comprador === c.comprador ? "bg-primary/5" : undefined)}
            />
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
