// Market de proveedores del Estado (dentro de la app, al lado de Academia).
// Busca quién le vende un producto al Estado —con precio y frecuencia reales de
// las órdenes de compra— y permite pedirle cotización a otro proveedor. Si el
// proveedor ya está en FirmaVB le llega el aviso; si no, la solicitud lo espera.
import { useMemo, useState } from "react";
import { Store, Search, Building2, ShoppingCart, Send, CheckCircle2, Inbox } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useMarketBuscar,
  useMisSolicitudes,
  useMarketSolicitar,
  useMarketCotizar,
  type MarketProveedor,
  type MarketSolicitud,
} from "@/hooks/useMarketEstado";
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
        : "Solicitud registrada. Se le entregará al proveedor cuando se registre en FirmaVB.");
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
            {!enFirmaVB && " — todavía no está en FirmaVB; lo invitamos y tu solicitud queda esperándolo."}
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
          {p.es_firmavb && (
            <Badge className="shrink-0 bg-firmavb-green/15 text-firmavb-green border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> En FirmaVB
            </Badge>
          )}
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
          {p.es_firmavb ? "Pedir cotización" : "Pedir cotización (lo invitamos)"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Mis solicitudes ──────────────────────────────────────────────
function MisSolicitudes({ onResponder }: { onResponder: (s: MarketSolicitud) => void }) {
  const { data = [], isLoading } = useMisSolicitudes();
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
      {data.map((s) => {
        const meLaPidieron = s.rol === "vendedor";
        return (
          <Card key={s.id}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={meLaPidieron ? "default" : "secondary"}>
                      {meLaPidieron ? "Me la pidieron" : "La pedí yo"}
                    </Badge>
                    {s.estado && <Badge variant="outline" className="capitalize">{s.estado}</Badge>}
                  </div>
                  <p className="font-medium mt-2 truncate">{s.producto || "—"}{s.cantidad ? ` · ${s.cantidad}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.contraparte ? `${meLaPidieron ? "De" : "A"} ${s.contraparte} · ` : ""}{fecha(s.created_at)}
                    {s.oportunidad_codigo ? ` · ${s.oportunidad_codigo}` : ""}
                  </p>
                </div>
                {meLaPidieron && (
                  <Button size="sm" onClick={() => onResponder(s)} className="shrink-0 gap-2">
                    <Send className="h-3.5 w-3.5" /> Cotizar
                  </Button>
                )}
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
          </Card>
        );
      })}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────
export default function MarketEstado() {
  const [input, setInput] = useState("");
  const q = useDebouncedValue(input.trim(), 400);
  const { data: proveedores = [], isLoading, isError } = useMarketBuscar(q);
  const [pedirA, setPedirA] = useState<{ prov: MarketProveedor; producto: string } | null>(null);
  const [responder, setResponder] = useState<MarketSolicitud | null>(null);

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
            <MisSolicitudes onResponder={setResponder} />
          </TabsContent>
        </Tabs>
      </div>

      <SolicitarDialog
        proveedor={pedirA?.prov ?? null}
        productoInicial={pedirA?.producto ?? ""}
        onClose={() => setPedirA(null)}
      />
      <CotizarDialog solicitud={responder} onClose={() => setResponder(null)} />
    </div>
  );
}
