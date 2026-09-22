import { useMemo, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Search, Copy, Send, Tag, Building2, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  normalizarNombre, plantillaSolicitud,
  type CmMarca, type CmSolicitud, type CmEstadoSolicitud,
} from '@/hooks/useConvenioMarcoGestion';

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
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="marcas">Mis marcas</TabsTrigger>
          <TabsTrigger value="detectar">Detectar proveedores</TabsTrigger>
          <TabsTrigger value="solicitudes">Solicitudes de baja</TabsTrigger>
        </TabsList>

        <TabsContent value="marcas" className="mt-4">
          <TabMarcas marcas={marcas} cargando={cargandoMarcas} />
        </TabsContent>
        <TabsContent value="detectar" className="mt-4">
          <TabDetectar marcas={marcas} empresa={cliente?.empresa_nombre ?? null} />
        </TabsContent>
        <TabsContent value="solicitudes" className="mt-4">
          <TabSolicitudes />
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

  const generarSolicitud = async (proveedorNombre: string) => {
    if (!marca) return;
    const texto = plantillaSolicitud({
      empresa, marca: marca.nombre, proveedor: proveedorNombre, producto: productoSel?.producto ?? null,
    });
    try {
      await crearSolicitud.mutateAsync({
        marca_id: marca.id,
        marca_nombre: marca.nombre,
        proveedor_nombre: proveedorNombre,
        producto: productoSel?.producto ?? null,
        producto_key: productoKey,
        motivo: 'No es distribuidor autorizado',
        texto,
      });
      toast.success('Solicitud de baja creada (en la pestaña "Solicitudes de baja")');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo crear la solicitud');
    }
  };

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
                  <button key={p.producto_key} onClick={() => setProductoKey(p.producto_key)}
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
              distribuidores de {marca?.nombre}. Puedes generar una solicitud de baja.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cargandoDetalle ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (detalle?.proveedores?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sin proveedores para este producto.</p>
            ) : (
              <ul className="divide-y">
                {detalle!.proveedores.map((pr) => {
                  const autorizado = autorizadosSet.has(normalizarNombre(pr.proveedor));
                  return (
                    <li key={pr.proveedor} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{pr.proveedor}</p>
                        <p className="text-xs text-muted-foreground">{pr.lineas} líneas</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {autorizado ? (
                          <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Autorizado
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                              <AlertTriangle className="mr-1 h-3 w-3" /> No autorizado
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => generarSolicitud(pr.proveedor)}
                              disabled={crearSolicitud.isPending}>
                              Solicitar baja
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ======================= TAB 3: SOLICITUDES =================================
function TabSolicitudes() {
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
        <SolicitudCard key={s.id} s={s}
          onEstado={async (estado) => {
            try { await actualizar.mutateAsync({ id: s.id, estado }); toast.success('Estado actualizado'); }
            catch (e) { toast.error((e as Error).message); }
          }}
          onGuardarTexto={async (texto) => {
            try { await actualizar.mutateAsync({ id: s.id, texto }); toast.success('Texto guardado'); }
            catch (e) { toast.error((e as Error).message); }
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

function SolicitudCard({ s, onEstado, onGuardarTexto, onEliminar }: {
  s: CmSolicitud;
  onEstado: (e: CmEstadoSolicitud) => void;
  onGuardarTexto: (t: string) => void;
  onEliminar: () => void;
}) {
  const [texto, setTexto] = useState(s.texto ?? '');
  const [abierto, setAbierto] = useState(false);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success('Texto copiado'); }
    catch { toast.error('No se pudo copiar'); }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="truncate font-medium">{s.proveedor_nombre}</p>
            <Badge variant="outline" className={ESTADO_BADGE[s.estado]}>{ESTADO_LABEL[s.estado]}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Marca: {s.marca_nombre ?? '—'}{s.producto ? ` · Producto: ${s.producto}` : ''}
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

          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Send className="mr-1 h-4 w-4" /> Ver texto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Solicitud de baja</DialogTitle>
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
