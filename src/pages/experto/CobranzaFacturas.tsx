import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HandCoins, Plus, Trash2, FileText, Copy, Download, Loader2, Building2, User, AlertTriangle, Scale,
  Check, ChevronsUpDown, Upload, ExternalLink, RefreshCw, Paperclip, MessageSquare, CalendarClock, Search,
  ChevronDown, ChevronRight, MoreVertical, CheckCircle2, CircleDollarSign, Info, Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useCliente } from '@/hooks/useCliente';
import { supabase } from '@/integrations/supabase/client';
import { descargarCartaAbogadoPDF } from '@/services/cartaAbogadoPdf';
import {
  descargarNotaCobroPDF, descargarNotaDebitoExentaPDF, notaCobroBase64, notaDebitoExentaBase64,
  cuerpoCorreoCobroHtml, type DatosNotaCobranza,
} from '@/services/notasCobranzaPdf';
import { gmailCrearBorrador } from '@/hooks/useGmail';
import { useOpcionesOC, useMisOcAceptadas, useOcLinksPorCodigos, useSyncMisOC, useOrdenCompra, etiquetaEstado } from '@/hooks/useOrdenesCompra';
import {
  useFacturasCobrar, useCrearFactura, useActualizarFactura, useEliminarFactura, useTasasMora,
  diasAtraso, interesMoraReal, diasDiferenciaPago, hechosCobranza, fechasConsistentes, fechaPago, fechaPagoReal,
  subirAdjuntoCobranza, CLP, ESTADO_COBRO_LABEL,
  type FacturaCobrar, type DeudorTipo, type EstadoCobro,
} from '@/hooks/useCobranza';
import type { TasaMora, ResultadoInteres } from '@/lib/interesMora';
import { CargaMasivaCobranzaDialog } from '@/components/experto/CargaMasivaCobranza';
import {
  useSeguimientoCobranza, useAgregarSeguimiento, useEliminarSeguimiento,
  CANAL_LABEL, type CanalSeguimiento,
} from '@/hooks/useSeguimientoCobranza';

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

type Filtro = 'activas' | 'atrasadas' | 'pagadas' | 'todas';
const FILTRO_LABEL: Record<Filtro, string> = { activas: 'Por cobrar', atrasadas: 'Atrasadas', pagadas: 'Pagadas', todas: 'Todas' };

const fFecha = (s: string | null) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CL') : '—');
const fFechaD = (d: Date | null) => (d ? d.toLocaleDateString('es-CL') : '—');

