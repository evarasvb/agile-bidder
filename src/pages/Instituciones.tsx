import { Link, useSearchParams } from "react-router-dom";
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
  Users,
  Scale,
  Receipt,
  MapPin,
  Gavel,
  ExternalLink,
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
  type RfZoom,
  type FuncionarioZoom,
  type CausaZoom,
  type CobranzaZoom,
} from "@/hooks/useInstitucionZoom";
import { useDejarInstitucion } from "@/hooks/usePanelProveedor";
import { RiesgoOrganismoCard } from "@/components/organismo/RiesgoOrganismoCard";
import { InstitutionNoticeCard } from "@/components/organismo/InstitutionNoticeCard";
import { useInstitutionNotice } from "@/hooks/useInstitutionNotice";
import { institutionPath, resolveNoticeInstitution } from "@/lib/institutionFollowing";

// Fechas tipo `date` (solo "AAAA-MM-DD", sin hora) se parsean en hora local
// para no correr un día por el desfase UTC; las que ya traen hora (timestamptz)
// se parsean tal cual.
const fechaCorta = (iso: string | null) => {
  if (!iso) return "s/i";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
};

// Enlaces de contacto/ubicación: solo se arman con datos reales (dirección
// que trae la propia institución, o su nombre). Nada de teléfono/correo/
// horarios acá: Mercado Público no los publica y no se inventan.
const linkMaps = (direccion: string, comuna: string | null, region: string | null) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([direccion, comuna, region].filter(Boolean).join(", "))}`;
const linkLobby = (nombre: string) => `https://www.leylobby.gob.cl/instituciones?search=${encodeURIComponent(nombre)}`;
const LINK_TRANSPARENCIA = "https://www.portaltransparencia.cl";

function FilaProceso({ p, tipo }: { p: ProcesoZoom; tipo: "licitacion" | "compra_agil" }) {
  const monto = p.presupuesto_estimado ?? p.monto_estimado;
  const abierto = p.fecha_cierre ? new Date(p.fecha_cierre) > new Date() : false;
  return (
    <Link
      to={tipo === "licitacion" ? `/licitaciones/${p.codigo}` : `/compras-agiles/${p.codigo}`}
      className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/50 transition-colors"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{p.nombre}</p>
        <p className="text-xs text-muted-foreground">
          {p.codigo} · {abierto ? <span className="text-firmavb-blue">Cierra {fechaCorta(p.fecha_cierre)}</span> : p.estado || "Cerrada"}
        </p>
      </div>
      {monto != null && monto > 1 && <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatCompact(monto)}</span>}
    </Link>
  );
}

const TIPO_RECLAMO: Record<number, string> = { 1: "No pago", 2: "Proceso" };

// Mercado Público publica el código del proceso al que corresponde el
// reclamo, pero no un texto/motivo (su ficha pública de reclamos es solo
// categórica: tipo, fecha, estado). Con el código sí se puede abrir el
// proceso real y ver de qué se trataba — pero reclamos_mp.proceso_codigo
// trae formatos muy distintos: licitaciones/Convenio Marco/compras ágiles
// como "1211839-319-CM26" o "3760-797-COT25", pero también IDs sueltos sin
// ese formato ("3747", "40101701") que no son un proceso navegable. Contra
// datos reales de `ordenes_compra.link_oficial` (que sí guarda el link
// oficial de Mercado Público para muchas órdenes ya scrapeadas): los
// códigos con formato "algo-números-LETRASdígitos" siempre abren en
// DetailsAcquisition.aspx?idlicitacion=, sea licitación, Convenio Marco o
// compra ágil con sufijo distinto a COT; el sufijo "COT" es el único caso
// que usa la ficha de compra-agil.mercadopublico.cl (igual que
// compras_agiles.url_ficha). Un código que no calza ese formato no se
// enlaza: mejor no linkear que llevar a una ficha equivocada o vacía.
const FORMATO_PROCESO_MP = /^[a-z0-9]+-\d+-[a-z]{1,4}\d{2,4}$/i;
const linkProcesoReclamo = (codigo: string): string | null => {
  if (!FORMATO_PROCESO_MP.test(codigo)) return null;
  return /cot/i.test(codigo)
    ? `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${codigo}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`;
};

function FilaReclamo({ r }: { r: ReclamoZoom }) {
  const link = r.proceso_codigo ? linkProcesoReclamo(r.proceso_codigo) : null;
  const contenido = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium">{r.reclamante || "Reclamante sin nombre"}</p>
        <p className="text-xs text-muted-foreground">{fechaCorta(r.fecha)} · {r.estado || "s/i"}</p>
        {link && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-firmavb-blue">
            <ExternalLink className="h-3 w-3" /> Ver proceso {r.proceso_codigo} en Mercado Público
          </p>
        )}
      </div>
      <Badge variant="outline" className={r.tipo === 1 ? "shrink-0 border-red-300 bg-red-50 text-red-700" : "shrink-0 border-yellow-300 bg-yellow-50 text-yellow-700"}>
        {TIPO_RECLAMO[r.tipo] ?? "Reclamo"}
      </Badge>
    </>
  );
  if (!link) {
    return <div className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">{contenido}</div>;
  }
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm hover:bg-muted/50 transition-colors"
    >
      {contenido}
    </a>
  );
}

