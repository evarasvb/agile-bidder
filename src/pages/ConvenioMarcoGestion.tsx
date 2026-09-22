import { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Search, Copy, Send, Tag, Building2, AlertTriangle, CheckCircle2, FileDown, ChevronDown, FileWarning, ExternalLink, TrendingUp, TrendingDown, Minus, Store } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCliente } from '@/hooks/useCliente';
import { useCMProductos, useCMProductoDetalle } from '@/hooks/useConvenioMarco';
import {
  useCmMarcas, useCrearMarca, useEliminarMarca,
  useCmDistribuidores, useAgregarDistribuidor, useEliminarDistribuidor,
  useCmSolicitudes, useCrearSolicitud, useActualizarSolicitud, useEliminarSolicitud,
  useCmOrdenesProveedor, fetchOrdenesProveedor,
  normalizarNombre, plantillaSolicitud, plantillaCartaAviso,
  type CmMarca, type CmSolicitud, type CmEstadoSolicitud, type CmEtapa, type CmOrden,
} from '@/hooks/useConvenioMarcoGestion';
import { descargarCartaAviso, descargarCartasMasivas, type CartaAvisoData } from '@/services/convenioMarcoPdf';

const ESTADO_LABEL: Record<CmEstadoSolicitud, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
};
const ESTADO_BADGE: Record<CmEstadoSolicitud, string> = {
  borrador: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  enviada: 'bg-blue-50 text-blue-700 border-blue-200',
  aceptada: 'bg-green-50 text-green-700 border-green-200',
  rechazada: 'bg-red-50 text-red-700 border-red-200',
};
const ETAPA_LABEL: Record<CmEtapa, string> = {
  aviso: 'Carta de aviso',
  baja: 'Solicitud de baja',
};

