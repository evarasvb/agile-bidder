// Página ADMIN: "Proveedores del Estado". Inteligencia de quién le vende al Estado,
// cuánto y a quién, agregada desde las órdenes de compra. Solo la ve el admin
// (ruta AdminOnlyRoute + RPC security-definer). No trae correos (Mercado Público no
// los expone); sirve para saber a quién conviene contactar y priorizar.
import { useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useProveedoresEstado, useProveedorEstadoDetalle, useRubrosEstado, type ProveedorEstado } from "@/hooks/useProveedoresEstado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Building2, Store, Tags, TrendingUp, X } from "lucide-react";

// Cuántos proveedores trae el RPC (ordenados por monto 2026). La búsqueda por
// nombre/RUT, el orden y la paginación se hacen en la tabla sobre este set.
// El RPC proveedores_estado corta en 200; la búsqueda por nombre/RUT (q) se
// hace en el servidor sobre TODOS los proveedores antes de ese corte.
const LIMITE_PROVEEDORES = 200;

function clp(n: number | null | undefined): string {
  const v = Number(n || 0);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
}
function num(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-CL").format(Number(n || 0));
}

const COLUMNAS_PROVEEDORES: DataTableColumn<ProveedorEstado>[] = [
  {
    id: "proveedor",
    header: "Proveedor",
    cell: (p) => <span className="font-medium truncate block max-w-[280px]" title={p.proveedor_nombre || ""}>{p.proveedor_nombre || "—"}</span>,
    sortValue: (p) => p.proveedor_nombre,
    exportValue: (p) => p.proveedor_nombre ?? "",
  },
  {
    id: "rut",
    header: "RUT",
    cell: (p) => <span className="font-mono text-xs whitespace-nowrap">{p.rut_proveedor}</span>,
    sortValue: (p) => p.rut_proveedor,
  },
  { id: "ocs_2026", header: "OC 2026", align: "right", cell: (p) => <span className="tabular-nums">{num(p.n_ocs_2026)}</span>, sortValue: (p) => Number(p.n_ocs_2026 || 0) },
  {
    id: "monto_2026",
    header: "Monto 2026",
    align: "right",
    cell: (p) => <span className="tabular-nums font-medium">{clp(p.monto_2026)}</span>,
    sortValue: (p) => Number(p.monto_2026 || 0),
  },
  {
    id: "monto_total",
    header: "Monto total",
    align: "right",
    cell: (p) => <span className="tabular-nums text-muted-foreground">{clp(p.monto_total)}</span>,
    sortValue: (p) => Number(p.monto_total || 0),
  },
];

function DetalleProveedor({ rut }: { rut: string }) {
  const { data, isLoading } = useProveedorEstadoDetalle(rut);
  if (isLoading) return <div className="p-3"><Skeleton className="h-20 w-full" /></div>;
  if (!data) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2 p-4 bg-muted/30">
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Tags className="h-3.5 w-3.5" /> Qué vende (rubros)</p>
        {data.rubros.length === 0 ? <p className="text-xs text-muted-foreground">Sin detalle</p> : data.rubros.map((r) => (
          <div key={r.rubro} className="flex justify-between text-xs py-0.5">
            <span className="truncate mr-2">{r.rubro}</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{clp(r.monto)}</span>
          </div>
        ))}
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> A qué instituciones le vende</p>
        {data.instituciones.length === 0 ? <p className="text-xs text-muted-foreground">Sin detalle</p> : data.instituciones.map((i) => (
          <div key={i.institucion} className="flex justify-between text-xs py-0.5">
            <span className="truncate mr-2">{i.institucion}</span>
            <span className="tabular-nums text-muted-foreground shrink-0">{clp(i.monto)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProveedoresEstado() {
  const [q, setQ] = useState("");
  const [rubro, setRubro] = useState("");
  const [institucion, setInstitucion] = useState("");
  const qServidor = useDebouncedValue(q.trim(), 400);
  const { data: rubros = [] } = useRubrosEstado();
  const { data: proveedores = [], isLoading } = useProveedoresEstado(qServidor, rubro, institucion, LIMITE_PROVEEDORES);
  const [abierto, setAbierto] = useState<ProveedorEstado | null>(null);
  const hayFiltro = !!(rubro || institucion.trim() || q.trim());

  const totales = useMemo(() => {
    const monto = proveedores.reduce((s, p) => s + Number(p.monto_2026 || 0), 0);
    return { n: proveedores.length, monto };
  }, [proveedores]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Store className="h-6 w-6 text-firmavb-blue" />
        <div>
          <h1 className="text-2xl font-bold">Proveedores del Estado</h1>
          <p className="text-sm text-muted-foreground">Quién le vende al Estado, cuánto y a quién — desde las órdenes de compra. Solo tú ves esto.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Proveedor por nombre o RUT (busca en todos)…"
              aria-label="Buscar proveedor"
            />
            <Select value={rubro || "__all__"} onValueChange={(v) => setRubro(v === "__all__" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todos los rubros" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los rubros</SelectItem>
                {rubros.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              value={institucion}
              onChange={(e) => setInstitucion(e.target.value)}
              placeholder="Institución (ej: municipalidad, salud)…"
            />
          </div>
          <div className="flex items-center gap-3">
            {hayFiltro
              ? <Button variant="ghost" size="sm" onClick={() => { setQ(""); setRubro(""); setInstitucion(""); }}>Limpiar filtros</Button>
              : <p className="text-xs text-muted-foreground">Mostrando el top {num(LIMITE_PROVEEDORES)} por monto 2026. Busca por nombre o RUT, o filtra por rubro o institución.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-firmavb-blue" /> Proveedores
            <Badge variant="secondary">{num(totales.n)}</Badge>
            <span className="ml-auto text-sm font-normal text-muted-foreground">Monto 2026 (visible): {clp(totales.monto)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DataTable<ProveedorEstado>
            storageKey="proveedores-estado"
            rows={proveedores}
            rowKey={(p) => p.rut_proveedor}
            loading={isLoading}
            itemLabel="proveedores"
            columns={COLUMNAS_PROVEEDORES}
            defaultSort={{ id: "monto_2026", dir: "desc" }}
            exportFileName="proveedores-estado"
            emptyMessage="Sin resultados. Prueba otro nombre, rubro o institución."
            onRowClick={(p) => setAbierto((prev) => (prev?.rut_proveedor === p.rut_proveedor ? null : p))}
            rowClassName={(p) => (abierto?.rut_proveedor === p.rut_proveedor ? "bg-firmavb-blue/5" : "hover:bg-firmavb-blue/5")}
          />
          {abierto && (
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-muted/50">
                <p className="text-sm font-medium truncate">
                  {abierto.proveedor_nombre || "—"} <span className="font-mono text-xs text-muted-foreground">{abierto.rut_proveedor}</span>
                </p>
                <Button variant="ghost" size="sm" onClick={() => setAbierto(null)} aria-label="Cerrar detalle"><X className="h-4 w-4" /></Button>
              </div>
              <DetalleProveedor rut={abierto.rut_proveedor} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
