// Market de proveedores del Estado (dentro de la app, al lado de Academia).
// Busca quién le vende un producto al Estado —con precio y frecuencia reales de
// las órdenes de compra— y permite pedirle cotización a otro proveedor. Si el
// proveedor ya está en FirmaVB le llega el aviso; si no, la solicitud lo espera.
import { useEffect, useMemo, useRef, useState } from "react";
import { Store, Search, Building2, ShoppingCart, Send, CheckCircle2, Inbox, Package, MessageCircle, Copy, Loader2, Trash2, Contact, Pencil, MapPin, Phone } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useMarketBuscar,
  useMisSolicitudes,
  useMarketSolicitar,
  useMarketCotizar,
  useMkMensajes,
  useMkEnviarMensaje,
  useClienteOwnerId,
  useMkEliminarSolicitud,
  useMkContacto,
  useMkGuardarContacto,
  type MarketProveedor,
  type MarketSolicitud,
  type MarketContacto,
} from "@/hooks/useMarketEstado";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const CHIPS = ["resma papel carta", "guantes nitrilo", "notebook", "cemento", "toner", "alcohol gel"];

function clp(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(Number(n));
}
function fecha(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-CL");
}

// ── Pedir cotización ─────────────────────────────────────────────
function SolicitarDialog({ proveedor, productoInicial, onClose }: {
  proveedor: MarketProveedor | null;
  productoInicial: string;
  onClose: () => void;
}) {
  const solicitar = useMarketSolicitar();
  const [producto, setProducto] = useState(productoInicial);
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState("");
  const [region, setRegion] = useState("");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [mensaje, setMensaje] = useState("");

  const abierto = !!proveedor;
  const enFirmaVB = !!proveedor?.es_firmavb && !!proveedor?.acepta_solicitudes;

  const enviar = async () => {
    if (!proveedor) return;
    if (producto.trim().length < 2) { toast.error("Escribe qué producto necesitas cotizar."); return; }
    try {
      await solicitar.mutateAsync({
        rut_proveedor: proveedor.rut,
        producto: producto.trim(),
        cantidad: cantidad ? Number(cantidad) : null,
        unidad: unidad.trim() || null,
        region: region.trim() || null,
        fecha: fechaEntrega || null,
        mensaje: mensaje.trim() || null,
      });
      toast.success(enFirmaVB
        ? "Solicitud enviada. Le llegará el aviso al proveedor."
        : "Solicitud registrada. Mercado Público no publica su correo, así que avísale tú: en \"Mis solicitudes\" tienes un mensaje listo para copiar y mandarle.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la solicitud.");
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedir cotización</DialogTitle>
          <DialogDescription>
            A <span className="font-medium text-foreground">{proveedor?.proveedor}</span>{" "}
            <span className="font-mono text-xs">{proveedor?.rut}</span>
            {!enFirmaVB && " — todavía no está en FirmaVB. No tenemos su correo (Mercado Público no lo publica), así que la solicitud queda guardada y en \"Mis solicitudes\" te dejamos un mensaje listo para que tú se lo mandes."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="mk-producto">Producto</Label>
            <Input id="mk-producto" value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Ej: resma papel carta" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mk-cant">Cantidad</Label>
              <Input id="mk-cant" type="number" min="0" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Ej: 100" />
            </div>
            <div>
              <Label htmlFor="mk-unidad">Unidad</Label>
              <Input id="mk-unidad" value={unidad} onChange={(e) => setUnidad(e.target.value)} placeholder="Ej: cajas, unidades" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="mk-region">Región / entrega</Label>
              <Input id="mk-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Ej: RM, Biobío" />
            </div>
            <div>
              <Label htmlFor="mk-fecha">Fecha necesaria</Label>
              <Input id="mk-fecha" type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="mk-msg">Mensaje (opcional)</Label>
            <Textarea id="mk-msg" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} placeholder="Detalles, condiciones, plazo de pago…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={solicitar.isPending} className="gap-2">
            <Send className="h-4 w-4" /> {solicitar.isPending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Responder una solicitud (cotizar) ────────────────────────────
function CotizarDialog({ solicitud, onClose }: { solicitud: MarketSolicitud | null; onClose: () => void; }) {
  const cotizar = useMarketCotizar();
  const [precio, setPrecio] = useState("");
  const [plazo, setPlazo] = useState("");
  const [mensaje, setMensaje] = useState("");

  const enviar = async () => {
    if (!solicitud) return;
    if (!precio || Number(precio) <= 0) { toast.error("Ingresa un precio válido."); return; }
    try {
      await cotizar.mutateAsync({
        solicitud: solicitud.id,
        precio: Number(precio),
        plazo: plazo ? Number(plazo) : null,
        mensaje: mensaje.trim() || null,
      });
      toast.success("Cotización enviada.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar la cotización.");
    }
  };

  return (
    <Dialog open={!!solicitud} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Responder cotización</DialogTitle>
          <DialogDescription>
            {solicitud?.producto}{solicitud?.cantidad ? ` · ${solicitud.cantidad}` : ""}
            {solicitud?.contraparte ? ` — para ${solicitud.contraparte}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ct-precio">Precio (CLP)</Label>
              <Input id="ct-precio" type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Ej: 3000" />
            </div>
            <div>
              <Label htmlFor="ct-plazo">Plazo (días)</Label>
              <Input id="ct-plazo" type="number" min="0" value={plazo} onChange={(e) => setPlazo(e.target.value)} placeholder="Ej: 5" />
            </div>
          </div>
          <div>
            <Label htmlFor="ct-msg">Mensaje (opcional)</Label>
            <Textarea id="ct-msg" value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} placeholder="Condiciones, stock, despacho…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={enviar} disabled={cotizar.isPending} className="gap-2">
            <Send className="h-4 w-4" /> {cotizar.isPending ? "Enviando…" : "Enviar cotización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tarjeta de proveedor ─────────────────────────────────────────
function ProveedorCard({ p, onPedir }: { p: MarketProveedor; onPedir: (prod: string) => void }) {
  return (
    <Card className="flex flex-col">
      <CardContent className="pt-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-[15px] leading-tight truncate" title={p.proveedor}>{p.proveedor}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              RUT {p.rut}{p.ultima_venta ? ` · última venta ${fecha(p.ultima_venta)}` : ""}
            </p>
          </div>
          {p.tiene_inventario ? (
            <Badge className="shrink-0 bg-firmavb-green/15 text-firmavb-green border-0 gap-1" title="Vende por FirmaVB: tiene su catálogo cargado acá, no solo historial de ventas al Estado">
              <Package className="h-3 w-3" /> Catálogo en FirmaVB
            </Badge>
          ) : p.es_firmavb ? (
            <Badge className="shrink-0 bg-firmavb-blue/10 text-firmavb-blue border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> En FirmaVB
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
          <span><b className="text-firmavb-blue">{p.n_oc}</b> órdenes</span>
          <span><b className="text-firmavb-blue">{p.n_organismos}</b> organismos</span>
          <span className="text-muted-foreground">Precio mediano <b className="text-foreground">{clp(p.precio_mediana)}</b></span>
        </div>

        {p.productos.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground flex-1">
            {p.productos.slice(0, 4).map((x, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate" title={x.producto}>
                  {x.producto}{x.catalogo ? " · catálogo" : ""}
                </span>
                <span className="shrink-0 tabular-nums">{clp(x.precio_mediana ?? x.precio)}</span>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={() => onPedir(p.productos[0]?.producto ?? "")}
          className="mt-4 w-full gap-2"
          variant={p.es_firmavb ? "default" : "secondary"}
        >
          <ShoppingCart className="h-4 w-4" />
          Pedir cotización
        </Button>
      </CardContent>
    </Card>
  );
}

// Mensaje listo para copiar y mandar a un proveedor que no está en FirmaVB
// (no tenemos su correo: Mercado Público no lo publica — ver hallazgo de
// Evaristo al pedir cotización a DIMERC). Lo manda Evaristo por su cuenta
// (WhatsApp, correo que ya tenga) en vez de que el sistema finja invitarlo.
// Si ya hay una ficha de contacto (teléfono/dirección encontrados a mano o
// por búsqueda web), se suman al mensaje.
function textoInvitacion(s: MarketSolicitud, contacto?: MarketContacto | null): string {
  const prod = s.producto ? `"${s.producto}"${s.cantidad ? ` (x${s.cantidad})` : ""}` : "unos productos";
  let txt = `Hola${s.contraparte ? ` ${s.contraparte}` : ""}! Te escribo desde FirmaVB, la plataforma donde gestiono compras y ventas al Estado. Necesito cotizar ${prod} y me gustaría que me cotizaras ahí directo: te registras gratis en https://firmavb.cl y respondes mi solicitud desde el Market de proveedores. ¡Gracias!`;
  if (contacto?.nombre_contacto) txt = `Hola ${contacto.nombre_contacto}! ` + txt.replace(/^Hola[^!]*!\s*/, "");
  return txt;
}

// ── Ficha de contacto de un proveedor ─────────────────────────────
function ContactoDialog({ rutNorm, nombreInicial, onClose }: { rutNorm: string | null; nombreInicial: string; onClose: () => void }) {
  const { data: contacto } = useMkContacto(rutNorm);
  const guardar = useMkGuardarContacto();
  const [form, setForm] = useState({
    email: "", telefono: "", whatsapp: "", sitio_web: "", direccion: "", comuna: "", region: "", nombre_contacto: "", notas: "",
  });

  useEffect(() => {
    // Sin esto, al pasar de un proveedor con contacto guardado a uno sin
    // contacto, `contacto` queda null y el form se quedaba con los valores
    // del proveedor anterior (podía guardarle a uno el correo/teléfono de
    // otro). Se limpia también al cambiar de proveedor, no solo cuando
    // llega un contacto nuevo.
    if (contacto) {
      setForm({
        email: contacto.email ?? "", telefono: contacto.telefono ?? "", whatsapp: contacto.whatsapp ?? "",
        sitio_web: contacto.sitio_web ?? "", direccion: contacto.direccion ?? "", comuna: contacto.comuna ?? "",
        region: contacto.region ?? "", nombre_contacto: contacto.nombre_contacto ?? "", notas: contacto.notas ?? "",
      });
    } else {
      setForm({ email: "", telefono: "", whatsapp: "", sitio_web: "", direccion: "", comuna: "", region: "", nombre_contacto: "", notas: "" });
    }
  }, [rutNorm, contacto]);

  const campo = (k: keyof typeof form, label: string, placeholder = "") => (
    <div>
      <Label htmlFor={`ct-${k}`}>{label}</Label>
      <Input id={`ct-${k}`} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const guardarYSalir = async () => {
    if (!rutNorm) return;
    try {
      await guardar.mutateAsync({
        rut_norm: rutNorm,
        rut: contacto?.rut ?? rutNorm,
        proveedor: contacto?.proveedor ?? nombreInicial,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        sitio_web: form.sitio_web.trim() || null,
        direccion: form.direccion.trim() || null,
        comuna: form.comuna.trim() || null,
        region: form.region.trim() || null,
        nombre_contacto: form.nombre_contacto.trim() || null,
        fuente: contacto?.fuente ?? "Ingresado a mano por el equipo",
        notas: form.notas.trim() || null,
      });
      toast.success("Contacto guardado.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };

  return (
    <Dialog open={!!rutNorm} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Contact className="h-4 w-4" /> Contacto de {contacto?.proveedor || nombreInicial}</DialogTitle>
          <DialogDescription>
            Mercado Público no publica el correo de los proveedores — guarda acá lo que encuentres (web, llamada) para la próxima vez.
            {contacto?.fuente && <span className="block mt-1 text-xs">Fuente: {contacto.fuente}</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {campo("email", "Correo", "ventas@proveedor.cl")}
            {campo("nombre_contacto", "Nombre de contacto")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo("telefono", "Teléfono")}
            {campo("whatsapp", "WhatsApp")}
          </div>
          {campo("sitio_web", "Sitio web", "https://")}
          {campo("direccion", "Dirección")}
          <div className="grid grid-cols-2 gap-3">
            {campo("comuna", "Comuna")}
            {campo("region", "Región")}
          </div>
          <div>
            <Label htmlFor="ct-notas">Notas</Label>
            <Textarea id="ct-notas" value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={guardarYSalir} disabled={guardar.isPending} className="gap-2">
            {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Una solicitud ──────────────────────────────────────────────
function SolicitudCard({ s, esAdmin, onResponder, onChat, onEditarContacto }: {
  s: MarketSolicitud;
  esAdmin: boolean;
  onResponder: (s: MarketSolicitud) => void;
  onChat: (s: MarketSolicitud) => void;
  onEditarContacto: (s: MarketSolicitud) => void;
}) {
  const meLaPidieron = s.rol === "vendedor";
  const esPendiente = s.estado === "invitacion_pendiente";
  const { data: contacto } = useMkContacto(esPendiente ? s.proveedor_rut_norm : null);
  const eliminar = useMkEliminarSolicitud();
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={meLaPidieron ? "default" : "secondary"}>
                {meLaPidieron ? "Me la pidieron" : "La pedí yo"}
              </Badge>
              {s.estado && (
                <Badge variant="outline" className="capitalize">
                  {esPendiente ? "Aún no está en FirmaVB" : s.estado}
                </Badge>
              )}
            </div>
            <p className="font-medium mt-2 truncate">{s.producto || "—"}{s.cantidad ? ` · ${s.cantidad}` : ""}</p>
            <p className="text-xs text-muted-foreground">
              {s.contraparte ? `${meLaPidieron ? "De" : "A"} ${s.contraparte} · ` : ""}{fecha(s.created_at)}
              {s.oportunidad_codigo ? ` · ${s.oportunidad_codigo}` : ""}
            </p>
            {s.creado_por_nombre && (
              <p className="text-xs text-muted-foreground">Pedido por {s.creado_por_nombre}</p>
            )}
            {esPendiente && contacto && (contacto.email || contacto.telefono || contacto.direccion) && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {contacto.telefono && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{contacto.telefono}</span>}
                {contacto.direccion && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{contacto.direccion}{contacto.comuna ? `, ${contacto.comuna}` : ""}</span>}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            {meLaPidieron && (
              <Button size="sm" onClick={() => onResponder(s)} className="gap-2">
                <Send className="h-3.5 w-3.5" /> Cotizar
              </Button>
            )}
            {esPendiente ? (
              <>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => onEditarContacto(s)}>
                  <Pencil className="h-3.5 w-3.5" /> Contacto
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(textoInvitacion(s, contacto));
                    toast.success("Mensaje copiado — pégalo en WhatsApp o correo.");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar invitación
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => onChat(s)}>
                <MessageCircle className="h-3.5 w-3.5" /> Chat
              </Button>
            )}
            {esAdmin && (
              <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmarBorrar(true)} aria-label="Eliminar solicitud">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {s.cotizaciones.length > 0 && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Cotizaciones ({s.cotizaciones.length})</p>
            {s.cotizaciones.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate">{c.proveedor || "Proveedor"}{c.mensaje ? ` — ${c.mensaje}` : ""}</span>
                <span className="shrink-0 tabular-nums">
                  <b>{clp(c.precio)}</b>{c.plazo != null ? ` · ${c.plazo} días` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmarBorrar} onOpenChange={setConfirmarBorrar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra "{s.producto}" {s.contraparte ? `(${s.contraparte})` : ""} y su chat/cotizaciones. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await eliminar.mutateAsync(s.id);
                  toast.success("Solicitud eliminada.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ── Mis solicitudes ──────────────────────────────────────────────
function MisSolicitudes({ onResponder, onChat, onEditarContacto }: {
  onResponder: (s: MarketSolicitud) => void;
  onChat: (s: MarketSolicitud) => void;
  onEditarContacto: (s: MarketSolicitud) => void;
}) {
  const { data = [], isLoading } = useMisSolicitudes();
  const { isAdmin } = useProfile();
  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 opacity-60" />
        Aún no tienes solicitudes. Busca un proveedor y pídele una cotización.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {data.map((s) => (
        <SolicitudCard key={s.id} s={s} esAdmin={isAdmin} onResponder={onResponder} onChat={onChat} onEditarContacto={onEditarContacto} />
      ))}
    </div>
  );
}

// ── Chat de una solicitud ─────────────────────────────────────────
function ChatDialog({ solicitud, onClose }: { solicitud: MarketSolicitud | null; onClose: () => void }) {
  const { data: ownerId } = useClienteOwnerId();
  const solicitudId = solicitud?.id ?? null;
  const { data: mensajes = [], isLoading } = useMkMensajes(solicitudId);
  const enviar = useMkEnviarMensaje(solicitudId);
  const [texto, setTexto] = useState("");
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const mandar = async () => {
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    try {
      await enviar.mutateAsync(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar el mensaje.");
      setTexto(t);
    }
  };

  return (
    <Dialog open={!!solicitud} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> {solicitud?.contraparte || "Chat"}
          </DialogTitle>
          <DialogDescription>
            {solicitud?.producto}{solicitud?.cantidad ? ` · ${solicitud.cantidad}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-[240px] overflow-y-auto space-y-2 py-2 border-y">
          {isLoading ? (
            <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-10 w-2/3" />)}</div>
          ) : mensajes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Todavía no hay mensajes. Escribe el primero.</p>
          ) : (
            mensajes.map((m) => {
              const esMio = !!ownerId && m.autor_id === ownerId;
              return (
                <div key={m.id} className={cn("max-w-[80%] rounded-lg px-3 py-2 text-sm", esMio ? "ml-auto bg-firmavb-blue text-white" : "bg-muted")}>
                  {m.mensaje}
                </div>
              );
            })
          )}
          <div ref={finRef} />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); } }}
            placeholder="Escribe un mensaje…"
            disabled={enviar.isPending}
          />
          <Button size="icon" onClick={mandar} disabled={enviar.isPending || !texto.trim()}>
            {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página ───────────────────────────────────────────────────────
export default function MarketEstado() {
  const [input, setInput] = useState("");
  const q = useDebouncedValue(input.trim(), 400);
  const { data: proveedores = [], isLoading, isError } = useMarketBuscar(q);
  const [pedirA, setPedirA] = useState<{ prov: MarketProveedor; producto: string } | null>(null);
  const [responder, setResponder] = useState<MarketSolicitud | null>(null);
  const [chatSolicitud, setChatSolicitud] = useState<MarketSolicitud | null>(null);
  const [contactoDe, setContactoDe] = useState<MarketSolicitud | null>(null);

  const estado = useMemo(() => {
    if (q.length < 3) return "Escribe un producto (mínimo 3 letras) para buscar proveedores.";
    if (isLoading) return "Buscando…";
    if (isError) return "No se pudo buscar ahora. Intenta de nuevo.";
    if (proveedores.length === 0) return `No encontramos ventas de "${q}". Prueba con otra palabra.`;
    return `${proveedores.length} proveedores le venden algo parecido a "${q}" al Estado`;
  }, [q, isLoading, isError, proveedores.length]);

  return (
    <div className="pb-10">
      {/* Hero con branding FirmaVB */}
      <div className="bg-gradient-to-br from-firmavb-blue to-firmavb-celeste text-white px-5 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
            <Store className="h-5 w-5" /> Market de proveedores del Estado
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-2">¿Quién le vende esto al Estado?</h1>
          <p className="text-white/85 mt-1 max-w-2xl text-sm sm:text-base">
            Busca un producto y mira qué empresas se lo venden a organismos públicos, a qué precio y con qué
            frecuencia. Si te sale un negocio y no tienes el producto, pídele cotización a otro proveedor en un clic.
          </p>
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ej: resma papel carta, guantes nitrilo, notebook"
              aria-label="Buscar producto"
              className="pl-9 h-12 text-foreground bg-white"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setInput(c)}
                className="text-xs bg-white/15 hover:bg-white/25 transition-colors rounded-full px-3 py-1"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 sm:px-8 mt-6">
        <Tabs defaultValue="buscar">
          <TabsList>
            <TabsTrigger value="buscar" className="gap-2"><Search className="h-4 w-4" /> Buscar proveedores</TabsTrigger>
            <TabsTrigger value="solicitudes" className="gap-2"><Inbox className="h-4 w-4" /> Mis solicitudes</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="mt-4">
            <p className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> {estado}
            </p>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-52 w-full" />)}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {proveedores.map((p) => (
                  <ProveedorCard key={p.rut} p={p} onPedir={(prod) => setPedirA({ prov: p, producto: prod })} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="solicitudes" className="mt-4">
            <MisSolicitudes onResponder={setResponder} onChat={setChatSolicitud} onEditarContacto={setContactoDe} />
          </TabsContent>
        </Tabs>
      </div>

      <SolicitarDialog
        proveedor={pedirA?.prov ?? null}
        productoInicial={pedirA?.producto ?? ""}
        onClose={() => setPedirA(null)}
      />
      <CotizarDialog solicitud={responder} onClose={() => setResponder(null)} />
      <ChatDialog solicitud={chatSolicitud} onClose={() => setChatSolicitud(null)} />
      <ContactoDialog
        rutNorm={contactoDe?.proveedor_rut_norm ?? null}
        nombreInicial={contactoDe?.contraparte ?? "este proveedor"}
        onClose={() => setContactoDe(null)}
      />
    </div>
  );
}
