import { useMemo, useState } from "react";
import {
  Users, Package, Building2, DollarSign, FileText,
  Trophy, Crown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ReportHero } from "@/components/reportes/ReportHero";
import { formatCompact, formatNumber } from "@/hooks/useReportes";
import { useBIStats, useTopProveedores, useProveedorDetalle, rangoDePreset, type BIProveedor, type PeriodoPreset } from "@/hooks/useBI";
import { PeriodoSelector } from "@/components/reportes/PeriodoSelector";

/** Fila del ranking: el proveedor más su posición por monto (fija aunque se reordene la tabla). */
type FilaProveedor = BIProveedor & { posicion: number };

const COLUMNAS_PROVEEDORES: DataTableColumn<FilaProveedor>[] = [
  {
    id: "posicion",
    header: "#",
    headerClassName: "w-8",
    className: "text-muted-foreground",
    sortValue: (p) => p.posicion,
    cell: (p) => (p.posicion === 1 ? <Crown className="h-4 w-4 text-amber-500" /> : p.posicion),
  },
  {
    id: "proveedor",
    header: "Proveedor",
    className: "font-medium max-w-[220px] truncate",
    sortValue: (p) => p.proveedor,
    cell: (p) => p.proveedor,
  },
  { id: "ordenes", header: "Órdenes", align: "right", sortValue: (p) => p.ordenes, cell: (p) => formatNumber(p.ordenes) },
  { id: "compradores", header: "Compradores", align: "right", sortValue: (p) => p.compradores, cell: (p) => formatNumber(p.compradores) },
  {
    id: "monto",
    header: "Monto",
    align: "right",
    className: "font-mono text-sm",
    sortValue: (p) => p.monto_total,
    exportValue: (p) => Math.round(p.monto_total),
    cell: (p) => formatCompact(p.monto_total),
  },
  {
    id: "share",
    header: "Mercado",
    headerClassName: "w-[130px]",
    sortValue: (p) => p.share,
    exportValue: (p) => (p.share == null ? "" : `${p.share.toFixed(1)}%`),
    cell: (p) => (
      <div className="flex items-center gap-2">
        <Progress value={Math.min(100, p.share ?? 0)} className="h-1.5 w-16" />
        <span className="text-xs text-muted-foreground w-10">{(p.share ?? 0).toFixed(1)}%</span>
      </div>
    ),
  },
];

export default function ReporteProveedores() {
  const [sel, setSel] = useState<BIProveedor | null>(null);
  const [preset, setPreset] = useState<PeriodoPreset>("total");
  const periodo = rangoDePreset(preset);

  const { data: stats } = useBIStats(periodo);
  const { data, isLoading } = useTopProveedores("", 200, periodo);
  const filas = useMemo<FilaProveedor[]>(() => (data?.items ?? []).map((p, i) => ({ ...p, posicion: i + 1 })), [data]);
  const { data: detalle, isLoading: detalleLoading } = useProveedorDetalle(sel?.proveedor ?? null);

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportHero
        title="Proveedores"
        subtitle="Quién le vende al Estado: ranking por monto adjudicado, participación de mercado y a quién le venden"
        icon={Users}
        kpis={[
          { label: "Proveedores", value: stats ? formatNumber(stats.proveedores) : "…", icon: Users },
          { label: "Transado", value: stats ? formatCompact(stats.monto_total) : "…", icon: DollarSign },
          { label: "Órdenes", value: stats ? formatNumber(stats.ordenes) : "…", icon: FileText },
          { label: "Compradores", value: stats ? formatNumber(stats.compradores) : "…", icon: Building2 },
        ]}
        right={<PeriodoSelector value={preset} onChange={setPreset} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Ranking */}
        <Card className="lg:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking de proveedores</CardTitle>
            <CardDescription>Por monto adjudicado y participación de mercado. Haz clic para ver el detalle.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable<FilaProveedor>
              storageKey="reporte-proveedores"
              rows={filas}
              rowKey={(p) => p.proveedor}
              columns={COLUMNAS_PROVEEDORES}
              loading={isLoading}
              itemLabel="proveedores"
              searchText={(p) => p.proveedor}
              searchPlaceholder="Buscar proveedor…"
              defaultSort={{ id: "monto", dir: "desc" }}
              exportFileName="reporte_proveedores"
              emptyMessage="Aún no hay datos para mostrar."
              maxHeight="68vh"
              onRowClick={(p) => setSel(p)}
              rowClassName={(p) => (sel?.proveedor === p.proveedor ? "bg-primary/5" : undefined)}
            />
          </CardContent>
        </Card>

        {/* Detalle */}
        <div className="lg:col-span-2">
          {!sel ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-20 text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Elige un proveedor</h3>
                <p className="text-sm max-w-xs mx-auto">Verás qué productos vende y a qué instituciones les vende más.</p>
              </CardContent>
            </Card>
          ) : (
            <div key={sel.proveedor} className="space-y-4 animate-slide-in">
              <div>
                <h2 className="text-lg font-bold leading-tight">{sel.proveedor}</h2>
                <p className="text-sm text-muted-foreground">
                  {formatCompact(sel.monto_total)} · {formatNumber(sel.ordenes)} órdenes · {formatNumber(sel.compradores)} compradores · {(sel.share ?? 0).toFixed(1)}% del mercado
                </p>
                {periodo && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    El desglose de productos y compradores es histórico total (no filtrado por período).
                  </p>
                )}
              </div>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Qué vende</CardTitle></CardHeader>
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
                    ) : <p className="text-sm text-muted-foreground py-4 text-center">Sin líneas de producto aún</p>}
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> A quién le vende</CardTitle></CardHeader>
                <CardContent>
                  {detalleLoading ? <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                    : detalle?.compradores?.length ? (
                      <div className="space-y-1.5">
                        {detalle.compradores.map((c, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{c.comprador}</span>
                            <span className="font-mono text-muted-foreground shrink-0">{formatCompact(c.monto)}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground py-4 text-center">Sin compradores aún</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
