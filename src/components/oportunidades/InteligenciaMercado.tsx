import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BarChart3, Building2, Swords, TrendingUp, FileText, Store, Lock, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useInteligenciaOC } from "@/hooks/useInteligenciaOC";
import { usePlan } from "@/hooks/usePlan";
import { InfoHint } from "@/components/ui/info-hint";

function fmt(value: number | null | undefined) {
  if (!value) return "-";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function InteligenciaMercado({
  codigo,
  tipo,
}: {
  codigo: string | null | undefined;
  tipo: "compra_agil" | "licitacion" | null;
}) {
  const navigate = useNavigate();
  const { isFree } = usePlan();
  const { data, isLoading } = useInteligenciaOC(codigo, tipo);

  const Header = (
    <CardHeader>
      <CardTitle className="text-base flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        Inteligencia de mercado
        <InfoHint text="Cruzamos los productos de esta oportunidad con órdenes de compra reales del Estado (por código ONU o nombre similar) para mostrarte a qué precio se ha comprado, quién gana y quién compra." />
      </CardTitle>
      <p className="text-xs text-muted-foreground">
        Precios, competidores y compradores según órdenes de compra reales del Estado.
      </p>
    </CardHeader>
  );

  if (isLoading) {
    return (
      <Card>
        {Header}
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card>
        {Header}
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aún no hay órdenes de compra comparables para estos productos. A medida que
            lleguen OC frescas del mercado, aparecerán aquí con precios y competidores.
          </p>
          <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => navigate("/mercado/ordenes")}>
            <Store className="h-4 w-4" /> Explorar Órdenes de Compra
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { precio, competidores, compradores, muestra, total } = data;

  return (
    <Card>
      {Header}
      <CardContent className="space-y-5">
        {/* Precio de referencia */}
        {precio && (
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Precio de referencia (unitario)
              <InfoHint text={`Promedio, mínimo y máximo del precio unitario pagado en ${total} líneas de OC de productos similares. Úsalo como referencia para posicionar tu oferta.`} />
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold">{fmt(precio.min)}</p>
                <p className="text-xs text-muted-foreground">Mínimo</p>
              </div>
              <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 text-center">
                <p className="text-lg font-bold text-primary">{fmt(precio.prom)}</p>
                <p className="text-xs text-muted-foreground">Promedio</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-lg font-bold">{fmt(precio.max)}</p>
                <p className="text-xs text-muted-foreground">Máximo</p>
              </div>
            </div>
          </div>
        )}

        {isFree ? (
          /* Teaser: el free ve el precio de referencia; el resto es Pro. */
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
            <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium">Desbloquea la inteligencia completa</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Con Pro ves <strong>quién gana</strong> estas OC (competidores), <strong>qué organismos compran</strong> esto
              y el detalle de precios de las {total} órdenes comparables.
            </p>
            <Button size="sm" className="gap-1.5 mt-1" onClick={() => navigate("/cuenta/facturacion")}>
              <Sparkles className="h-3.5 w-3.5" /> Ver planes Pro
            </Button>
          </div>
        ) : (
        <>
        {/* Competidores y Compradores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1">
              <Swords className="h-3.5 w-3.5" /> Quién gana estas OC (competidores)
            </p>
            <ul className="space-y-1.5">
              {competidores.map((c) => (
                <li key={c.nombre} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={c.nombre}>{c.nombre}</span>
                  <Badge variant="secondary" className="shrink-0">{c.ocs} OC</Badge>
                </li>
              ))}
              {competidores.length === 0 && <li className="text-sm text-muted-foreground">Sin datos</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Quién compra esto (demanda)
            </p>
            <ul className="space-y-1.5">
              {compradores.map((c) => (
                <li key={c.nombre} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={c.nombre}>{c.nombre}</span>
                  <Badge variant="secondary" className="shrink-0">{c.ocs} OC</Badge>
                </li>
              ))}
              {compradores.length === 0 && <li className="text-sm text-muted-foreground">Sin datos</li>}
            </ul>
          </div>
        </div>

        {/* Muestra reciente de OC */}
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Órdenes de compra recientes comparables</p>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Fecha</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Ganador</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right whitespace-nowrap">P. Unitario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {muestra.map((l, i) => (
                  <TableRow key={`${l.oc_codigo}-${i}`}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {l.fecha ? format(new Date(l.fecha), "dd MMM yy", { locale: es }) : "-"}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-sm" title={l.organismo || ""}>{l.organismo || "-"}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-sm" title={l.proveedor || ""}>{l.proveedor || "-"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm" title={l.producto || ""}>{l.producto || "-"}</TableCell>
                    <TableCell className="text-right whitespace-nowrap text-sm font-medium">{fmt(l.precio_unitario)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        </>
        )}

        {/* Footer: fuente + enlaces (intercomunicación) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Basado en <span className="font-medium text-foreground">{total}</span> líneas de OC reales comparables.
          </p>
          {!isFree && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/mercado/ordenes")}>
                <FileText className="h-3.5 w-3.5" /> Ver OC
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/reportes")}>
                <BarChart3 className="h-3.5 w-3.5" /> Reportes
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
