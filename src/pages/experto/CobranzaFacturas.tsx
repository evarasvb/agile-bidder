import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HandCoins, Plus, Trash2, FileText, Copy, Download, Loader2, Building2, User, AlertTriangle, Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useAuth } from '@/hooks/useAuth';
import { useCliente } from '@/hooks/useCliente';
import { descargarCartaAbogadoPDF } from '@/services/cartaAbogadoPdf';
import {
  useFacturasCobrar, useCrearFactura, useActualizarFactura, useEliminarFactura,
  diasAtraso, interesEstimado, hechosCobranza, CLP, ESTADO_COBRO_LABEL,
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

function NuevaFacturaDialog() {
  const crear = useCrearFactura();
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

  const guardar = async () => {
    if (!nombre.trim()) { toast.error('Escribe a quién le cobras (organismo o cliente)'); return; }
    const m = Number(String(monto).replace(/[^0-9]/g, ''));
    try {
      await crear.mutateAsync({
        deudor_tipo: tipo, deudor_nombre: nombre.trim(), deudor_rut: rut.trim() || null,
        oc_codigo: oc.trim() || null, numero_factura: numero.trim() || null, monto: m || 0,
        fecha_emision: emision || null, fecha_recepcion: recepcion || null, fecha_vencimiento: vencimiento || null,
        notas: notas.trim() || null,
      });
      toast.success('Factura registrada');
      setNombre(''); setRut(''); setOc(''); setNumero(''); setMonto(''); setEmision(''); setRecepcion(''); setVencimiento(''); setNotas('');
      setAbierto(false);
    } catch (e) { toast.error((e as Error).message || 'No se pudo registrar'); }
  };

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Nueva factura</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva factura por cobrar</DialogTitle>
          <DialogDescription>La fecha de recepción sirve para calcular el plazo de 30 días y el atraso.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>¿A quién le cobras?</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as DeudorTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="estado">Institución del Estado</SelectItem>
                <SelectItem value="privado">Cliente privado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="f-nombre">Nombre del deudor</Label>
            <Input id="f-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === 'estado' ? 'Ej: Municipalidad de Maipú' : 'Ej: Comercial XYZ SpA'} />
          </div>
          <div>
            <Label htmlFor="f-rut">RUT (opcional)</Label>
            <Input id="f-rut" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="76.123.456-7" />
          </div>
          <div>
            <Label htmlFor="f-oc">{tipo === 'estado' ? 'N° Orden de Compra' : 'Referencia'} (opcional)</Label>
            <Input id="f-oc" value={oc} onChange={(e) => setOc(e.target.value)} placeholder={tipo === 'estado' ? '1234-56-SE26' : ''} />
          </div>
          <div>
            <Label htmlFor="f-num">N° de factura</Label>
            <Input id="f-num" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 1042" />
          </div>
          <div>
            <Label htmlFor="f-monto">Monto ($)</Label>
            <Input id="f-monto" value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" placeholder="1500000" />
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={crear.isPending}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