function ListaVacia({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

const CLP = (v: number) => "$" + Math.round(v || 0).toLocaleString("es-CL");

function FilaRf({ r }: { r: RfZoom }) {
  const abierto = r.fecha_cierre ? new Date(r.fecha_cierre) > new Date() : false;
  return (
    <div className="rounded-md border p-2.5 text-sm">
      <p className="line-clamp-2 font-medium">{r.nombre || r.codigo}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {r.codigo} · {abierto ? <span className="text-firmavb-blue">Cierra {fechaCorta(r.fecha_cierre)}</span> : "Cerrada"}
      </p>
    </div>
  );
}

function FilaFuncionario({ f }: { f: FuncionarioZoom }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{f.nombre}</p>
        <p className="text-xs text-muted-foreground">{f.cargo || "Cargo sin especificar"}</p>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{f.procesos} proceso{f.procesos === 1 ? "" : "s"}</span>
    </div>
  );
}

function FilaCausa({ c }: { c: CausaZoom }) {
  return (
    <div className="rounded-md border p-2.5 text-sm">
      <p className="line-clamp-2 text-muted-foreground">{c.extracto}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{fechaCorta(c.fecha)}</p>
    </div>
  );
}

function FilaCobranza({ f }: { f: CobranzaZoom }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{f.numero_factura || "Factura sin número"}</p>
        <p className="text-xs text-muted-foreground">
          Vence {fechaCorta(f.fecha_vencimiento)} · {f.estado}
        </p>
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{CLP(f.monto)}</span>
    </div>
  );
}

