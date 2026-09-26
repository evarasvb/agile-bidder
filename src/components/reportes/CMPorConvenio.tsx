import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Landmark, Trophy, Users, Download } from "lucide-react";
import { formatCompact, formatNumber, exportToCSV } from "@/hooks/useReportes";
import { useCMPorConvenio, useCMConvenioDetalle, type CMConvenioFila } from "@/hooks/useConvenioMarco";

// Vista "Por convenio" del reporte Convenio Marco: cuánto se compra por cada
// convenio (Software, Alimentos, Pasajes…) en el año, quién vende y quién compra.
// El convenio oficial viene de los datos abiertos de ChileCompra (archivo mensual
// de transacciones de convenio marco, publicado ~día 11 del mes siguiente). Para el
// mes en curso, mientras no exista el archivo, se deduce del nombre de los productos
// ("estimado"); las que no calzan quedan en "Sin clasificar".

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = [ANIO_ACTUAL, ANIO_ACTUAL - 1];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function CMPorConvenio() {
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [sel, setSel] = useState<string | null>(null);
  const { data: filas = [], isLoading } = useCMPorConvenio(anio);
  const { data: detalle, isLoading: cargandoDetalle } = useCMConvenioDetalle(sel, anio);

  const totalMonto = filas.reduce((s, f) => s + Number(f.monto_total || 0), 0);
  const totalOcs = filas.reduce((s, f) => s + Number(f.ocs || 0), 0);

  const columnas: DataTableColumn<CMConvenioFila>[] = [
    { id: "convenio", header: "Convenio", sortValue: (f) => f.convenio, cell: (f) => (
      <div className="flex flex-col">
        <button type="button" className={`text-left font-medium hover:underline ${f.convenio === sel ? "text-primary" : ""}`} onClick={() => setSel(f.convenio)}>{f.convenio}</button>
        <span className="text-[11px] text-muted-foreground">
          {f.codigo ? <>Convenio {f.codigo}</> : null}
          {f.codigo && f.estimadas > 0 ? " · " : null}
          {f.estimadas > 0 ? <span title="Órdenes del mes en curso clasificadas por el nombre de sus productos; se corrigen cuando ChileCompra publica el archivo oficial.">{f.codigo ? `${formatNumber(f.estimadas)} estimadas` : "estimado"}</span> : null}
        </span>
      </div>
    ) },
    { id: "ocs", header: "Órdenes", align: "right", className: "font-mono text-sm", sortValue: (f) => f.ocs, cell: (f) => formatNumber(f.ocs) },
    { id: "monto", header: "Monto (con IVA)", align: "right", className: "font-mono text-sm", sortValue: (f) => f.monto_total, cell: (f) => formatCompact(Number(f.monto_total)) },
    { id: "part", header: "% del total", align: "right", className: "font-mono text-sm", sortValue: (f) => f.participacion ?? 0, cell: (f) => f.participacion != null ? `${f.participacion}%` : "—" },
    { id: "prov", header: "Proveedores", align: "right", className: "font-mono text-sm", sortValue: (f) => f.proveedores ?? 0, cell: (f) => f.proveedores != null ? formatNumber(f.proveedores) : "—" },
    { id: "org", header: "Compradores", align: "right", className: "font-mono text-sm", sortValue: (f) => f.organismos ?? 0, cell: (f) => f.organismos != null ? formatNumber(f.organismos) : "—" },
  ];

  const exportar = () => exportToCSV(
    filas.map((f) => ({ Convenio: f.convenio, Codigo: f.codigo ?? "", Ordenes: f.ocs, Estimadas: f.estimadas, "Monto con IVA": Math.round(Number(f.monto_total)), "% del total": f.participacion ?? "", Proveedores: f.proveedores ?? "", Compradores: f.organismos ?? "" })),
    `convenio_marco_por_convenio_${anio}`,
  );

  const meses = (detalle?.meses || []).map((m) => ({ mes: MESES[new Date(m.mes + "T12:00:00").getMonth()], ocs: m.ocs, monto: Number(m.monto_total) }));
  const topProv = (detalle?.top || []).filter((t) => t.tipo === "proveedor");
  const topComp = (detalle?.top || []).filter((t) => t.tipo === "comprador");

  return (
    <div className="space-y-4">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-sky-600" /> Compras por convenio</CardTitle>
            <CardDescription>
              {isLoading ? "Calculando…" : <>{formatNumber(totalOcs)} órdenes y {formatCompact(totalMonto)} con IVA en {anio}. Haz clic en un convenio para ver quién vende y quién compra.</>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(anio)} onValueChange={(v) => { setAnio(Number(v)); setSel(null); }}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>{ANIOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportar} disabled={!filas.length}><Download className="h-4 w-4 mr-2" /> CSV</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <DataTable<CMConvenioFila> columns={columnas} rows={filas} rowKey={(f) => f.convenio} emptyMessage="Sin datos para este año." />
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Convenio oficial según los datos abiertos de ChileCompra (archivo mensual que se publica alrededor del día 11 del mes siguiente). Las órdenes del mes en curso se clasifican por el nombre de sus productos y se marcan como estimadas; "Sin clasificar" agrupa las que no calzan con ningún convenio conocido.
          </p>
        </CardContent>
      </Card>

      {sel && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{sel} · {anio}</CardTitle>
            <CardDescription>Evolución mensual, quién lo vende y quién lo compra.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {cargandoDetalle ? <Skeleton className="h-56 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={meses} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11 }} width={70} />
                    <RechartsTooltip formatter={(v: number, k: string) => k === "monto" ? [formatCompact(v), "Monto"] : [formatNumber(v), "Órdenes"]} />
                    <Bar dataKey="monto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid gap-6 md:grid-cols-2">
                  <TopLista titulo="Quién vende" icono={Trophy} filas={topProv} />
                  <TopLista titulo="Quién compra" icono={Users} filas={topComp} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TopLista({ titulo, icono: Icono, filas }: { titulo: string; icono: typeof Trophy; filas: { nombre: string | null; ocs: number; monto_total: number }[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold flex items-center gap-2 mb-2"><Icono className="h-4 w-4" /> {titulo}</h4>
      {filas.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos.</p> : (
        <ol className="space-y-1.5">
          {filas.map((f, i) => (
            <li key={`${f.nombre}-${i}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate"><span className="text-muted-foreground mr-2">{i + 1}.</span>{f.nombre || "—"}</span>
              <span className="font-mono text-xs whitespace-nowrap">{formatCompact(Number(f.monto_total))} · {formatNumber(f.ocs)} OC</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