export default function CobranzaFacturas() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: cliente } = useCliente();
  const token = session?.access_token ?? '';
  const auth = { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (token || ANON) };

  const { data: facturas = [], isLoading } = useFacturasCobrar();
  const { data: tasas = [] } = useTasasMora();
  const actualizar = useActualizarFactura();
  const eliminar = useEliminarFactura();
  const { data: ocLinks } = useOcLinksPorCodigos(facturas.filter((f) => f.deudor_tipo === 'estado').map((f) => f.oc_codigo || ''));

  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpandido((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const [filtro, setFiltro] = useState<Filtro>('activas');
  const [q, setQ] = useState('');

  const abrirArchivo = async (path: string) => {
    const { data, error } = await supabase.storage.from('documentos-empresa').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error('No se pudo abrir el archivo. Reintenta.'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const [doc, setDoc] = useState<{ open: boolean; titulo: string; texto: string; generando: boolean }>({ open: false, titulo: '', texto: '', generando: false });

  const activa = (f: FacturaCobrar) => f.estado !== 'pagada' && f.estado !== 'incobrable';

  const totales = useMemo(() => {
    const activas = facturas.filter(activa);
    const atrasadas = activas.filter((f) => (diasAtraso(f) ?? 0) > 0);
    const interes = atrasadas.reduce((s, f) => s + interesMoraReal(f, tasas).interes, 0);
    return {
      porCobrar: activas.reduce((s, f) => s + (f.monto || 0), 0),
      nAtrasadas: atrasadas.length,
      montoAtrasado: atrasadas.reduce((s, f) => s + (f.monto || 0), 0),
      interes,
    };
  }, [facturas, tasas]);

  // Alerta "paga tarde": agrupa por deudor las facturas activas ya atrasadas.
  const pagadoresLentos = useMemo(() => {
    const map = new Map<string, { nombre: string; n: number; monto: number; maxDias: number }>();
    for (const f of facturas) {
      if (!activa(f)) continue;
      const d = diasAtraso(f) ?? 0;
      if (d <= 0) continue;
      const cur = map.get(f.deudor_nombre) || { nombre: f.deudor_nombre, n: 0, monto: 0, maxDias: 0 };
      cur.n += 1; cur.monto += f.monto || 0; cur.maxDias = Math.max(cur.maxDias, d);
      map.set(f.deudor_nombre, cur);
    }
    return [...map.values()].sort((a, b) => b.maxDias - a.maxDias);
  }, [facturas]);

  const facturasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return facturas.filter((f) => {
      if (filtro === 'activas' && !activa(f)) return false;
      if (filtro === 'atrasadas' && !(activa(f) && (diasAtraso(f) ?? 0) > 0)) return false;
      if (filtro === 'pagadas' && f.estado !== 'pagada') return false;
      if (!term) return true;
      return [f.deudor_nombre, f.oc_codigo, f.numero_factura, f.deudor_rut]
        .some((v) => (v || '').toLowerCase().includes(term));
    });
  }, [facturas, filtro, q]);

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

  // Arma los datos de cobro (acreedor + deudor + interés real) para PDFs y correo.
  const datosNotaDe = (f: FacturaCobrar): DatosNotaCobranza => ({
    empresa: {
      nombre: cliente?.empresa_nombre || 'FirmaVB',
      rut: (cliente as any)?.rut || '',
      direccion: (cliente as any)?.direccion || '',
      telefono: (cliente as any)?.telefono || '',
      email: (cliente as any)?.email_contacto || (cliente as any)?.email || '',
    },
    deudor: { nombre: f.deudor_nombre, rut: f.deudor_rut, email: f.deudor_email, tipo: f.deudor_tipo },
    numeroFactura: f.numero_factura, oc: f.oc_codigo, capital: f.monto,
    fechaEmision: f.fecha_emision, fechaRecepcion: f.fecha_recepcion,
    fechaVencimiento: fechaPago(f), fechaCalculo: fechaPagoReal(f) ?? new Date(),
    interes: interesMoraReal(f, tasas),
  });

  // Nota de cobro / nota de débito exenta (borradores para el ERP del cliente).
  const generarNota = (f: FacturaCobrar, tipo: 'cobro' | 'debito') => {
    const datos = datosNotaDe(f);
    if (tipo === 'debito' && datos.interes.interes <= 0) {
      toast.error('Esta factura no tiene interés por mora que cobrar (está en plazo o sin fecha suficiente).');
      return;
    }
    if (tipo === 'cobro') descargarNotaCobroPDF(datos); else descargarNotaDebitoExentaPDF(datos);
    toast.success(tipo === 'cobro' ? 'Nota de cobro descargada' : 'Nota de débito exenta descargada');
  };

  // Deja en el Gmail del usuario un borrador de cobro con los PDFs y la
  // factura/guía adjuntas, y el cuerpo con el respaldo técnico/legal.
  const enviarBorradorGmail = async (f: FacturaCobrar) => {
    if (!f.deudor_email) {
      toast.error('Agrega el correo del deudor a la factura para dejar el borrador de cobro.');
      return;
    }
    const datos = datosNotaDe(f);
    const adjuntos = [{ ...notaCobroBase64(datos), mimeType: 'application/pdf' }];
    if (datos.interes.interes > 0) adjuntos.push({ ...notaDebitoExentaBase64(datos), mimeType: 'application/pdf' });
    const storage = [
      f.factura_archivo_url ? { path: f.factura_archivo_url, filename: f.factura_archivo_nombre || 'factura.pdf' } : null,
      f.guia_archivo_url ? { path: f.guia_archivo_url, filename: f.guia_archivo_nombre || 'guia.pdf' } : null,
    ].filter(Boolean) as { path: string; filename: string }[];
    const subject = `Cobro de factura ${f.numero_factura ? `N° ${f.numero_factura}` : ''} — ${datos.empresa.nombre}`.trim();
    try {
      const r = await gmailCrearBorrador({ to: f.deudor_email, subject, bodyHtml: cuerpoCorreoCobroHtml(datos), adjuntos, storage });
      toast.success('Borrador de cobro creado en tu Gmail', r.link ? { action: { label: 'Abrir Gmail', onClick: () => window.open(r.link!, '_blank') } } : undefined);
    } catch (e: any) {
      if (e?.code === 'no_conectado') {
        toast.error('Conecta tu Gmail primero.', { action: { label: 'Ir a Integraciones', onClick: () => navigate('/configuracion/integraciones') } });
      } else {
        toast.error(e?.message || 'No se pudo crear el borrador');
      }
    }
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><HandCoins className="h-6 w-6" /></div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobranza de facturas</h1>
          <p className="text-sm text-muted-foreground">
            Tu CRM de cobranza: registra facturas y OC, sigue el pago, mide el atraso y el interés por mora
            (tasa máxima convencional), y genera la carta de cobro con un clic.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Por cobrar (activas)</p><p className="text-xl font-bold">{CLP(totales.porCobrar)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Facturas atrasadas</p><p className="text-xl font-bold text-red-600">{totales.nAtrasadas}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Monto atrasado</p><p className="text-xl font-bold text-red-600">{CLP(totales.montoAtrasado)}</p></CardContent></Card>
        <Card><CardContent className="py-4"><p className="text-xs text-muted-foreground">Interés por mora</p><p className="text-xl font-bold text-amber-600">{CLP(totales.interes)}</p></CardContent></Card>
      </div>

      {pagadoresLentos.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4" /> Te están pagando tarde
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {pagadoresLentos.slice(0, 6).map((l) => (
              <div key={l.nombre} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{l.nombre}</span>
                <span className="shrink-0 text-muted-foreground">{l.n} factura(s) · {CLP(l.monto)} · hasta {l.maxDias}d</span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-muted-foreground">Ojo antes de volver a ofertarles: llevan facturas tuyas atrasadas.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar deudor, OC o N° factura…" className="h-9 w-[240px] pl-8" />
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(FILTRO_LABEL) as Filtro[]).map((k) => <SelectItem key={k} value={k}>{FILTRO_LABEL[k]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <CargaMasivaCobranzaDialog />
          <NuevaFacturaDialog />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : facturas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aún no registras facturas por cobrar. Agrega la primera (o pega tu N° de OC) para empezar a hacer seguimiento.
        </CardContent></Card>
      ) : facturasFiltradas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Ninguna factura coincide con el filtro. Prueba "Todas" o cambia la búsqueda.
        </CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Deudor / OC</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Recepción</TableHead>
                  <TableHead>Plazo / atraso</TableHead>
                  <TableHead className="text-right">Interés mora</TableHead>
                  <TableHead>Pago</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturasFiltradas.map((f) => (
                  <FilaFactura
                    key={f.id}
                    f={f}
                    tasas={tasas}
                    ocLink={f.deudor_tipo === 'estado' && f.oc_codigo ? ocLinks?.get(f.oc_codigo) : undefined}
                    expandido={expandido.has(f.id)}
                    onToggle={() => toggle(f.id)}
                    onEstado={async (v) => {
                      try { await actualizar.mutateAsync({ id: f.id, estado: v }); toast.success('Estado actualizado'); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                    onMarcarPagada={async (fecha, monto) => {
                      try { await actualizar.mutateAsync({ id: f.id, estado: 'pagada', fecha_pago_real: fecha, monto_pagado: monto }); toast.success('Factura marcada como pagada'); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                    onReabrir={async () => {
                      try { await actualizar.mutateAsync({ id: f.id, estado: 'pendiente', fecha_pago_real: null, monto_pagado: null }); toast.success('Cobranza reabierta'); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                    onEliminar={async () => {
                      try { await eliminar.mutateAsync(f.id); toast.success('Factura eliminada'); }
                      catch (e) { toast.error((e as Error).message); }
                    }}
                    onGenerar={generar}
                    onNota={generarNota}
                    onGmail={enviarBorradorGmail}
                    generando={doc.generando}
                    abrirArchivo={abrirArchivo}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
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

// ---------------------------------------------------------------------------
// Fila de la tabla (una factura) + fila expandible con el detalle del CRM.
// ---------------------------------------------------------------------------
function FilaFactura({
  f, tasas, ocLink, expandido, onToggle, onEstado, onMarcarPagada, onReabrir, onEliminar, onGenerar, onNota, onGmail, generando, abrirArchivo,
}: {
  f: FacturaCobrar;
  tasas: TasaMora[];
  ocLink?: { link_oficial: string | null; estado: string | null };
  expandido: boolean;
  onToggle: () => void;
  onEstado: (v: EstadoCobro) => void;
  onMarcarPagada: (fecha: string, monto: number | null) => void;
  onReabrir: () => void;
  onEliminar: () => void;
  onGenerar: (f: FacturaCobrar, tipo: 'carta_cobranza' | 'requerimiento_pago') => void;
  onNota: (f: FacturaCobrar, tipo: 'cobro' | 'debito') => void;
  onGmail: (f: FacturaCobrar) => void;
  generando: boolean;
  abrirArchivo: (path: string) => void;
}) {
  const d = diasAtraso(f);
  const interes = useMemo(() => interesMoraReal(f, tasas), [f, tasas]);
  const dif = diasDiferenciaPago(f);
  const [confirmar, setConfirmar] = useState(false);
  const pagada = f.estado === 'pagada';

  return (
    <>
      <TableRow className={cn(expandido && 'border-b-0')}>
        <TableCell className="align-top">
          <button type="button" onClick={onToggle} className="text-muted-foreground hover:text-foreground" aria-label={expandido ? 'Contraer' : 'Expandir'}>
            {expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </TableCell>
        <TableCell className="align-top">
          <div className="flex items-start gap-1.5">
            {f.deudor_tipo === 'estado' ? <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            <div className="min-w-0">
              <p className="max-w-[220px] truncate font-medium">{f.deudor_nombre}</p>
              {f.oc_codigo && <p className="text-xs text-muted-foreground">OC {f.oc_codigo}</p>}
            </div>
          </div>
        </TableCell>
        <TableCell className="align-top">
          <p className="text-sm">{f.numero_factura || <span className="text-muted-foreground">s/n</span>}</p>
          <p className="text-xs text-muted-foreground">{fFecha(f.fecha_emision)}</p>
        </TableCell>
        <TableCell className="align-top text-right font-medium tabular-nums">{CLP(f.monto)}</TableCell>
        <TableCell className="align-top text-sm text-muted-foreground">{fFecha(f.fecha_recepcion)}</TableCell>
        <TableCell className="align-top">
          <p className="text-sm">{fFechaD(fechaPago(f))}</p>
          {!pagada && d != null && d > 0
            ? <Badge variant="outline" className="mt-0.5 border-red-200 bg-red-50 text-red-700">{d} días</Badge>
            : !pagada && d != null && d <= 0
              ? <span className="text-xs text-muted-foreground">en plazo</span>
              : null}
        </TableCell>
        <TableCell className="align-top text-right">
          {interes.interes > 0 ? <InteresPopover res={interes} /> : <span className="text-sm text-muted-foreground">—</span>}
        </TableCell>
        <TableCell className="align-top">
          {pagada ? (
            <div>
              <span className="inline-flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> {fFecha(f.fecha_pago_real)}</span>
              {dif != null && (
                <p className={cn('text-xs', dif > 0 ? 'text-red-600' : 'text-green-600')}>{dif > 0 ? `+${dif}d tarde` : dif < 0 ? `${-dif}d antes` : 'en el plazo'}</p>
              )}
            </div>
          ) : (
            <MarcarPagadaPopover montoSugerido={f.monto} onConfirmar={onMarcarPagada} />
          )}
        </TableCell>
        <TableCell className="align-top">
          <Select value={f.estado} onValueChange={(v) => onEstado(v as EstadoCobro)}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(ESTADO_COBRO_LABEL) as EstadoCobro[]).map((e) => <SelectItem key={e} value={e}>{ESTADO_COBRO_LABEL[e]}</SelectItem>)}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className="align-top text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled={generando} onClick={() => onGenerar(f, 'carta_cobranza')}>
                <FileText className="mr-2 h-4 w-4" /> Carta de cobro
              </DropdownMenuItem>
              <DropdownMenuItem disabled={generando} onClick={() => onGenerar(f, 'requerimiento_pago')}>
                <Scale className="mr-2 h-4 w-4" /> Requerimiento de pago
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onNota(f, 'cobro')}>
                <HandCoins className="mr-2 h-4 w-4" /> Nota de cobro (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNota(f, 'debito')}>
                <CircleDollarSign className="mr-2 h-4 w-4" /> Nota de débito exenta (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onGmail(f)}>
                <Mail className="mr-2 h-4 w-4" /> Dejar borrador en Gmail
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {f.factura_archivo_url && (
                <DropdownMenuItem onClick={() => abrirArchivo(f.factura_archivo_url!)}><Paperclip className="mr-2 h-4 w-4" /> Ver factura</DropdownMenuItem>
              )}
              {f.guia_archivo_url && (
                <DropdownMenuItem onClick={() => abrirArchivo(f.guia_archivo_url!)}><Paperclip className="mr-2 h-4 w-4" /> Ver guía</DropdownMenuItem>
              )}
              {ocLink?.link_oficial && (
                <DropdownMenuItem onClick={() => window.open(ocLink.link_oficial!, '_blank', 'noopener,noreferrer')}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Ver OC oficial ({etiquetaEstado(ocLink.estado)})
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {pagada
                ? <DropdownMenuItem onClick={onReabrir}><RefreshCw className="mr-2 h-4 w-4" /> Reabrir cobranza</DropdownMenuItem>
                : null}
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setConfirmar(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
                <AlertDialogDescription>Se borra el registro de cobro y sus adjuntos. Esta acción no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onEliminar}>Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      </TableRow>
      {expandido && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={10} className="py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <DetalleFactura f={f} interes={interes} abrirArchivo={abrirArchivo} />
              <SeguimientoFactura factura={f} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// Popover con el desglose del interés moratorio por tramos (prorrateo TMC).
function InteresPopover({ res }: { res: ResultadoInteres }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 font-medium tabular-nums text-amber-700 hover:underline">
          {CLP(res.interes)}
          {!res.completo ? <AlertTriangle className="h-3 w-3 text-amber-500" /> : <Info className="h-3 w-3 opacity-50" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium">Interés por mora (tasa máxima convencional)</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Ley 18.010 · interés simple base 360, prorrateado por mes según la tasa vigente.</p>
        <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
          {res.detalle.map((t) => (
            <div key={t.mes} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{new Date(t.mes + 'T00:00:00').toLocaleDateString('es-CL', { month: 'short', year: '2-digit' })} · {t.dias}d</span>
              <span>{t.tasa_anual != null ? `${t.tasa_anual}%` : <span className="text-red-600">sin tasa</span>}</span>
              <span className="tabular-nums font-medium">{CLP(t.interes)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm">
          <span className="font-medium">{res.diasAtraso} días de mora</span>
          <span className="font-bold tabular-nums">{CLP(res.interes)}</span>
        </div>
        {!res.completo && (
          <p className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-700">
            Faltan tasas CMF de algún mes del período: el interés mostrado es parcial, no definitivo. Carga las tasas faltantes para el cálculo exacto.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Popover para registrar el pago real (fecha + monto) y cerrar la cobranza.
function MarcarPagadaPopover({ montoSugerido, onConfirmar }: { montoSugerido: number; onConfirmar: (fecha: string, monto: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState(String(montoSugerido || ''));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs"><CircleDollarSign className="h-3.5 w-3.5" /> Marcar pagada</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <p className="text-sm font-medium">Registrar pago</p>
        <div>
          <Label htmlFor="pago-fecha" className="text-xs">Fecha de pago</Label>
          <Input id="pago-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-8" />
        </div>
        <div>
          <Label htmlFor="pago-monto" className="text-xs">Monto pagado</Label>
          <Input id="pago-monto" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} className="h-8" />
        </div>
        <Button size="sm" className="w-full" onClick={() => {
          if (!fecha) { toast.error('Indica la fecha de pago'); return; }
          const m = Number(String(monto).replace(/[^0-9]/g, ''));
          onConfirmar(fecha, m || null);
          setOpen(false);
        }}>Confirmar pago</Button>
      </PopoverContent>
    </Popover>
  );
}

// Detalle de la factura dentro de la fila expandida: fechas, adjuntos y respaldo.
function DetalleFactura({ f, interes, abrirArchivo }: { f: FacturaCobrar; interes: ResultadoInteres; abrirArchivo: (path: string) => void }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalle</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Emisión</dt><dd>{fFecha(f.fecha_emision)}</dd>
        <dt className="text-muted-foreground">Recepción conforme</dt><dd>{fFecha(f.fecha_recepcion)}</dd>
        <dt className="text-muted-foreground">Debe pagarse</dt><dd>{fFechaD(fechaPago(f))}</dd>
        {f.deudor_rut && (<><dt className="text-muted-foreground">RUT deudor</dt><dd>{f.deudor_rut}</dd></>)}
        {f.estado === 'pagada' && (<><dt className="text-muted-foreground">Pagado</dt><dd>{fFecha(f.fecha_pago_real)}{f.monto_pagado != null ? ` · ${CLP(f.monto_pagado)}` : ''}</dd></>)}
        {interes.interes > 0 && (<><dt className="text-muted-foreground">Interés mora</dt><dd className="text-amber-700">{CLP(interes.interes)} ({interes.diasAtraso}d)</dd></>)}
      </dl>
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs">
        {f.factura_archivo_url
          ? <button type="button" className="inline-flex items-center gap-1 text-firmavb-blue hover:underline" onClick={() => abrirArchivo(f.factura_archivo_url!)}><Paperclip className="h-3 w-3" /> Ver factura</button>
          : <AdjuntarBoton factura={f} tipo="factura" />}
        {f.guia_archivo_url
          ? <button type="button" className="inline-flex items-center gap-1 text-firmavb-blue hover:underline" onClick={() => abrirArchivo(f.guia_archivo_url!)}><Paperclip className="h-3 w-3" /> Ver guía</button>
          : <AdjuntarBoton factura={f} tipo="guia" />}
      </div>
      {f.notas && <p className="rounded bg-background p-2 text-xs text-muted-foreground">{f.notas}</p>}
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
  onSelect: (oc: { codigo: string; organismo_comprador: string | null; rut_demandante: string | null; total: number | null; fecha_emision: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: cliente } = useCliente();
  // Lista TODAS mis OC aceptadas por mi RUT (el "cubo"): ya no exige elegir el
  // organismo primero. Si viene `institucion` se usa solo como filtro extra.
  // Al elegir una OC, el organismo se autocompleta desde la propia orden.
  const { data: ocs = [], isLoading, refetch, isFetching } = useMisOcAceptadas(
    cliente?.rut || null,
    cliente?.empresa_nombre || null,
    institucion || undefined,
  );
  const sync = useSyncMisOC();

  return (
    <div className="flex gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal">
            <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>{value || 'Elige una OC de tus órdenes…'}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,780px)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Filtra por código u organismo…" />
            <CommandList className="max-h-[340px]">
              {isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando tus OC…</div>
              ) : (
                <>
                  <CommandEmpty>
                    No tienes OC{institucion ? ' de este organismo' : ''} aún. Prueba "Actualizar mis OC".
                  </CommandEmpty>
                  <CommandGroup>
                    <div className="grid grid-cols-[1.4fr_0.9fr_0.8fr_1.7fr_0.9fr] gap-2 px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      <span>Código</span><span>Estado</span><span>Emisión</span><span>Organismo</span><span className="text-right">Monto</span>
                    </div>
                    {ocs.map((o) => (
                      <CommandItem key={o.codigo} value={`${o.codigo} ${o.organismo_comprador ?? ''}`} onSelect={() => { onSelect(o); setOpen(false); }} className="cursor-pointer">
                        <div className="grid w-full grid-cols-[1.4fr_0.9fr_0.8fr_1.7fr_0.9fr] items-center gap-2 text-xs">
                          <span className="flex items-center gap-1 font-medium">
                            <Check className={cn('h-3.5 w-3.5 shrink-0', value === o.codigo ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{o.codigo}</span>
                            {o.link_oficial && (
                              <a href={o.link_oficial} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                 className="shrink-0 text-firmavb-blue hover:underline" title="Ver OC en Mercado Público">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </span>
                          <span className="truncate text-muted-foreground">{etiquetaEstado(o.estado) ?? '—'}</span>
                          <span className="truncate text-muted-foreground">{fFecha(o.fecha_emision ? o.fecha_emision.slice(0, 10) : null)}</span>
                          <span className="truncate text-muted-foreground">{o.organismo_comprador ?? '—'}</span>
                          <span className="truncate text-right font-medium">{CLP(o.total || 0)}</span>
                        </div>
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

// Adjuntar la factura o la guía DESPUÉS de creada (p. ej. tras una carga
// masiva por Excel, que solo trae los datos, no los PDF). Solo se muestra
// cuando ese documento en particular todavía falta.
function AdjuntarBoton({ factura, tipo }: { factura: FacturaCobrar; tipo: 'factura' | 'guia' }) {
  const { data: cliente } = useCliente();
  const actualizar = useActualizarFactura();
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (file: File) => {
    if (!cliente?.user_id) { toast.error('No hay cliente activo'); return; }
    setSubiendo(true);
    try {
      const { url, nombre } = await subirAdjuntoCobranza(cliente.user_id, file, tipo);
      try {
        await actualizar.mutateAsync(tipo === 'factura'
          ? { id: factura.id, factura_archivo_url: url, factura_archivo_nombre: nombre }
          : { id: factura.id, guia_archivo_url: url, guia_archivo_nombre: nombre });
      } catch (e) {
        const { error: errLimpieza } = await supabase.storage.from('documentos-empresa').remove([url]);
        if (errLimpieza) console.error('[CobranzaFacturas] No se pudo limpiar el adjunto huérfano tras falla al actualizar la factura:', errLimpieza);
        throw e;
      }
      toast.success(tipo === 'factura' ? 'Factura adjuntada' : 'Guía adjuntada');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo subir el archivo');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      <button type="button" disabled={subiendo}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-firmavb-blue hover:underline disabled:opacity-50"
        onClick={() => inputRef.current?.click()}>
        {subiendo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {tipo === 'factura' ? 'Adjuntar factura' : 'Adjuntar guía'}
      </button>
    </>
  );
}

function NuevaFacturaDialog() {
  const crear = useCrearFactura();
  const { data: cliente } = useCliente();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<DeudorTipo>('estado');
  const [nombre, setNombre] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [oc, setOc] = useState('');
  const [numero, setNumero] = useState('');
  const [monto, setMonto] = useState('');
  const [emision, setEmision] = useState('');
  const [recepcion, setRecepcion] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [notas, setNotas] = useState('');
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [leyendoPdf, setLeyendoPdf] = useState(false);
  const leerReqId = useRef(0); // invalida lecturas de PDF en curso si cambia el archivo o se cierra
  const [guiaFile, setGuiaFile] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const facturaInput = useRef<HTMLInputElement | null>(null);
  const guiaInput = useRef<HTMLInputElement | null>(null);
  const [ocBusqueda, setOcBusqueda] = useState('');
  const [codigoBuscar, setCodigoBuscar] = useState<string | null>(null);
  const ocQuery = useOrdenCompra(codigoBuscar, false);
  const buscandoOc = ocQuery.isFetching && !!codigoBuscar;

  // Atajo "pega la OC": cuando la búsqueda por número termina, autocompleta
  // organismo, RUT, monto y fecha desde Mercado Público (o avisa si no está).
  useEffect(() => {
    if (!codigoBuscar || !ocQuery.isSuccess) return;
    const d = ocQuery.data;
    if (d) {
      setTipo('estado');
      setNombre(d.institucion_nombre || '');
      setRut(d.institucion_rut || '');
      setMonto(d.total != null ? String(d.total) : '');
      setEmision(d.fecha_creacion ? d.fecha_creacion.slice(0, 10) : '');
      setOc(d.codigo);
      toast.success('Datos de la OC cargados. Agrega tu N° de factura y la guía.');
    } else {
      toast.error('No encontramos esa OC en Mercado Público. Revisa el número o complétala a mano.');
    }
    setCodigoBuscar(null);
  }, [ocQuery.isSuccess, ocQuery.data, codigoBuscar]);

  const limpiar = () => {
    setNombre(''); setRut(''); setEmail(''); setOc(''); setNumero(''); setMonto(''); setEmision(''); setRecepcion(''); setVencimiento(''); setNotas('');
    setFacturaFile(null); setGuiaFile(null); setOcBusqueda(''); setCodigoBuscar(null);
    leerReqId.current++;
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

  // Lee la factura PDF con IA y prellena folio, monto y fechas (el cliente revisa).
  const leerPdf = async () => {
    if (!facturaFile) return;
    if (facturaFile.type !== 'application/pdf') { toast.error('El lector funciona con PDF. Para fotos, ingresa los datos a mano.'); return; }
    const target = facturaFile;
    const myId = ++leerReqId.current;
    setLeyendoPdf(true);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = () => reject(new Error('No se pudo leer el archivo'));
        fr.readAsDataURL(target);
      });
      const { data, error } = await supabase.functions.invoke('cobranza-leer-doc', { body: { pdf_base64: b64 } });
      if (error) throw error;
      if (leerReqId.current !== myId) return; // cambiaron el archivo o cerraron: la respuesta ya no aplica
      const r = data as { ok?: boolean; campos?: Record<string, unknown>; error?: string };
      if (!r?.ok || !r.campos) { toast.error(r?.error || 'No se pudo leer el PDF.'); return; }
      const c = r.campos;
      if (c.numero_factura) setNumero(String(c.numero_factura));
      if (c.monto != null) setMonto(String(c.monto));
      if (c.fecha_emision) setEmision(String(c.fecha_emision).slice(0, 10));
      if (c.fecha_recepcion) setRecepcion(String(c.fecha_recepcion).slice(0, 10));
      if (!rut && c.rut_receptor) setRut(String(c.rut_receptor));
      toast.success('Datos leídos del PDF. Revísalos antes de guardar.');
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo leer el PDF.');
    } finally {
      setLeyendoPdf(false);
    }
  };

  const guardar = async () => {
    if (!nombre.trim()) { toast.error(tipo === 'estado' ? 'Elige el organismo al que le cobras' : 'Escribe a quién le cobras'); return; }
    const errorFechas = fechasConsistentes(emision, recepcion, vencimiento);
    if (errorFechas) { toast.error(errorFechas); return; }
    const m = Number(String(monto).replace(/[^0-9]/g, ''));
    setSubiendo(true);
    try {
      const [rFactura, rGuia] = await Promise.allSettled([
        facturaFile ? subirArchivo(facturaFile, 'factura') : Promise.resolve(null),
        guiaFile ? subirArchivo(guiaFile, 'guia') : Promise.resolve(null),
      ]);
      // Si un adjunto se subió y el otro falló, Promise.all habría descartado
      // el que sí subió sin borrarlo del storage (queda huérfano). Con
      // allSettled se limpia el que tuvo éxito antes de abortar.
      if (rFactura.status === 'rejected' || rGuia.status === 'rejected') {
        const subido = [rFactura, rGuia].filter((r): r is PromiseFulfilledResult<{ url: string; nombre: string } | null> => r.status === 'fulfilled').map((r) => r.value?.url).filter((p): p is string => !!p);
        if (subido.length) {
          const { error: errLimpieza } = await supabase.storage.from('documentos-empresa').remove(subido);
          if (errLimpieza) console.error('[CobranzaFacturas] No se pudo limpiar el adjunto huérfano tras falla parcial de subida:', errLimpieza);
        }
        throw (rFactura.status === 'rejected' ? rFactura.reason : (rGuia as PromiseRejectedResult).reason);
      }
      const factura = rFactura.value;
      const guia = rGuia.value;
      try {
        await crear.mutateAsync({
          deudor_tipo: tipo, deudor_nombre: nombre.trim(), deudor_rut: rut.trim() || null, deudor_email: email.trim() || null,
          oc_codigo: oc.trim() || null, numero_factura: numero.trim() || null, monto: m || 0,
          fecha_emision: emision || null, fecha_recepcion: recepcion || null, fecha_vencimiento: vencimiento || null,
          fecha_pago_real: null, monto_pagado: null,
          notas: notas.trim() || null,
          factura_archivo_url: factura?.url || null, factura_archivo_nombre: factura?.nombre || null,
          guia_archivo_url: guia?.url || null, guia_archivo_nombre: guia?.nombre || null,
        });
      } catch (e) {
        const huerfanos = [factura?.url, guia?.url].filter((p): p is string => !!p);
        if (huerfanos.length) {
          const { error: errLimpieza } = await supabase.storage.from('documentos-empresa').remove(huerfanos);
          if (errLimpieza) console.error('[CobranzaFacturas] No se pudo limpiar el adjunto huérfano tras falla del insert:', errLimpieza);
        }
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
            <Select value={tipo} onValueChange={(v) => { setTipo(v as DeudorTipo); setNombre(''); setRut(''); setOc(''); setMonto(''); setEmision(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="estado">Institución del Estado</SelectItem>
                <SelectItem value="privado">Cliente privado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipo === 'estado' ? (
            <>
              <div className="col-span-2 rounded-md border border-dashed p-3 space-y-2">
                <Label className="text-xs">Atajo: pega tu N° de OC de Mercado Público</Label>
                <div className="flex gap-2">
                  <Input value={ocBusqueda} onChange={(e) => setOcBusqueda(e.target.value)}
                    placeholder="Ej: 1509-1234-SE26"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (ocBusqueda.trim()) setCodigoBuscar(ocBusqueda.trim()); } }} />
                  <Button type="button" variant="secondary" className="shrink-0 gap-1"
                    disabled={buscandoOc || !ocBusqueda.trim()} onClick={() => setCodigoBuscar(ocBusqueda.trim())}>
                    {buscandoOc ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Traer datos
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">Trae organismo, RUT, monto y fecha desde MP. Tú agregas tu N° de factura y la guía.</p>
              </div>
              <div className="col-span-2">
                <Label>Elige la OC de tus órdenes</Label>
                <OcAceptadaCombobox institucion={nombre} value={oc} onSelect={(o) => {
                  setOc(o.codigo);
                  setNombre(o.organismo_comprador || '');
                  setRut(o.rut_demandante || '');
                  setMonto(o.total ? String(o.total) : '');
                  setEmision(o.fecha_emision ? o.fecha_emision.slice(0, 10) : '');
                }} />
                <p className="mt-1 text-[11px] text-muted-foreground">Lista todas tus OC aceptadas (por tu RUT). Al elegir una se autocompletan organismo, RUT, monto y fecha.</p>
              </div>
              <div className="col-span-2">
                <Label>Organismo <span className="font-normal text-muted-foreground">(opcional, para filtrar)</span></Label>
                <InstitucionCombobox value={nombre} onSelect={(v) => { setNombre(v); setOc(''); setRut(''); setMonto(''); setEmision(''); }} />
              </div>
            </>
          ) : (
            <>
              <div className="col-span-2">
                <Label>Elige la OC de tus órdenes <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                <OcAceptadaCombobox institucion="" value={oc} onSelect={(o) => {
                  setOc(o.codigo);
                  setNombre(o.organismo_comprador || '');
                  setRut(o.rut_demandante || '');
                  setMonto(o.total ? String(o.total) : '');
                  setEmision(o.fecha_emision ? o.fecha_emision.slice(0, 10) : '');
                }} />
                <p className="mt-1 text-[11px] text-muted-foreground">Si el cobro nace de una OC tuya, elígela y se autocompleta todo. Si no, completa a mano.</p>
              </div>
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
            <Label htmlFor="f-email">Correo de cobro (opcional)</Label>
            <Input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pagos@organismo.cl" />
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
          <div className="col-span-2 space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium text-muted-foreground">Respaldo (opcional, pero recomendado para el cobro formal)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={facturaInput} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden"
                onChange={(e) => { leerReqId.current++; setFacturaFile(e.target.files?.[0] || null); }} />
              <Button type="button" variant="outline" size="sm" onClick={() => facturaInput.current?.click()}>
                <Upload className="mr-1 h-3.5 w-3.5" /> {facturaFile ? 'Cambiar factura' : 'Adjuntar factura'}
              </Button>
              {facturaFile && <span className="truncate text-xs text-muted-foreground max-w-[160px]">{facturaFile.name}</span>}
              {facturaFile && facturaFile.type === 'application/pdf' && (
                <Button type="button" variant="secondary" size="sm" disabled={leyendoPdf} onClick={leerPdf}>
                  {leyendoPdf ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />} Leer datos del PDF
                </Button>
              )}
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

// Bitácora de seguimiento tipo CRM: anota cada gestión (llamada, correo, etc.)
// sobre una factura, con próximo contacto. Se carga solo al desplegarla.
function SeguimientoFactura({ factura }: { factura: FacturaCobrar }) {
  const { data: items = [], isLoading } = useSeguimientoCobranza(factura.id, true);
  const agregar = useAgregarSeguimiento();
  const eliminar = useEliminarSeguimiento();
  const [canal, setCanal] = useState<CanalSeguimiento>('llamada');
  const [nota, setNota] = useState('');
  const [proximo, setProximo] = useState('');

  const guardar = async () => {
    if (!nota.trim()) { toast.error('Escribe qué pasó en la gestión.'); return; }
    try {
      await agregar.mutateAsync({ factura_id: factura.id, canal, nota: nota.trim(), proximo: proximo || null });
      setNota(''); setProximo('');
      toast.success('Seguimiento anotado');
    } catch (e) { toast.error((e as Error).message); }
  };

  const fFechaSeg = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es-CL');

  return (
    <div className="space-y-3">
      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Seguimiento
      </p>
      <div className="grid gap-2 sm:grid-cols-[130px_1fr_auto]">
        <Select value={canal} onValueChange={(v) => setCanal(v as CanalSeguimiento)}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(CANAL_LABEL) as CanalSeguimiento[]).map((c) => <SelectItem key={c} value={c}>{CANAL_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={nota} onChange={(e) => setNota(e.target.value)} className="h-9"
          placeholder="Ej: Llamé, prometió pago el 15"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }} />
        <Button size="sm" onClick={guardar} disabled={agregar.isPending} className="gap-1">
          <Plus className="h-4 w-4" /> Anotar
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`prox-${factura.id}`} className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CalendarClock className="h-3 w-3" /> Próximo contacto
        </Label>
        <Input id={`prox-${factura.id}`} type="date" value={proximo} onChange={(e) => setProximo(e.target.value)} className="h-8 w-[160px]" />
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin gestiones aún. Anota la primera arriba.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-medium">{fFechaSeg(s.fecha)} · {CANAL_LABEL[s.canal]}</span>
                <span className="text-muted-foreground"> — {s.nota}</span>
                {s.proximo && <span className="text-firmavb-blue"> · próximo {fFechaSeg(s.proximo)}</span>}
              </div>
              <button type="button" aria-label="Eliminar gestión"
                className="shrink-0 text-muted-foreground hover:text-red-600"
                onClick={async () => { try { await eliminar.mutateAsync({ id: s.id, facturaId: factura.id }); } catch (e) { toast.error((e as Error).message); } }}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
