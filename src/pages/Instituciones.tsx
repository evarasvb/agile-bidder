import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Landmark,
  Building2,
  Newspaper,
  MessageSquareWarning,
  FileText,
  ShoppingCart,
  Clock,
  BellOff,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompact } from "@/hooks/useReportes";
import { usePlan } from "@/hooks/usePlan";
import {
  useInstitucionesSeguidas,
  useInstitucionZoom,
  type ReclamoZoom,
  type ProcesoZoom,
  type InstitucionSeguida,
} from "@/hooks/useInstitucionZoom";
import { useDejarInstitucion } from "@/hooks/usePanelProveedor";
import { RiesgoOrganismoCard } from "@/components/organismo/RiesgoOrganismoCard";

const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }) : "s/i";

function FilaProceso({ p }: { p: ProcesoZoom }) {
  const monto = p.presupuesto_estimado ?? p.monto_estimado;
  const abierto = p.fecha_cierre ? new Date(p.fecha_cierre) > new Date() : false;
  return (
    <a
      href={`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=${p.codigo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{p.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {p.codigo} · {abierto ? <span className="text-firmavb-blue">Cierra {fechaCorta(p.fecha_cierre)}</span> : p.estado || "Cerrada"}
        </p>
      </div>
      {monto != null && monto > 1 && <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatCompact(monto)}</span>}
    </a>
  );
}

const TIPO_RECLAMO: Record<number, string> = { 1: "No pago", 2: "Proceso" };

function FilaReclamo({ r }: { r: ReclamoZoom }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{r.reclamante || "Reclamante sin nombre"}</p>
        <p className="text-xs text-muted-foreground">{fechaCorta(r.fecha)} · {r.estado || "s/i"}</p>
      </div>
      <Badge variant="outline" className={r.tipo === 1 ? "shrink-0 border-red-300 bg-red-50 text-red-700" : "shrink-0 border-yellow-300 bg-yellow-50 text-yellow-700"}>
        {TIPO_RECLAMO[r.tipo] ?? "Reclamo"}
      </Badge>
    </div>
  );
}

function ListaVacia({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

export default function Instituciones() {
  const { verInteligencia } = usePlan();
  const { data: seguidas, isLoading: seguidasLoading } = useInstitucionesSeguidas();
  const dejar = useDejarInstitucion();
  const [sel, setSel] = useState<InstitucionSeguida | null>(null);

  // Llegada desde la campanita de avisos (reclamo_institucion / compras_institucion):
  // trae el RUT exacto en la URL para abrir el zoom de una vez.
  const [searchParams] = useSearchParams();
  const rutUrl = searchParams.get("rut");
  const autoSeleccionado = useRef(false);

  useEffect(() => {
    if (autoSeleccionado.current || !rutUrl || !seguidas) return;
    autoSeleccionado.current = true;
    const match = seguidas.find((s) => s.rut_institucion === rutUrl);
    setSel(match ?? { rut_institucion: rutUrl, nombre_institucion: rutUrl, created_at: "" });
  }, [rutUrl, seguidas]);

  useEffect(() => {
    if (!sel && seguidas?.length && !rutUrl) setSel(seguidas[0]);
  }, [seguidas, sel, rutUrl]);

  const { data: zoom, isLoading: zoomLoading } = useInstitucionZoom(sel?.rut_institucion ?? null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-firmavb-blue/10">
          <Landmark className="h-5 w-5 text-firmavb-blue" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-bold">Instituciones que sigo</h1>
          <p className="text-sm text-muted-foreground">
            Noticias, pagos oportunos, reclamos, licitaciones y compras ágiles de cada institución, todo en un solo lugar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Lista de instituciones seguidas */}
        <Card className="lg:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tus instituciones</CardTitle>
            <CardDescription>Se siguen desde el Panel del proveedor, en tu Dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            {seguidasLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !seguidas?.length ? (
              <div className="py-10 text-center text-muted-foreground">
                <BellOff className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm">Todavía no sigues ninguna institución.</p>
                <p className="mt-1 text-xs">En tu Dashboard, en "Tus mejores clientes", toca "Seguir" en la que te interese.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {seguidas.map((s) => (
                  <div
                    key={s.rut_institucion}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                      sel?.rut_institucion === s.rut_institucion ? "border-firmavb-blue bg-firmavb-blue/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSel(s)}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.nombre_institucion}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={dejar.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sel?.rut_institucion === s.rut_institucion) setSel(null);
                        dejar.mutate(s.rut_institucion);
                      }}
                    >
                      Dejar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Zoom de la institución elegida */}
        <div className="lg:col-span-3">
          {!sel ? (
            <Card className="border-dashed h-full">
              <CardContent className="py-20 text-center text-muted-foreground">
                <Landmark className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Elige una institución</h3>
                <p className="text-sm max-w-xs mx-auto">Verás sus noticias, cómo paga, sus reclamos y sus procesos abiertos.</p>
              </CardContent>
            </Card>
          ) : zoomLoading ? (
            <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : (
            <div key={sel.rut_institucion} className="space-y-4 animate-slide-in">
              <div>
                <h2 className="text-lg font-bold leading-tight">{zoom?.institucion || sel.nombre_institucion}</h2>
                <p className="text-sm text-muted-foreground">{sel.rut_institucion}</p>
              </div>

              <RiesgoOrganismoCard organismo={zoom?.institucion || sel.nombre_institucion} />

              {/* Reclamos recientes (detalle: quién reclamó y cuándo) */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><MessageSquareWarning className="h-4 w-4" /> Reclamos recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  {!verInteligencia ? (
                    <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 shrink-0" /> El detalle de reclamos es parte de Experto Pro.
                    </div>
                  ) : zoom?.reclamos.length ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {zoom.reclamos.map((r, i) => <FilaReclamo key={i} r={r} />)}
                    </div>
                  ) : <ListaVacia texto="Sin reclamos registrados en el último año." />}
                </CardContent>
              </Card>

              {/* Noticias */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Newspaper className="h-4 w-4" /> Noticias</CardTitle>
                </CardHeader>
                <CardContent>
                  {zoom?.noticias.length ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {zoom.noticias.map((n, i) => (
                        <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block rounded-md border p-2.5 text-sm hover:bg-muted/50 transition-colors">
                          <p className="line-clamp-2 font-medium">{n.titulo}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{n.medio}{n.fecha && ` · ${fechaCorta(n.fecha)}`}</p>
                        </a>
                      ))}
                    </div>
                  ) : <ListaVacia texto="Todavía no hay noticias para esta institución." />}
                </CardContent>
              </Card>

              {/* RF / consultas al mercado: sin fuente de datos todavía */}
              <Card className="border-dashed border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> Consultas al mercado (RF)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Próximamente. Todavía no ingestamos las consultas/RFI de Mercado Público.</p>
                </CardContent>
              </Card>

              {/* Licitaciones */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Licitaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  {zoom?.licitaciones.length ? (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {zoom.licitaciones.map((p) => <FilaProceso key={p.codigo} p={p} />)}
                    </div>
                  ) : <ListaVacia texto="Sin licitaciones recientes." />}
                </CardContent>
              </Card>

              {/* Compras ágiles */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Compras ágiles</CardTitle>
                </CardHeader>
                <CardContent>
                  {zoom?.compras_agiles.length ? (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                      {zoom.compras_agiles.map((p) => <FilaProceso key={p.codigo} p={p} />)}
                    </div>
                  ) : <ListaVacia texto="Sin compras ágiles recientes." />}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