export default function ConvenioMarcoGestion() {
  const { data: cliente } = useCliente();
  const { data: marcas = [], isLoading: cargandoMarcas } = useCmMarcas();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Convenio Marco</h1>
          <p className="text-sm text-muted-foreground">
            Controla quién vende tus marcas en el Catálogo de Convenio Marco y gestiona las
            solicitudes de baja de proveedores que no son distribuidores autorizados.
          </p>
        </div>
      </header>

      <Tabs defaultValue="marcas" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="marcas">Mis marcas</TabsTrigger>
          <TabsTrigger value="detectar">Detectar proveedores</TabsTrigger>
          <TabsTrigger value="catalogo">Catálogo y precios</TabsTrigger>
          <TabsTrigger value="solicitudes">Solicitudes de baja</TabsTrigger>
        </TabsList>

        <TabsContent value="marcas" className="mt-4">
          <TabMarcas marcas={marcas} cargando={cargandoMarcas} />
        </TabsContent>
        <TabsContent value="detectar" className="mt-4">
          <TabDetectar marcas={marcas} empresa={cliente?.empresa_nombre ?? null} />
        </TabsContent>
        <TabsContent value="catalogo" className="mt-4">
          <TabCatalogo marcas={marcas} />
        </TabsContent>
        <TabsContent value="solicitudes" className="mt-4">
          <TabSolicitudes empresa={cliente?.empresa_nombre ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================ TAB 1: MARCAS =================================
function TabMarcas({ marcas, cargando }: { marcas: CmMarca[]; cargando: boolean }) {
  const crear = useCrearMarca();
  const eliminar = useEliminarMarca();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [palabras, setPalabras] = useState('');
  const [notas, setNotas] = useState('');

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre de la marca'); return; }
    const claves = palabras.split(',').map((p) => p.trim()).filter(Boolean);
    try {
      await crear.mutateAsync({ nombre, palabras_clave: claves, notas: notas.trim() || null });
      toast.success('Marca agregada');
      setNombre(''); setPalabras(''); setNotas(''); setAbierto(false);
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo agregar la marca');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Registra las marcas que representas y sus distribuidores autorizados.
        </p>
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva marca</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva marca</DialogTitle>
              <DialogDescription>Las palabras clave se usan para buscar tus productos en el mercado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="m-nombre">Nombre de la marca</Label>
                <Input id="m-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Epson" />
              </div>
              <div>
                <Label htmlFor="m-palabras">Palabras clave (separadas por coma)</Label>
                <Input id="m-palabras" value={palabras} onChange={(e) => setPalabras(e.target.value)} placeholder="epson, ecotank, tinta epson" />
              </div>
              <div>
                <Label htmlFor="m-notas">Notas (opcional)</Label>
                <Textarea id="m-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button onClick={guardar} disabled={crear.isPending}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : marcas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aún no tienes marcas registradas. Agrega la primera para empezar.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {marcas.map((m) => (
            <MarcaCard key={m.id} marca={m} onEliminar={async () => {
              try { await eliminar.mutateAsync(m.id); toast.success('Marca eliminada'); }
              catch (e) { toast.error((e as Error).message || 'No se pudo eliminar'); }
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarcaCard({ marca, onEliminar }: { marca: CmMarca; onEliminar: () => void }) {
  const { data: distribuidores = [] } = useCmDistribuidores(marca.id);
  const agregar = useAgregarDistribuidor();
  const eliminarDist = useEliminarDistribuidor();
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');

  const addDist = async () => {
    if (!nombre.trim()) { toast.error('Escribe el nombre del distribuidor'); return; }
    try {
      await agregar.mutateAsync({ marca_id: marca.id, proveedor_nombre: nombre, proveedor_rut: rut || null });
      setNombre(''); setRut('');
    } catch (e) { toast.error((e as Error).message || 'No se pudo agregar'); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tag className="h-4 w-4 text-primary" /> {marca.nombre}
            </CardTitle>
            {marca.notas && <CardDescription className="mt-1">{marca.notas}</CardDescription>}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600" aria-label="Eliminar marca">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar la marca "{marca.nombre}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán también sus distribuidores autorizados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {marca.palabras_clave.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {marca.palabras_clave.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Distribuidores autorizados</p>
        {distribuidores.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguno aún.</p>
        ) : (
          <ul className="space-y-1">
            {distribuidores.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1 text-sm">
                <span className="truncate">
                  {d.proveedor_nombre}{d.proveedor_rut ? <span className="text-muted-foreground"> · {d.proveedor_rut}</span> : null}
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600"
                  aria-label="Quitar distribuidor"
                  onClick={async () => { try { await eliminarDist.mutateAsync(d.id); } catch (e) { toast.error((e as Error).message); } }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre distribuidor" className="h-8" />
          <Input value={rut} onChange={(e) => setRut(e.target.value)} placeholder="RUT (opcional)" className="h-8 sm:max-w-[140px]" />
          <Button size="sm" variant="outline" className="h-8" onClick={addDist} disabled={agregar.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ========================= TAB 2: DETECTAR ==================================
function TabDetectar({ marcas, empresa }: { marcas: CmMarca[]; empresa: string | null }) {
  const [marcaId, setMarcaId] = useState<string>('');
  const [termino, setTermino] = useState('');
  const [productoKey, setProductoKey] = useState<string | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);

  const marca = marcas.find((m) => m.id === marcaId) || null;
  const { data: distribuidores = [] } = useCmDistribuidores(marcaId || null);
  const { data: prodData, isFetching: buscando } = useCMProductos(termino, 'convenio_marco');
  const productos = prodData?.items ?? [];
  const { data: detalle, isFetching: cargandoDetalle } = useCMProductoDetalle(productoKey, 'convenio_marco');

  const crearSolicitud = useCrearSolicitud();

  const autorizadosSet = useMemo(
    () => new Set(distribuidores.map((d) => normalizarNombre(d.proveedor_nombre))),
    [distribuidores],
  );

  const elegirMarca = (id: string) => {
    setMarcaId(id);
    setProductoKey(null);
    const m = marcas.find((x) => x.id === id);
    setTermino(m?.palabras_clave?.[0] ?? m?.nombre ?? '');
  };

  const productoSel = productos.find((p) => p.producto_key === productoKey) || null;

  const cartaData = (proveedor: string, rut: string | null, ordenes: CmOrden[]): CartaAvisoData => ({
    empresa, marca: marca!.nombre, proveedor, rut,
    texto: plantillaCartaAviso({ empresa, marca: marca!.nombre, proveedor }),
    ordenes,
  });

  // Carta de aviso individual: descarga el PDF y registra la etapa "aviso".
  const generarCarta = async (proveedor: string) => {
    if (!marca) return;
    setOcupado(proveedor);
    try {
      const ordenes = await fetchOrdenesProveedor(proveedor, termino || marca.nombre);
      descargarCartaAviso(cartaData(proveedor, ordenes[0]?.rut_proveedor ?? null, ordenes));
      await crearSolicitud.mutateAsync({
        marca_id: marca.id, marca_nombre: marca.nombre, proveedor_nombre: proveedor,
        proveedor_rut: ordenes[0]?.rut_proveedor ?? null,
        producto: productoSel?.producto ?? null, producto_key: productoKey,
        motivo: 'No es distribuidor autorizado', etapa: 'aviso',
        texto: plantillaCartaAviso({ empresa, marca: marca.nombre, proveedor }), ordenes,
      });
      toast.success('Carta de aviso descargada y registrada en "Solicitudes de baja"');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo generar la carta');
    } finally { setOcupado(null); }
  };

  // Solicitud de baja formal (segunda etapa).
  const generarBaja = async (proveedor: string) => {
    if (!marca) return;
    setOcupado(proveedor);
    try {
      const ordenes = await fetchOrdenesProveedor(proveedor, termino || marca.nombre);
      await crearSolicitud.mutateAsync({
        marca_id: marca.id, marca_nombre: marca.nombre, proveedor_nombre: proveedor,
        proveedor_rut: ordenes[0]?.rut_proveedor ?? null,
        producto: productoSel?.producto ?? null, producto_key: productoKey,
        motivo: 'No es distribuidor autorizado', etapa: 'baja',
        texto: plantillaSolicitud({ empresa, marca: marca.nombre, proveedor, producto: productoSel?.producto ?? null }),
        ordenes,
      });
      toast.success('Solicitud de baja creada en "Solicitudes de baja"');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo crear la solicitud');
    } finally { setOcupado(null); }
  };

  // Envío masivo: una carta por proveedor seleccionado, en un solo PDF.
  const generarMasivas = async () => {
    if (!marca || seleccionados.size === 0) return;
    setOcupado('__bulk__');
    try {
      const cartas: CartaAvisoData[] = [];
      for (const proveedor of seleccionados) {
        const ordenes = await fetchOrdenesProveedor(proveedor, termino || marca.nombre);
        cartas.push(cartaData(proveedor, ordenes[0]?.rut_proveedor ?? null, ordenes));
        await crearSolicitud.mutateAsync({
          marca_id: marca.id, marca_nombre: marca.nombre, proveedor_nombre: proveedor,
          proveedor_rut: ordenes[0]?.rut_proveedor ?? null,
          producto: productoSel?.producto ?? null, producto_key: productoKey,
          motivo: 'No es distribuidor autorizado', etapa: 'aviso',
          texto: plantillaCartaAviso({ empresa, marca: marca.nombre, proveedor }), ordenes,
        });
      }
      descargarCartasMasivas(cartas, marca.nombre);
      toast.success(`${cartas.length} cartas descargadas y registradas`);
      setSeleccionados(new Set());
    } catch (e) {
      toast.error((e as Error).message || 'No se pudieron generar las cartas');
    } finally { setOcupado(null); }
  };

  const toggleSel = (proveedor: string) => setSeleccionados((prev) => {
    const next = new Set(prev);
    if (next.has(proveedor)) next.delete(proveedor); else next.add(proveedor);
    return next;
  });

  if (marcas.length === 0) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
      Primero registra una marca en la pestaña "Mis marcas".
    </CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label>Marca</Label>
            <Select value={marcaId} onValueChange={elegirMarca}>
              <SelectTrigger><SelectValue placeholder="Elige una marca" /></SelectTrigger>
              <SelectContent>
                {marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="d-termino">Buscar producto en el mercado</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="d-termino" className="pl-8" value={termino} onChange={(e) => setTermino(e.target.value)}
                placeholder="palabra clave del producto" />
            </div>
          </div>
        </CardContent>
      </Card>

      {termino.trim().length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Productos encontrados</CardTitle></CardHeader>
          <CardContent>
            {buscando ? (
              <p className="text-sm text-muted-foreground">Buscando…</p>
            ) : productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin coincidencias. Prueba otra palabra.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {productos.slice(0, 20).map((p) => (
                  <button key={p.producto_key} onClick={() => { setProductoKey(p.producto_key); setSeleccionados(new Set()); }}
                    className={`rounded-full border px-3 py-1 text-xs transition ${productoKey === p.producto_key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}>
                    {p.producto} <span className="text-muted-foreground">({p.proveedores})</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {productoKey && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Proveedores que venden este producto</CardTitle>
            <CardDescription>
              Los marcados como <span className="font-medium text-red-600">No autorizado</span> no están en tu lista de
              distribuidores de {marca?.nombre}. Puedes ver sus órdenes de compra, generar una carta de aviso o la solicitud de baja.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {seleccionados.size > 0 && (
              <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <span className="text-sm font-medium">{seleccionados.size} proveedor(es) seleccionado(s)</span>
                <Button size="sm" onClick={generarMasivas} disabled={ocupado === '__bulk__'}>
                  <FileDown className="mr-1 h-4 w-4" /> Generar cartas ({seleccionados.size})
                </Button>
              </div>
            )}
            {cargandoDetalle ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (detalle?.proveedores?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sin proveedores para este producto.</p>
            ) : (
              <ul className="divide-y">
                {detalle!.proveedores.map((pr) => (
                  <FilaProveedor
                    key={pr.proveedor}
                    proveedor={pr.proveedor}
                    lineas={pr.lineas}
                    autorizado={autorizadosSet.has(normalizarNombre(pr.proveedor))}
                    termino={termino || marca?.nombre || ''}
                    seleccionado={seleccionados.has(pr.proveedor)}
                    ocupado={ocupado === pr.proveedor}
                    onToggle={() => toggleSel(pr.proveedor)}
                    onCarta={() => generarCarta(pr.proveedor)}
                    onBaja={() => generarBaja(pr.proveedor)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function fmtCLP(v: number | null): string {
  return v == null ? '-' : '$' + Math.round(v).toLocaleString('es-CL');
}

function FilaProveedor({ proveedor, lineas, autorizado, termino, seleccionado, ocupado, onToggle, onCarta, onBaja }: {
  proveedor: string; lineas: number; autorizado: boolean; termino: string;
  seleccionado: boolean; ocupado: boolean;
  onToggle: () => void; onCarta: () => void; onBaja: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const { data: ordenes = [], isFetching } = useCmOrdenesProveedor(proveedor, termino, abierto);

  return (
    <li className="py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {!autorizado && (
            <input type="checkbox" checked={seleccionado} onChange={onToggle}
              className="h-4 w-4 rounded border-input" aria-label={`Seleccionar ${proveedor}`} />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{proveedor}</p>
            <button onClick={() => setAbierto((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className={`h-3 w-3 transition ${abierto ? 'rotate-180' : ''}`} /> {lineas} líneas · ver órdenes
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {autorizado ? (
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Autorizado
            </Badge>
          ) : (
            <>
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                <AlertTriangle className="mr-1 h-3 w-3" /> No autorizado
              </Badge>
              <Button size="sm" variant="outline" onClick={onCarta} disabled={ocupado}>
                <FileWarning className="mr-1 h-4 w-4" /> Carta de aviso
              </Button>
              <Button size="sm" variant="outline" onClick={onBaja} disabled={ocupado}>
                Solicitar baja
              </Button>
            </>
          )}
        </div>
      </div>
      {abierto && (
        <div className="mt-2 rounded-md bg-muted/40 p-2">
          {isFetching ? (
            <p className="text-xs text-muted-foreground">Cargando órdenes…</p>
          ) : ordenes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin órdenes de compra para este proveedor y palabra clave.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3">N° OC</th>
                    <th className="py-1 pr-3">Organismo</th><th className="py-1 pr-3 text-right">Total</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map((o, i) => (
                    <tr key={`${o.codigo}-${i}`} className="border-t border-border/50">
                      <td className="py-1 pr-3 whitespace-nowrap">{o.fecha ? new Date(o.fecha).toLocaleDateString('es-CL') : '-'}</td>
                      <td className="py-1 pr-3 font-medium">{o.codigo}</td>
                      <td className="py-1 pr-3">{o.organismo ?? '-'}</td>
                      <td className="py-1 pr-3 text-right">{fmtCLP(o.valor_total)}</td>
                      <td className="py-1">
                        {o.link && <a href={o.link} target="_blank" rel="noreferrer" className="text-primary hover:underline" aria-label="Abrir OC"><ExternalLink className="h-3.5 w-3.5" /></a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ==================== TAB: CATÁLOGO Y PRECIOS ==============================
// Inteligencia de precios sobre los mismos datos de Convenio Marco: por
// producto muestra el rango de precios del mercado y, por proveedor, si está
// caro o barato respecto del precio ganador (el más bajo).
function precioVs(prom: number | null, min: number | null) {
  if (prom == null || min == null || min <= 0) return null;
  const diff = ((prom - min) / min) * 100;
  if (diff <= 1) return { label: 'Más barato', cls: 'border-green-200 bg-green-50 text-green-700', Icon: TrendingDown };
  if (diff <= 10) return { label: `+${diff.toFixed(0)}%`, cls: 'border-amber-200 bg-amber-50 text-amber-700', Icon: Minus };
  return { label: `Caro +${diff.toFixed(0)}%`, cls: 'border-red-200 bg-red-50 text-red-700', Icon: TrendingUp };
}

function TabCatalogo({ marcas }: { marcas: CmMarca[] }) {
  const [marcaId, setMarcaId] = useState<string>('');
  const [termino, setTermino] = useState('');
  const [productoKey, setProductoKey] = useState<string | null>(null);

  const { data: prodData, isFetching: buscando } = useCMProductos(termino, 'convenio_marco');
  const productos = prodData?.items ?? [];
  const { data: detalle, isFetching: cargandoDetalle } = useCMProductoDetalle(productoKey, 'convenio_marco');
  const productoSel = productos.find((p) => p.producto_key === productoKey) || null;
  const resumen = detalle?.resumen ?? null;
  const precioMin = resumen?.precio_min ?? productoSel?.precio_min ?? null;

  const elegirMarca = (id: string) => {
    setMarcaId(id);
    setProductoKey(null);
    const m = marcas.find((x) => x.id === id);
    setTermino(m?.palabras_clave?.[0] ?? m?.nombre ?? '');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
          {marcas.length > 0 && (
            <div className="flex-1">
              <Label>Marca (opcional)</Label>
              <Select value={marcaId} onValueChange={elegirMarca}>
                <SelectTrigger><SelectValue placeholder="Elige una marca" /></SelectTrigger>
                <SelectContent>
                  {marcas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1">
            <Label htmlFor="c-termino">Buscar producto en Convenio Marco</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input id="c-termino" className="pl-8" value={termino} onChange={(e) => { setTermino(e.target.value); setProductoKey(null); }}
                placeholder="ej: tóner, papel, bolsa de basura" />
            </div>
          </div>
        </CardContent>
      </Card>

      {termino.trim().length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Productos y rango de precios</CardTitle>
            <CardDescription>Precios de mercado en Convenio Marco. Elige un producto para ver el detalle por proveedor.</CardDescription>
          </CardHeader>
          <CardContent>
            {buscando ? (
              <p className="text-sm text-muted-foreground">Buscando…</p>
            ) : productos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin coincidencias. Prueba otra palabra.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">Producto</th>
                      <th className="py-1 pr-3 text-right">Proveedores</th>
                      <th className="py-1 pr-3 text-right">Más bajo</th>
                      <th className="py-1 pr-3 text-right">Promedio</th>
                      <th className="py-1 pr-3 text-right">Más alto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.slice(0, 25).map((p) => (
                      <tr key={p.producto_key}
                        onClick={() => setProductoKey(p.producto_key)}
                        className={`cursor-pointer border-t border-border/50 hover:bg-muted/50 ${productoKey === p.producto_key ? 'bg-primary/5' : ''}`}>
                        <td className="py-1.5 pr-3">{p.producto}</td>
                        <td className="py-1.5 pr-3 text-right">{p.proveedores}</td>
                        <td className="py-1.5 pr-3 text-right text-green-700">{fmtCLP(p.precio_min)}</td>
                        <td className="py-1.5 pr-3 text-right">{fmtCLP(p.precio_prom)}</td>
                        <td className="py-1.5 pr-3 text-right text-red-700">{fmtCLP(p.precio_max)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {productoKey && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Proveedores y competitividad</CardTitle>
            <CardDescription className="truncate">{productoSel?.producto}</CardDescription>
          </CardHeader>
          <CardContent>
            {cargandoDetalle ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (detalle?.proveedores?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sin proveedores para este producto.</p>
            ) : (
              <ul className="divide-y">
                {detalle!.proveedores.map((pr) => {
                  const badge = precioVs(pr.precio_prom, precioMin);
                  return (
                    <li key={pr.proveedor} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{pr.proveedor}</p>
                        <p className="text-xs text-muted-foreground">
                          {pr.lineas} líneas · precio prom. {fmtCLP(pr.precio_prom)}
                        </p>
                      </div>
                      {badge && (
                        <Badge variant="outline" className={badge.cls}>
                          <badge.Icon className="mr-1 h-3 w-3" /> {badge.label}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {termino.trim().length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Store className="mx-auto mb-2 h-6 w-6 opacity-50" />
          Busca un producto (o elige una marca) para ver precios de mercado y qué proveedores están caros o baratos.
        </CardContent></Card>
      )}
    </div>
  );
}

// ======================= TAB 3: SOLICITUDES =================================
function TabSolicitudes({ empresa }: { empresa: string | null }) {
  const { data: solicitudes = [], isLoading } = useCmSolicitudes();
  const actualizar = useActualizarSolicitud();
  const eliminar = useEliminarSolicitud();

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (solicitudes.length === 0) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
      No hay solicitudes. Genera una desde la pestaña "Detectar proveedores".
    </CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      {solicitudes.map((s) => (
        <SolicitudCard key={s.id} s={s} empresa={empresa}
          onEstado={async (estado) => {
            try { await actualizar.mutateAsync({ id: s.id, estado }); toast.success('Estado actualizado'); }
            catch (e) { toast.error((e as Error).message); }
          }}
          onGuardarTexto={async (texto) => {
            try { await actualizar.mutateAsync({ id: s.id, texto }); toast.success('Texto guardado'); }
            catch (e) { toast.error((e as Error).message); }
          }}
          onEscalar={async () => {
            try {
              const texto = plantillaSolicitud({ empresa, marca: s.marca_nombre ?? '', proveedor: s.proveedor_nombre, producto: s.producto });
              await actualizar.mutateAsync({ id: s.id, etapa: 'baja', texto });
              toast.success('Escalado a solicitud de baja');
            } catch (e) { toast.error((e as Error).message); }
          }}
          onEliminar={async () => {
            try { await eliminar.mutateAsync(s.id); toast.success('Solicitud eliminada'); }
            catch (e) { toast.error((e as Error).message); }
          }}
        />
      ))}
    </div>
  );
}

function SolicitudCard({ s, empresa, onEstado, onGuardarTexto, onEscalar, onEliminar }: {
  s: CmSolicitud;
  empresa: string | null;
  onEstado: (e: CmEstadoSolicitud) => void;
  onGuardarTexto: (t: string) => void;
  onEscalar: () => void;
  onEliminar: () => void;
}) {
  const [texto, setTexto] = useState(s.texto ?? '');
  const [abierto, setAbierto] = useState(false);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success('Texto copiado'); }
    catch { toast.error('No se pudo copiar'); }
  };

  const descargarPdf = () => {
    descargarCartaAviso({
      empresa, marca: s.marca_nombre ?? '', proveedor: s.proveedor_nombre,
      rut: s.proveedor_rut, texto: s.texto ?? '', ordenes: s.ordenes ?? [],
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="truncate font-medium">{s.proveedor_nombre}</p>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">{ETAPA_LABEL[s.etapa]}</Badge>
            <Badge variant="outline" className={ESTADO_BADGE[s.estado]}>{ESTADO_LABEL[s.estado]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Marca: {s.marca_nombre ?? '—'}{s.producto ? ` · Producto: ${s.producto}` : ''}
            {s.ordenes?.length ? ` · ${s.ordenes.length} OC` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={s.estado} onValueChange={(v) => onEstado(v as CmEstadoSolicitud)}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ESTADO_LABEL) as CmEstadoSolicitud[]).map((e) =>
                <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
            </SelectContent>
          </Select>

          {s.etapa === 'aviso' && (
            <>
              <Button size="sm" variant="outline" onClick={descargarPdf}>
                <FileDown className="mr-1 h-4 w-4" /> PDF
              </Button>
              <Button size="sm" variant="outline" onClick={onEscalar}>Escalar a baja</Button>
            </>
          )}

          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Send className="mr-1 h-4 w-4" /> Ver texto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{ETAPA_LABEL[s.etapa]}</DialogTitle>
                <DialogDescription>Edita el texto y cópialo para enviarlo a ChileCompra o al proveedor.</DialogDescription>
              </DialogHeader>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={12} className="font-mono text-xs" />
              <DialogFooter>
                <Button variant="outline" onClick={copiar}><Copy className="mr-1 h-4 w-4" /> Copiar</Button>
                <Button onClick={() => { onGuardarTexto(texto); setAbierto(false); }}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600" aria-label="Eliminar solicitud">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta solicitud?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
