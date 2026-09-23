import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HandCoins, Plus, Trash2, FileText, Copy, Download, Loader2, Building2, User, AlertTriangle, Scale,
  Check, ChevronsUpDown, Upload, ExternalLink, RefreshCw, Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useCliente } from '@/hooks/useCliente';
import { supabase } from '@/integrations/supabase/client';
import { descargarCartaAbogadoPDF } from '@/services/cartaAbogadoPdf';
import { useOpcionesOC, useMisOcAceptadas, useOcLinksPorCodigos, useSyncMisOC, etiquetaEstado } from '@/hooks/useOrdenesCompra';
import {
  useFacturasCobrar, useCrearFactura, useActualizarFactura, useEliminarFactura,
  diasAtraso, interesEstimado, hechosCobranza, fechasConsistentes, CLP, ESTADO_COBRO_LABEL,
  type FacturaCobrar, type DeudorTipo, type EstadoCobro,
} from '@/hooks/useCobranza';

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

const ESTADO_BADGE: Record<EstadoCobro, string> = {
  pendiente: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  recordada: 'bg-amber-50 text-amber-700 border-amber-200',
  requerida: 'bg-orange-50 text-orange-700 border-orange-200',
  pagada: 'bg-green-50 text-green-700 border-green-200',
  judicial: 'bg-red-50 text-red-700 border-red-200',
  incobrable: 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through',
};

