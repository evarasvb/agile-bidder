import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scale, Send, Loader2, FileText, Download, Upload, Trash2, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCliente } from '@/hooks/useCliente';
import { toast } from 'sonner';
import { descargarCartaAbogadoPDF } from '@/services/cartaAbogadoPdf';

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

type Msg = { rol: 'yo' | 'exp'; texto: string; fuentes?: any[] };

const conCitas = (html: string, fuentes?: any[]) => html.replace(/\[(\d{1,2})\]/g, (_m, n) => {
  const f = fuentes?.find((x) => String(x.n) === n);
  const titulo = String(f?.fuente ?? `Fuente ${n}`).replace(/"/g, '&quot;');
  return `<sup><a class="cita text-primary font-semibold no-underline hover:underline" href="${f?.url ?? '#'}" title="${titulo}"${f?.url ? ' target="_blank" rel="noreferrer"' : ''}>[${n}]</a></sup>`;
});

const TIPOS_DOCUMENTO = [
  { value: 'apelacion', label: 'Recurso / reclamo por una licitación o compra ágil' },
  { value: 'reclamo_contraloria', label: 'Reclamo ante la Contraloría' },
  { value: 'cobro_intereses_mora', label: 'Nota de débito / cobro de intereses por mora' },
  { value: 'carta', label: 'Carta formal (aclaración, objeción, solicitud)' },
];

const fmtCLP = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');

export default function Abogado() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: cliente } = useCliente();
  const token = session?.access_token ?? '';
  const auth = { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (token || ANON) };

  // Chat
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [limite, setLimite] = useState<string | null>(null);

  // Generar documento
  const [tipoDoc, setTipoDoc] = useState('apelacion');
  const [destinatario, setDestinatario] = useState('');
  const [codigo, setCodigo] = useState('');
  const [hechos, setHechos] = useState('');
  const [peticion, setPeticion] = useState('');
  const [documento, setDocumento] = useState('');
  const [generando, setGenerando] = useState(false);
  // Solo tipo "cobro_intereses_mora": datos para el cálculo exacto de intereses.
  const [montoAdeudado, setMontoAdeudado] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [sigueImpago, setSigueImpago] = useState(true);
  const [fechaPago, setFechaPago] = useState('');
  const [calculoMora, setCalculoMora] = useState<any>(null);

  // Documentos de respaldo (contratos, notificaciones, reclamos previos)
  const [documentos, setDocumentos] = useState<{ id: string; nombre: string; tipo: string }[]>([]);
  const [subiendo, setSubiendo] = useState(false);

  async function pedir(body: Record<string, unknown>, onTexto: (t: string, meta?: any) => void) {
    const r = await fetch(`${SUPA}/functions/v1/abogado-consultar`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(j.mensaje || j.error || `Error ${r.status}`), { status: r.status }); }
    const reader = r.body!.getReader(); const dec = new TextDecoder(); let buf = ''; let texto = ''; let meta: any = null;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split('\n\n'); buf = parts.pop() || '';
      for (const p of parts) {
        const ln = p.trim(); if (!ln.startsWith('data:')) continue;
        let j: any; try { j = JSON.parse(ln.slice(5)); } catch { continue; }
        if (j.meta) meta = j.meta;
        if (j.delta) { texto += j.delta; onTexto(texto, meta); }
      }
    }
    onTexto(texto, meta);
    return { texto, meta };
  }

  const preguntar = async () => {
    const p = pregunta.trim(); if (!p || enviando) return;
    setPregunta(''); setLimite(null);
    const historial = msgs.slice(-6).map((m) => ({ role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto }));
    setMsgs((m) => [...m, { rol: 'yo', texto: p }, { rol: 'exp', texto: '' }]);
    setEnviando(true);
    try {
      await pedir({ modo: 'chat', pregunta: p, historial, huella: 'abogado' }, (t, meta) =>
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { rol: 'exp', texto: t, fuentes: meta?.fuentes }; return c; }));
    } catch (e: any) {
      if (e.status === 402 || e.status === 401) setLimite(e.message);
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { rol: 'exp', texto: (e.status === 402 ? '' : 'No pude responder: ') + e.message }; return c; });
    }
    setEnviando(false);
  };

  const esMora = tipoDoc === 'cobro_intereses_mora';
  const faltanDatosMora = esMora && (!montoAdeudado || Number(montoAdeudado) <= 0 || !fechaVencimiento);
  const puedeGenerar = esMora ? !faltanDatosMora : !!hechos.trim();

  const generarDocumento = async () => {
    if (!puedeGenerar || generando) return;
    setGenerando(true); setDocumento(''); setCalculoMora(null);
    // Para el cobro de mora, los hechos los arman los propios campos (monto/fechas);
    // lo que el usuario escriba en "Hechos" se agrega como contexto adicional.
    const hechosFinal = esMora
      ? `Se adeuda ${fmtCLP(Number(montoAdeudado))}, que debía pagarse el ${fechaVencimiento}. ${sigueImpago ? 'A la fecha sigue sin pagarse.' : `Se pagó el ${fechaPago || '(fecha no indicada)'}.`}${hechos.trim() ? ' ' + hechos.trim() : ''}`
      : hechos;
    try {
      await pedir({
        modo: 'documento', tipo_documento: tipoDoc, destinatario, codigo: codigo || undefined, hechos: hechosFinal, peticion,
        ciudad_fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
        huella: 'abogado',
        ...(esMora ? { monto_adeudado: Number(montoAdeudado), fecha_vencimiento: fechaVencimiento, fecha_pago: sigueImpago ? undefined : (fechaPago || undefined) } : {}),
      }, (t, meta) => { setDocumento(t); if (meta?.calculo_mora) setCalculoMora(meta.calculo_mora); });
    } catch (e: any) {
      toast.error(e.message, e.status === 402 ? { action: { label: 'Ver planes', onClick: () => navigate('/cuenta') } } : undefined);
    }
    setGenerando(false);
  };

  const descargarPDF = () => {
    if (!documento) return;
    descargarCartaAbogadoPDF({
      titulo: TIPOS_DOCUMENTO.find((t) => t.value === tipoDoc)?.label || 'documento',
      empresa: {
        nombre: cliente?.empresa_nombre || 'FirmaVB',
        rut: (cliente as any)?.rut || '',
        direccion: (cliente as any)?.direccion || '',
        telefono: (cliente as any)?.telefono || '',
        email: (cliente as any)?.email_contacto || (cliente as any)?.email || 'contacto@firmavb.cl',
      },
      cuerpo: documento,
    });
  };

  const listarDocumentos = async () => {
    try {
      const r = await fetch(`${SUPA}/functions/v1/experto-documentos`, { headers: auth });
      const j = await r.json().catch(() => ({}));
      setDocumentos(j.documentos ?? []);
    } catch { /* silencioso */ }
  };

  const subirDocumento = async (files: FileList | File[]) => {
    const lista = Array.from(files); if (!lista.length) return;
    setSubiendo(true);
    for (const file of lista) {
      try {
        const r = await fetch(`${SUPA}/functions/v1/experto-documentos`, { method: 'POST', headers: { ...auth, 'Content-Type': file.type || 'application/octet-stream', 'X-Codigo': '', 'X-Nombre': encodeURIComponent(file.name), 'X-Destino': 'documento' }, body: file });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { toast.error(`${file.name}: ${j.mensaje || j.error || 'Error ' + r.status}`); continue; }
        toast.success(`Leído: ${file.name}`);
      } catch (e: any) { toast.error(`${file.name}: ${e.message}`); }
    }
    setSubiendo(false);
    listarDocumentos();
  };

  const borrarDocumento = async (id: string) => {
    try {
      await fetch(`${SUPA}/functions/v1/experto-documentos?id=${id}`, { method: 'DELETE', headers: auth });
      setDocumentos((d) => d.filter((x) => x.id !== id));
    } catch { toast.error('No pude borrar el documento'); }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Scale className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">Don Evaristo Abogado</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Tu asesor legal en Mercado Público: pregúntale en el chat o pídele que redacte una carta de apelación, un reclamo o cualquier documento formal.
      </p>

      <Tabs defaultValue="chat">
        <TabsList>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="documento">Generar documento</TabsTrigger>
          <TabsTrigger value="documentos" onClick={listarDocumentos}>Mis documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3 min-h-[300px] max-h-[55vh] overflow-y-auto">
              {msgs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ej: "Me declararon inadmisible una oferta por un anexo mal firmado, ¿puedo reclamar?" o "¿Qué plazo tengo para apelar una adjudicación?"
                </p>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.rol === 'yo' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block rounded-lg px-3 py-2 text-sm max-w-[85%] ${m.rol === 'yo' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                    dangerouslySetInnerHTML={{ __html: m.rol === 'exp' ? conCitas(m.texto || '…', m.fuentes) : m.texto }} />
                </div>
              ))}
              {limite && <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
                {limite} <Button size="sm" variant="link" onClick={() => navigate('/cuenta')}>Ver planes</Button>
              </div>}
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Input value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder="Escribe tu consulta legal…"
              onKeyDown={(e) => { if (e.key === 'Enter') preguntar(); }} disabled={enviando} />
            <Button onClick={() => preguntar()} disabled={enviando || !pregunta.trim()}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="documento" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del documento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Tipo de documento</Label>
                <Select value={tipoDoc} onValueChange={setTipoDoc}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Destinatario / institución</Label>
                  <Input value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Ej: Municipalidad de Puerto Montt" />
                </div>
                <div>
                  <Label>ID de licitación o compra (opcional)</Label>
                  <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: 2699-35-LE26" />
                </div>
              </div>
              {esMora && (
                <div className="space-y-3 rounded-md border p-3 bg-muted/30">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Monto adeudado (CLP)</Label>
                      <Input type="number" min={1} value={montoAdeudado} onChange={(e) => setMontoAdeudado(e.target.value)} placeholder="Ej: 850000" />
                    </div>
                    <div>
                      <Label>Fecha en que debía pagarse</Label>
                      <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sigueImpago} onChange={(e) => setSigueImpago(e.target.checked)} />
                    A la fecha sigue sin pagarse
                  </label>
                  {!sigueImpago && (
                    <div>
                      <Label>Fecha en que le pagaron</Label>
                      <Input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
              <div>
                <Label>{esMora ? 'Detalles adicionales (opcional)' : 'Hechos — cuéntame qué pasó'}</Label>
                <Textarea value={hechos} onChange={(e) => setHechos(e.target.value)} rows={esMora ? 2 : 5}
                  placeholder={esMora ? 'Algo más que deba saber (ej: número de OC, contacto del organismo)' : 'Ej: Postulé a la licitación X, me declararon inadmisible el 12 de marzo por...'} />
              </div>
              <div>
                <Label>Qué quieres pedir (opcional)</Label>
                <Textarea value={peticion} onChange={(e) => setPeticion(e.target.value)} rows={2} placeholder="Ej: que reconsideren y admitan mi oferta" />
              </div>
              <Button onClick={generarDocumento} disabled={generando || !puedeGenerar}>
                {generando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Generar documento
              </Button>
            </CardContent>
          </Card>

          {esMora && calculoMora && (
            <Card>
              <CardHeader><CardTitle className="text-base">Cálculo del interés</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>Capital adeudado: <strong>{fmtCLP(calculoMora.monto_adeudado)}</strong></p>
                <p>Días de atraso: <strong>{calculoMora.dias_atraso}</strong></p>
                <p>Tasa de interés corriente anual aplicada: <strong>{calculoMora.tasa_anual}%</strong> (CMF, vigente en {calculoMora.mes_tasa})</p>
                <p>Interés: <strong>{fmtCLP(calculoMora.interes)}</strong></p>
                <p className="text-base">Total a cobrar: <strong>{fmtCLP(calculoMora.total)}</strong></p>
                <p className="text-xs text-muted-foreground pt-1">Verifica que la tasa siga vigente antes de presentar el cobro.</p>
              </CardContent>
            </Card>
          )}
          {esMora && documento && !calculoMora && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              Aún no tengo cargada la tasa de interés corriente de la CMF para calcular el monto exacto — el documento pide el pago del capital y deja el interés pendiente de completar.
            </div>
          )}

          {documento && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Documento generado</CardTitle>
                <Button size="sm" variant="outline" onClick={descargarPDF}><Download className="h-4 w-4 mr-1" />Descargar PDF</Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans">{documento}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Documentos de respaldo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sube contratos, notificaciones o reclamos previos: Don Evaristo Abogado los lee para responderte y redactar con los hechos exactos.
              </p>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer text-primary">
                <Upload className="h-4 w-4" /> {subiendo ? 'Subiendo…' : 'Subir documento (PDF, Word, Excel, imagen)'}
                <input type="file" className="hidden" multiple disabled={subiendo}
                  onChange={(e) => e.target.files && subirDocumento(e.target.files)} />
              </label>
              <div className="space-y-2">
                {documentos.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" />{d.nombre}</span>
                    <Button size="icon" variant="ghost" onClick={() => borrarDocumento(d.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {documentos.length === 0 && <p className="text-sm text-muted-foreground">Aún no subes documentos.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
