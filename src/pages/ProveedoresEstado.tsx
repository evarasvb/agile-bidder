// Página ADMIN: "Proveedores del Estado". Inteligencia de quién le vende al Estado,
// cuánto y a quién, agregada desde las órdenes de compra. Solo la ve el admin
// (ruta AdminOnlyRoute + RPC security-definer). No trae correos (Mercado Público no
// los expone); sirve para saber a quién conviene contactar y priorizar.
import { Fragment, useMemo, useState } from "react";
import { useProveedoresEstado, useProveedorEstadoDetalle, type ProveedorEstado } from "@/hooks/useProveedoresEstado";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Search, Store, Tags, TrendingUp } from "lucide-react";

function clp(n: number | null | undefined): string {
  const v = Number(n || 0);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(v);
}
function num(n: number | null | undefined): string {
  return new Intl.NumberFormat("es-CL").format(Number(n || 0));
}

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
  const { data: proveedores = [], isLoading } = useProveedoresEstado(q, 50);
  const [abierto, setAbierto] = useState<string | null>(null);

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
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar proveedor por nombre o RUT…"
              className="pl-9"
            />
          </div>
          {q.trim() === "" && (
            <p className="text-xs text-muted-foreground mt-2">Mostrando el top por monto 2026. Escribe para buscar cualquier proveedor.</p>
          )}
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : proveedores.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Sin resultados. Prueba otro nombre o RUT.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="whitespace-nowrap">RUT</TableHead>
                    <TableHead className="text-right whitespace-nowrap">OC 2026</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Monto 2026</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Monto total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proveedores.map((p: ProveedorEstado) => (
                    <Fragment key={p.rut_proveedor}>
                      <TableRow
                        className="cursor-pointer hover:bg-firmavb-blue/5"
                        onClick={() => setAbierto(abierto === p.rut_proveedor ? null : p.rut_proveedor)}
                      >
                        <TableCell className="font-medium max-w-[280px]"><span className="truncate block" title={p.proveedor_nombre || ""}>{p.proveedor_nombre || "—"}</span></TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{p.rut_proveedor}</TableCell>
                        <TableCell className="text-right tabular-nums">{num(p.n_ocs_2026)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{clp(p.monto_2026)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{clp(p.monto_total)}</TableCell>
                      </TableRow>
                      {abierto === p.rut_proveedor && (
                        <TableRow>
                          <TableCell colSpan={5} className="p-0"><DetalleProveedor rut={p.rut_proveedor} /></TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