export default function Instituciones() {
  const { verInteligencia } = usePlan();
  const { data: seguidas, isLoading: seguidasLoading, isError: seguidasError, refetch: reloadSeguidas } = useInstitucionesSeguidas();
  const dejar = useDejarInstitucion();
  const [searchParams, setSearchParams] = useSearchParams();
  const rutUrl = searchParams.get("rut");
  const avisoId = searchParams.get("aviso");
  const aviso = useInstitutionNotice(avisoId);
  const institucionAviso = aviso.data ? resolveNoticeInstitution(aviso.data, seguidas ?? []) : null;
  // Select only a visible follow. Never construct a synthetic institution from
  // an arbitrary URL, and never replace an unavailable alert with the first row.
  const sel = rutUrl ? seguidas?.find(s => s.rut_institucion === rutUrl) ?? null
    : avisoId ? institucionAviso : seguidas?.[0] ?? null;
  const avisoSeleccionado = aviso.data && sel && institucionAviso?.rut_institucion === sel.rut_institucion ? aviso.data : null;
  const { data: zoom, isLoading: zoomLoading, isError: zoomError, refetch: reloadZoom } = useInstitucionZoom(sel?.rut_institucion ?? null, sel?.nombre_institucion ?? null);

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
            ) : seguidasError ? (
              <div role="alert" className="space-y-3 py-6"><p>No pudimos cargar tus instituciones.</p><Button variant="outline" onClick={() => reloadSeguidas()}>Reintentar</Button></div>
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
                  >
                    <Link to={institutionPath(s.rut_institucion)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded focus-visible:ring-2" aria-current={sel?.rut_institucion === s.rut_institucion ? 'page' : undefined}>
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium">{s.nombre_institucion}</span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={dejar.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        dejar.mutate(s.rut_institucion, { onSuccess: () => {
                          if (sel?.rut_institucion === s.rut_institucion) {
                            const siguiente = seguidas.find(x => x.rut_institucion !== s.rut_institucion);
                            setSearchParams(siguiente ? { rut: siguiente.rut_institucion } : {});
                          }
                        } });
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
        <div className="lg:col-span-3 min-w-0 space-y-4">
          {avisoId && (aviso.isLoading || seguidasLoading) && <p role="status">Cargando el aviso…</p>}
          {avisoId && !aviso.isLoading && !seguidasLoading && !avisoSeleccionado && <div role="status" className="rounded-lg border p-4 text-sm">
            {aviso.isError ? 'No pudimos cargar este aviso.' : 'Este aviso no está disponible o no se puede vincular de forma segura a una institución que sigues.'}
            {aviso.isError && <Button variant="outline" className="mt-2" onClick={() => aviso.refetch()}>Reintentar aviso</Button>}
          </div>}
          {rutUrl && !seguidasLoading && !seguidasError && !sel && <p role="status" className="text-sm">Esta institución no está en tus seguimientos. Elige una institución de tu lista.</p>}
          {avisoSeleccionado && <InstitutionNoticeCard notice={avisoSeleccionado} />}
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
          ) : zoomError ? (
            <div role="alert" className="space-y-3 rounded-lg border p-4"><p>No pudimos cargar la información de esta institución.</p><Button variant="outline" onClick={() => reloadZoom()}>Reintentar ficha</Button></div>
          ) : (
            <div key={sel.rut_institucion} className="space-y-4 animate-slide-in">
              <div>
                <h2 className="text-lg font-bold leading-tight">{zoom?.institucion || sel.nombre_institucion}</h2>
                <p className="text-sm text-muted-foreground">{sel.rut_institucion}</p>
              </div>

              {/* Contacto y ubicación: solo con datos reales disponibles. Mercado
                  Público no publica teléfono, correo ni horarios de atención
                  de las instituciones (columnas vacías en el 100% de los
                  casos) — no se muestran para no inventarlos. */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4" /> Contacto y ubicación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {zoom?.direccion ? (
                    <div className="flex items-start justify-between gap-3 rounded-md border p-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{zoom.direccion}</p>
                        <p className="text-xs text-muted-foreground">{[zoom.comuna, zoom.region].filter(Boolean).join(", ") || "Comuna/región sin dato"}</p>
                      </div>
                      <a
                        href={linkMaps(zoom.direccion, zoom.comuna, zoom.region)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs text-firmavb-blue hover:underline"
                      >
                        Ver mapa
                      </a>
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
                      Todavía no tenemos la dirección de esta institución (Mercado Público no la incluye en todos sus procesos).
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    No hay teléfono, correo ni horarios de atención publicados por Mercado Público para esta institución.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={linkLobby(zoom?.institucion || sel.nombre_institucion)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <Gavel className="h-3.5 w-3.5" /> Ley de Lobby
                    </a>
                    <a
                      href={LINK_TRANSPARENCIA}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Portal de Transparencia
                    </a>
                  </div>
                </CardContent>
              </Card>

              <RiesgoOrganismoCard organismo={zoom?.institucion || sel.nombre_institucion} />

              {/* Reclamos recientes (detalle: quién reclamó y cuándo) */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><MessageSquareWarning className="h-4 w-4" /> Reclamos recientes</CardTitle>
                  <CardDescription className="text-xs">
                    Mercado Público no publica el motivo del reclamo, solo tipo, fecha y estado. Cuando el reclamo trae el código del proceso, puedes abrirlo para ver de qué se trataba.
                  </CardDescription>
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

              {/* RF / consultas al mercado: lo que el organismo pregunta antes de licitar */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Consultas al mercado (RF)</CardTitle>
                  <CardDescription className="text-xs">Lo que el organismo pregunta antes de licitar: adelanto de lo que se viene.</CardDescription>
                </CardHeader>
                <CardContent>
                  {zoom?.rf.length ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {zoom.rf.map((r) => <FilaRf key={r.codigo} r={r} />)}
                    </div>
                  ) : <ListaVacia texto={zoom?.rf_disponible ? "Sin consultas al mercado registradas en los últimos meses." : "No hay un listado institucional disponible. Puedes revisar las consultas al mercado en el análisis del Experto de una licitación."} />}
                </CardContent>
              </Card>

              {/* Funcionarios: solo nombre y cargo, tal como los publica Mercado Público */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Funcionarios de contacto</CardTitle>
                  <CardDescription className="text-xs">Nombre y cargo, según los procesos publicados. Mercado Público no expone email ni teléfono.</CardDescription>
                </CardHeader>
                <CardContent>
                  {zoom?.funcionarios.length ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {zoom.funcionarios.map((f, i) => <FilaFuncionario key={i} f={f} />)}
                    </div>
                  ) : <ListaVacia texto="Todavía no tenemos funcionarios identificados para esta institución." />}
                </CardContent>
              </Card>

              {/* Causas: aproximación vía chat con Don Evaristo Abogado, no es registro judicial */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" /> Causas y gestiones legales</CardTitle>
                  <CardDescription className="text-xs">Conversaciones tuyas con Don Evaristo Abogado que mencionan esta institución. No es un registro de causas judiciales.</CardDescription>
                </CardHeader>
                <CardContent>
                  {zoom?.causas.length ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {zoom.causas.map((c, i) => <FilaCausa key={i} c={c} />)}
                    </div>
                  ) : <ListaVacia texto="No has conversado con Don Evaristo Abogado sobre esta institución." />}
                </CardContent>
              </Card>

              {/* Cobranza: facturas propias donde esta institución es la deudora */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" /> Cobranza</CardTitle>
                  <CardDescription className="text-xs">Tus facturas por cobrar a esta institución (módulo Cobranza).</CardDescription>
                </CardHeader>
                <CardContent>
                  {zoom?.cobranza.length ? (
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                      {zoom.cobranza.map((f, i) => <FilaCobranza key={i} f={f} />)}
                    </div>
                  ) : <ListaVacia texto="No tienes facturas registradas a esta institución." />}
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
                      {zoom.licitaciones.map((p) => <FilaProceso key={p.codigo} p={p} tipo="licitacion" />)}
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
                      {zoom.compras_agiles.map((p) => <FilaProceso key={p.codigo} p={p} tipo="compra_agil" />)}
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