export default function CobranzaFacturas() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: cliente } = useCliente();
  const token = session?.access_token ?? '';
  const auth = { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (token || ANON) };

  const { data: facturas = [], isLoading } = useFacturasCobrar();
  const actualizar = useActualizarFactura();
  const eliminar = useEliminarFactura();
  const { data: ocLinks } = useOcLinksPorCodigos(facturas.filter((f) => f.deudor_tipo === 'estado').map((f) => f.oc_codigo || ''));

  const abrirArchivo = async (path: string) => {
    const { data, error } = await supabase.storage.from('documentos-empresa').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error('No se pudo abrir el archivo. Reintenta.'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const [doc, setDoc] = useState<{ open: boolean; titulo: string; texto: string; generando: boolean }>({ open: false, titulo: '', texto: '', generando: false });

  const totales = useMemo(() => {
    const activas = facturas.filter((f) => f.estado !== 'pagada' && f.estado !== 'incobrable');
    const atrasadas = activas.filter((f) => (diasAtraso(f) ?? 0) > 0);
    return {
      porCobrar: activas.reduce((s, f) => s + (f.monto || 0), 0),
      nAtrasadas: atrasadas.length,
      montoAtrasado: atrasadas.reduce((s, f) => s + (f.monto || 0), 0),
    };
  }, [facturas]);

  async function pedir(body: Record<string, unknown>, onTexto: (t: string) => void) {
    const r = await fetch(`${SUPA}/functions/v1/abogado-consultar`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.mensaje || j.error || `Error ${r.status}`), { status: r.status }); }
    const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = ''; let texto = '';
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n'); buf = parts.pop() || '';
      for (const p of parts) {
        const ln = p.trim(); if (!ln.startsWith('data:')) continue;
        let j: any; try { j = JSON.parse(ln.slice(5)); } catch { continue; }
        if (j.delta) { texto += j.delta; onTexto(texto); }
      }
    }
    return texto;
  }

  const generar = async (f: FacturaCobrar, tipo: 'carta_cobranza' | 'requerimiento_pago') => {
    const titulo = tipo === 'requerimiento_pago' ? `Requerimiento de pago — ${f.deudor_nombre}` : `Carta de cobro — ${f.deudor_nombre}`;
    setDoc({ open: true, titulo, texto: '', generando: true });
    try {
      await pedir({
        modo: 'documento', tipo_documento: tipo, destinatario: f.deudor_nombre,
        codigo: f.oc_codigo || undefined, hechos: hechosCobranza(f, tipo),
        peticion: 'Requerir el pago íntegro de la factura dentro de un plazo breve, con el fundamento legal indicado.',
        ciudad_fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
        huella: 'abogado',
      }, (t) => setDoc((d) => ({ ...d, texto: t })));
    } catch (e: any) {
      setDoc((d) => ({ ...d, generando: false }));
      toast.error(e.message, e.status === 402 || e.status === 401 ? { action: { label: 'Ver planes', onClick: () => navigate('/cuenta') } } : undefined);
      return;
    }
    setDoc((d) => ({ ...d, generando: false }));
  };

  const descargarPDF = () => {
    if (!doc.texto) return;
    descargarCartaAbogadoPDF({
      titulo: doc.titulo,
      empresa: {
        nombre: cliente?.empresa_nombre || 'FirmaVB',
        rut: (cliente as any)?.rut || '',
        direccion: (cliente as any)?.direccion || '',
        telefono: (cliente as any)?.telefono || '',
        email: (cliente as any)?.email_contacto || (cliente as any)?.email || '',
      },
      cuerpo: doc.texto,
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><HandCoins className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobranza de facturas</h1>
          <p className="text-sm text-muted-foreground">
            Registra tus facturas por cobrar (al Estado o a clientes privados) y deja que Don Evaristo Abogado
            genere la carta de cobro y el requerimiento pre-judicial, con el fundamento legal chileno.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Por cobrar (activas)</p><p className="text-xl font-bold">{CLP(totales.porCobrar)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Facturas atrasadas</p><p className="text-xl font-bold text-red-600">{totales.nAtrasadas}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Monto atrasado</p><p className="text-xl font-bold text-red-600">{CLP(totales.montoAtrasado)}</p></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{facturas.length} factura(s) registrada(s)</p>
        <NuevaFacturaDialog />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : facturas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aún no registras facturas por cobrar. Agrega la primera para empezar a gestionar el cobro.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {facturas.map((f) => {
            const d = diasAtraso(f);
            const interes = interesEstimado(f);
            const ocupada = doc.generando;
            return (
              <Card key={f.id}>
                <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {f.deudor_tipo === 'estado'
                        ? <Building2 className="h-4 w-4 text-muted-foreground" />
                        : <User className="h-4 w-4 text-muted-foreground" />}
                      <p className="truncate font-medium">{f.deudor_nombre}</p>
                      <Badge variant="outline" className={ESTADO_BADGE[f.estado]}>{ESTADO_COBRO_LABEL[f.estado]}</Badge>
                      {d != null && d > 0 && f.estado !== 'pagada' && (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                          <AlertTriangle className="mr-1 h-3 w-3" /> {d} días de atraso
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.numero_factura ? `Factura ${f.numero_factura} · ` : ''}{CLP(f.monto)}
                      {interes > 0 ? ` · interés est. ${CLP(interes)}` : ''}
                      {f.oc_codigo ? ` · OC ${f.oc_codigo}` : ''}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {f.factura_archivo_url && (
                        <button type="button" className="inline-flex items-center gap-1 text-firmavb-blue hover:underline" onClick={() => abrirArchivo(f.factura_archivo_url!)}>
                          <Paperclip className="h-3 w-3" /> Ver factura
                        </button>
                      )}
                      {f.guia_archivo_url && (
                        <button type="button" className="inline-flex items-center gap-1 text-firmavb-blue hover:underline" onClick={() => abrirArchivo(f.guia_archivo_url!)}>
                          <Paperclip className="h-3 w-3" /> Ver guía
                        </button>
                      )}
                      {f.deudor_tipo === 'estado' && f.oc_codigo && ocLinks?.get(f.oc_codigo)?.link_oficial && (
                        <a href={ocLinks.get(f.oc_codigo)!.link_oficial!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-firmavb-blue hover:underline">
                          <ExternalLink className="h-3 w-3" /> Ver OC oficial ({etiquetaEstado(ocLinks.get(f.oc_codigo)!.estado)})
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={f.estado} onValueChange={async (v) => {
                      try { await actualizar.mutateAsync({ id: f.id, estado: v as EstadoCobro }); toast.success('Estado actualizado'); }
                      catch (e) { toast.error((e as Error).message); }
                    }}>
                      <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ESTADO_COBRO_LABEL) as EstadoCobro[]).map((e) =>
                          <SelectItem key={e} value={e}>{ESTADO_COBRO_LABEL[e]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" disabled={ocupada} onClick={() => generar(f, 'carta_cobranza')}>
                      <FileText className="mr-1 h-4 w-4" /> Carta de cobro
                    </Button>
                    <Button size="sm" variant="outline" disabled={ocupada} onClick={() => generar(f, 'requerimiento_pago')}>
                      <Scale className="mr-1 h-4 w-4" /> Requerimiento
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600" aria-label="Eliminar factura">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
                          <AlertDialogDescription>Se borra el registro de cobro. Esta acción no se puede deshacer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            try { await eliminar.mutateAsync(f.id); toast.success('Factura eliminada'); }
                            catch (e) { toast.error((e as Error).message); }
                          }}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Documento generado */}
      <Dialog open={doc.open} onOpenChange={(o) => setDoc((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{doc.titulo}</DialogTitle>
            <DialogDescription>
              Documento redactado por Don Evaristo Abogado. Revísalo, edítalo si hace falta y descárgalo para enviarlo.
            </DialogDescription>
          </DialogHeader>
          {doc.generando && !doc.texto ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Redactando el documento…
            </div>
          ) : (
            <Textarea value={doc.texto} onChange={(e) => setDoc((d) => ({ ...d, texto: e.target.value }))}
              rows={16} className="font-mono text-xs" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(doc.texto); toast.success('Texto copiado'); } catch { toast.error('No se pudo copiar'); } }} disabled={!doc.texto}>
              <Copy className="mr-1 h-4 w-4" /> Copiar
            </Button>
            <Button onClick={descargarPDF} disabled={!doc.texto}>
              <Download className="mr-1 h-4 w-4" /> Descargar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Autocompletado de institución del Estado: nombres reales que ya existen en
// órdenes de compra, para que el cliente no escriba (ni invente) el nombre.
function InstitucionCombobox({ value, onSelect }: { value: string; onSelect: (nombre: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const { data: opciones = [], isLoading } = useOpcionesOC('organismo_comprador', q);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>{value || 'Busca el organismo…'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ej: Municipalidad de Maipú…" value={q} onValueChange={setQ} />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</div>
            ) : (
              <>
                <CommandEmpty>{q.length < 2 ? 'Escribe al menos 2 letras' : 'Sin coincidencias en órdenes de compra'}</CommandEmpty>
                <CommandGroup>
                  {opciones.map((op) => (
                    <CommandItem key={op} value={op} onSelect={() => { onSelect(op); setOpen(false); }} className="cursor-pointer">
                      <Check className={cn('mr-2 h-4 w-4', value === op ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{op}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Autocompletado de OC propias ya ACEPTADAS por el organismo (nunca borradores
// ni canceladas): al elegir una se completan RUT, monto y fecha de emisión
// solos, con datos reales de Mercado Público.
function OcAceptadaCombobox({
  institucion, value, onSelect,
}: {
  institucion: string;
  value: string;
  onSelect: (oc: { codigo: string; rut_demandante: string | null; total: number | null; fecha_emision: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: cliente } = useCliente();
  // No se piden OC hasta elegir el organismo: si no, el desplegable mezclaría
  // aceptaciones de cualquier institución con la que el cliente haya trabajado.
  const { data: ocs = [], isLoading, refetch, isFetching } = useMisOcAceptadas(
    institucion ? cliente?.rut || null : null,
    institucion ? cliente?.empresa_nombre || null : null,
    institucion,
  );
  const sync = useSyncMisOC();

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal">
            <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>{value || 'Elige una OC aceptada…'}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Filtra por código…" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando tus OC…</div>
              ) : (
                <>
                  <CommandEmpty>
                    {institucion ? 'No tienes OC aceptadas de este organismo aún. Prueba "Actualizar mis OC".' : 'Primero elige el organismo.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {ocs.map((o) => (
                      <CommandItem key={o.codigo} value={o.codigo} onSelect={() => { onSelect(o); setOpen(false); }} className="cursor-pointer">
                        <Check className={cn('mr-2 h-4 w-4', value === o.codigo ? 'opacity-100' : 'opacity-0')} />
                        <span className="truncate">{o.codigo} · {CLP(o.total || 0)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={sync.isPending || isFetching}
        title="Actualizar mis OC desde Mercado Público"
        onClick={async () => {
          if (!cliente?.id) return;
          try { await sync.mutateAsync({ clienteId: cliente.id }); await refetch(); toast.success('OC actualizadas'); }
          catch (e) { toast.error((e as Error).message || 'No se pudieron actualizar'); }
        }}>
        {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function NuevaFacturaDialog() {
  const crear = useCrearFactura();
  const { data: cliente } = useCliente();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<DeudorTipo>('estado');
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [oc, setOc] = useState('');
  const [numero, setNumero] = useState('');
  const [monto, setMonto] = useState('');
  const [emision, setEmision] = useState('');
  const [recepcion, setRecepcion] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [notas, setNotas] = useState('');
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [guiaFile, setGuiaFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const facturaInput = useRef<HTMLInputElement | null>(null);
  const guiaInput = useRef<HTMLInputElement | null>(null);

  const limpiar = () => {
    setNombre(''); setRut(''); setOc(''); setNumero(''); setMonto(''); setEmision(''); setRecepcion(''); setVencimiento(''); setNotas('');
    setFacturaFile(null); setGuiaFile(null);
  };

  const subirArchivo = async (file: File, tag: 'factura' | 'guia'): Promise<{ url: string; nombre: string } | null> => {
    if (!cliente?.user_id) return null;
    if (file.size > 20 * 1024 * 1024) throw new Error(`${tag === 'factura' ? 'La factura' : 'La guía'} supera el máximo de 20 MB`);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const path = `${cliente.user_id}/cobranza_${tag}_${Date.now()}.${ext}`;
    const up = await supabase.storage.from('documentos-empresa').upload(path, file, { contentType: file.type || 'application/pdf' });
    if (up.error) throw new Error(`No se pudo subir ${tag === 'factura' ? 'la factura' : 'la guía'}: ${up.error.message}`);
    return { url: path, nombre: file.name };
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error(tipo === 'estado' ? 'Elige el organismo al que le cobras' : 'Escribe a quién le cobras'); return; }
    const errorFechas = fechasConsistentes(emision, recepcion, vencimiento);
    if (errorFechas) { toast.error(errorFechas); return; }
    const m = Number(String(monto).replace(/[^0-9]/g, ''));
    setSubiendo(true);
    try {
      const [factura, guia] = await Promise.all([
        facturaFile ? subirArchivo(facturaFile, 'factura') : Promise.resolve(null),
        guiaFile ? subirArchivo(guiaFile, 'guia') : Promise.resolve(null),
      ]);
      try {
        await crear.mutateAsync({
          deudor_tipo: tipo, deudor_nombre: nombre.trim(), deudor_rut: rut.trim() || null,
          oc_codigo: oc.trim() || null, numero_factura: numero.trim() || null, monto: m || 0,
          fecha_emision: emision || null, fecha_recepcion: recepcion || null, fecha_vencimiento: vencimiento || null,
          notas: notas.trim() || null,
          factura_archivo_url: factura?.url || null, factura_archivo_nombre: factura?.nombre || null,
          guia_archivo_url: guia?.url || null, guia_archivo_nombre: guia?.nombre || null,
        });
      } catch (e) {
        const huerfanos = [factura?.url, guia?.url].filter((p): p is string => !!p);
        if (huerfanos.length) await supabase.storage.from('documentos-empresa').remove(huerfanos);
        throw e;
      }
      toast.success('Factura registrada');
      limpiar();
      setAbierto(false);
    } catch (e) { toast.error((e as Error).message || 'No se pudo registrar'); }
    finally { setSubiendo(false); }
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => { setAbierto(o); if (!o) limpiar(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva factura</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva factura por cobrar</DialogTitle>
          <DialogDescription>La fecha de recepción sirve para calcular el plazo de 30 días y el atraso.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>¿A quién le cobras?</Label>
            <Select value={tipo} onValueChange={(v) => { setTipo(v as DeudorTipo); setNombre(''); setRut(''); setOc(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="estado">Institución del Estado</SelectItem>
                <SelectItem value="privado">Cliente privado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === 'estado' ? (
            <>
              <div className="col-span-2">
                <Label>Organismo</Label>
                <InstitucionCombobox value={nombre} onSelect={(v) => { setNombre(v); setOc(''); }} />
              </div>
              <div className="col-span-2">
                <Label>Orden de Compra aceptada</Label>
                <OcAceptadaCombobox institucion={nombre} value={oc} onSelect={(o) => {
                  setOc(o.codigo);
                  setRut(o.rut_demandante || '');
                  setMonto(o.total ? String(o.total) : '');
                  setEmision(o.fecha_emision ? o.fecha_emision.slice(0, 10) : '');
                }} />
                <p className="mt-1 text-[11px] text-muted-foreground">Solo se listan OC ya aceptadas o con recepción conforme — así el respaldo del cobro es real.</p>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-2">
                <Label htmlFor="f-nombre">Nombre del deudor</Label>
                <Input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Comercial XYZ SpA" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="f-oc">Referencia (opcional)</Label>
                <Input id="f-oc" value={oc} onChange={(e) => setOc(e.target.value)} placeholder="N° de pedido o contrato" />
              </div>
            </>
          )}
          <div>
            <Label htmlFor="f-rut">RUT (opcional)</Label>
            <Input id="f-rut" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="76.123.456-7" />
          </div>
          <div>
            <Label htmlFor="f-num">N° de factura</Label>
            <Input id="f-num" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 1042" />
          </div>
          <div>
            <Label htmlFor="f-monto">Monto ($)</Label>
            <Input id="f-monto" value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" placeholder="1500000" />
          </div>
          <div />
          <div>
            <Label htmlFor="f-emision">Fecha emisión</Label>
            <Input id="f-emision" type="date" value={emision} onChange={(e) => setEmision(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="f-recep">Fecha recepción</Label>
            <Input id="f-recep" type="date" value={recepcion} onChange={(e) => setRecepcion(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="f-venc">Vence (opcional)</Label>
            <Input id="f-venc" type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="f-notas">Notas (opcional)</Label>
            <Textarea id="f-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
          <div className="col-span-2 space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">Respaldo (opcional, pero recomendado para el cobro formal)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={facturaInput} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
                onChange={(e) => setFacturaFile(e.target.files?.[0] || null)} />
              <Button type="button" variant="outline" size="sm" onClick={() => facturaInput.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> {facturaFile ? 'Cambiar factura' : 'Adjuntar factura'}
              </Button>
              {facturaFile && <span className="truncate text-xs text-muted-foreground max-w-[160px]">{facturaFile.name}</span>}
              <input ref={guiaInput} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
                onChange={(e) => setGuiaFile(e.target.files?.[0] || null)} />
              <Button type="button" variant="outline" size="sm" onClick={() => guiaInput.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> {guiaFile ? 'Cambiar guía' : 'Adjuntar guía de despacho'}
              </Button>
              {guiaFile && <span className="truncate text-xs text-muted-foreground max-w-[160px]">{guiaFile.name}</span>}
            </div>
            {tipo === 'estado' && oc && <p className="text-[11px] text-muted-foreground">La OC ya queda respaldada con el link oficial de Mercado Público; no hace falta subirla aparte.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={crear.isPending || subiendo}>
            {(crear.isPending || subiendo) && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
