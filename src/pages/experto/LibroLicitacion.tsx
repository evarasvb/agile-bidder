import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookOpen, FileText, Upload, Loader2, Send, Sparkles, ClipboardList, ThumbsUp, ThumbsDown, ArrowLeft, Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { expertoMd } from '@/lib/expertoMd';

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
const fmt = (n: unknown) => n == null ? 's/i' : '$' + Math.round(Number(n)).toLocaleString('es-CL');
const fecha = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 's/i';

interface Msg { rol: 'yo' | 'exp'; texto: string; fuentes?: any[]; pedirBases?: string | null }
type Entregable = 'informe' | 'estudio' | 'anexos';

/**
 * Libro de trabajo de una licitación: Fuentes (ficha, bases, organismo, quién gana) · Chat con el
 * Experto · Entregables (informe, estudio profundo, anexos). Todo queda guardado por licitación.
 */
export default function LibroLicitacion() {
  const { codigo = '' } = useParams();
  const cod = codigo.toUpperCase();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const auth = { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (token || ANON) };

  const { data: libro, isLoading } = useQuery({
    queryKey: ['experto_libro', cod],
    enabled: !!cod && !!token,
    queryFn: async () => (await (supabase as any).rpc('experto_libro', { p_codigo: cod })).data,
  });

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pregunta, setPregunta] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [tab, setTab] = useState<Entregable>('informe');
  const [entregables, setEntregables] = useState<Record<Entregable, string>>({ informe: '', estudio: '', anexos: '' });
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!libro) return;
    setMsgs((libro.chat ?? []).flatMap((c: any) => [{ rol: 'yo', texto: c.pregunta }, { rol: 'exp', texto: c.respuesta }]));
    setEntregables({ informe: libro.informe?.texto ?? '', estudio: libro.estudio?.texto ?? '', anexos: libro.anexos?.texto ?? '' });
    setFaltantes(libro.anexos?.faltantes ?? []);
    if (libro.estudio?.texto && !libro.informe?.texto) setTab('estudio');
  }, [libro]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [msgs]);

  // Streaming SSE del Experto (chat, informe y estudio comparten el formato).
  async function pedir(body: Record<string, unknown>, fn: 'experto-consultar' | 'experto-estudio', onTexto: (t: string, meta?: any) => void) {
    const r = await fetch(`${SUPA}/functions/v1/${fn}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.mensaje || j.error || `Error ${r.status}`); }
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
    const p = pregunta.trim(); if (!p || ocupado) return;
    setPregunta('');
    const historial = msgs.slice(-6).map((m) => ({ role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto }));
    setMsgs((m) => [...m, { rol: 'yo', texto: p }, { rol: 'exp', texto: '' }]);
    setOcupado('chat');
    try {
      await pedir({ modo: 'chat', pregunta: p, codigo: cod, historial, huella: 'libro' }, 'experto-consultar', (t, meta) =>
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { rol: 'exp', texto: t, fuentes: meta?.fuentes, pedirBases: meta?.pedir_bases }; return c; }));
    } catch (e: any) { setMsgs((m) => { const c = [...m]; c[c.length - 1] = { rol: 'exp', texto: 'No pude responder: ' + e.message }; return c; }); }
    setOcupado(null);
  };

  const generar = async (tipo: Entregable) => {
    if (ocupado) return;
    setTab(tipo); setOcupado(tipo);
    try {
      if (tipo === 'anexos') {
        const r = await fetch(`${SUPA}/functions/v1/experto-anexos`, { method: 'POST', headers: auth, body: JSON.stringify({ codigo: cod }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
        setEntregables((e) => ({ ...e, anexos: j.contenido })); setFaltantes(j.faltantes ?? []);
      } else {
        await pedir({ modo: tipo, codigo: cod, pregunta: '', huella: 'libro' }, tipo === 'estudio' ? 'experto-estudio' : 'experto-consultar', (t) => setEntregables((e) => ({ ...e, [tipo]: t })));
      }
    } catch (e: any) { toast.error(e.message); }
    setOcupado(null);
  };

  const subirBases = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error('El PDF supera los 20 MB'); return; }
    setOcupado('bases');
    try {
      const b64 = await new Promise<string>((ok, ko) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1] || ''); fr.onerror = () => ko(new Error('No pude leer el archivo')); fr.readAsDataURL(file); });
      const r = await fetch(`${SUPA}/functions/v1/experto-bases`, { method: 'POST', headers: auth, body: JSON.stringify({ codigo: cod, nombre: file.name, pdf_base64: b64 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
      toast.success(`Bases leídas: ${j.paginas} páginas`);
      qc.invalidateQueries({ queryKey: ['experto_libro', cod] });
    } catch (e: any) { toast.error(e.message); }
    setOcupado(null);
  };

  const opinar = async (p: string, util: boolean) => {
    const comentario = util ? null : window.prompt('¿Qué faltó? (queda guardado y el Experto lo tendrá en cuenta)') ?? '';
    await (supabase as any).rpc('experto_feedback', { p_huella: 'libro', p_pregunta: p, p_util: util, p_comentario: comentario });
    toast.success(util ? 'Gracias' : 'Anotado');
  };

  const compartirTexto = async (tipo: string, titulo: string, contenido: string) => {
    const { data, error } = await (supabase as any).rpc('experto_compartir', { p_codigo: cod, p_tipo: tipo, p_titulo: titulo, p_contenido: contenido });
    if (error || !data) { toast.error('No pude crear el link'); return; }
    const url = `${window.location.origin}/experto/c/${data}`;
    if (navigator.share) { try { await navigator.share({ title: titulo, url }); return; } catch { /* cancelado */ } }
    await navigator.clipboard.writeText(url); toast.success('Link copiado: la página lleva tu nombre y la marca FirmaVB');
    window.open(url, '_blank');
  };
  const compartirEntregable = async () => {
    const titulo = `${tab === 'informe' ? 'Informe de trabajo' : tab === 'estudio' ? 'Estudio profundo' : 'Anexos'} · ${cod}${f?.nombre ? ' · ' + f.nombre : ''}`;
    await compartirTexto(tab, titulo, entregables[tab]);
  };
  const f = libro?.ficha; const o = f?.organismo ?? {};
  const bases: any[] = libro?.bases ?? [];
  const top: any[] = libro?.top_adjudicatarios ?? [];
  const esPro = libro?.plan && libro.plan !== 'free';

  if (!cod) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate('/experto')}><ArrowLeft className="h-4 w-4 mr-1" />Libros</Button>
        {f && <Button variant="outline" size="sm" onClick={() => navigate(String(f.tipo ?? '').toLowerCase().includes('gil') ? `/compras-agiles/${cod}` : `/oportunidades/licitacion/${cod}`)}>Ver la oportunidad</Button>}
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">{cod}</h1>
        {f && <span className="text-muted-foreground truncate max-w-[50vw]">{f.nombre} · {f.institucion}</span>}
        {f && <Badge variant="outline">cierra {fecha(f.fecha_cierre)}</Badge>}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      {!isLoading && libro && !f && (
        <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">No encontré {cod} en la base de Mercado Público. Revisa el ID o sube las bases para trabajar igual.</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[300px_1fr_360px]">
        {/* Fuentes */}
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Fuentes</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium flex items-center gap-1"><FileText className="h-4 w-4" />Ficha Mercado Público</p>
                {f ? <p className="text-muted-foreground">{f.tipo ?? ''} · {fmt(f.presupuesto)} · {f.estado}</p> : <p className="text-muted-foreground">sin ficha</p>}
                {f?.url && <a className="text-primary underline text-xs" href={f.url} target="_blank" rel="noreferrer">ver en Mercado Público</a>}
              </div>
              <div>
                <p className="font-medium flex items-center gap-1"><Upload className="h-4 w-4" />Bases y anexos (PDF)</p>
                {bases.length ? bases.map((b) => <p key={b.id} className="text-muted-foreground truncate">{b.archivo} · {b.paginas} pág.</p>) : <p className="text-muted-foreground">Nadie las ha subido aún.</p>}
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) subirBases(x); e.target.value = ''; }} />
                <Button size="sm" variant="outline" className="mt-1" disabled={ocupado === 'bases'} onClick={() => fileRef.current?.click()}>
                  {ocupado === 'bases' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}Subir PDF (máx. 20 MB)
                </Button>
              </div>
              <div>
                <p className="font-medium">¿Cómo paga {o.institucion ? 'este organismo' : 'el organismo'}?</p>
                {o.institucion ? (
                  <p className="text-muted-foreground">{o.conducta_pago ?? 's/i'} · {o.pago_promedio_dias ?? 's/i'} días · reclamos de pago 12m: {o.reclamos_pago_12m ?? o.reclamos ?? 's/i'} ({o.reclamos_pago_por_100_procesos ?? 's/i'} por 100 procesos)</p>
                ) : <p className="text-muted-foreground">sin dato</p>}
              </div>
              <div>
                <p className="font-medium">Quién le gana a este organismo (12 m)</p>
                {top.length ? top.slice(0, 5).map((t: any) => <p key={t.adjudicatario} className="text-muted-foreground truncate">{t.adjudicatario}: {t.licitaciones} · {fmt(t.monto)}</p>) : <p className="text-muted-foreground">sin adjudicaciones registradas aún</p>}
              </div>
              {(f?.competencia ?? []).length > 0 && (
                <div>
                  <p className="font-medium">Quién vende esto al Estado</p>
                  {f.competencia.slice(0, 5).map((c: any) => <p key={c.proveedor} className="text-muted-foreground truncate">{c.proveedor}: {c.ordenes} OC · unit. {fmt(c.precio_unit_mediano)}</p>)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat */}
        <Card className="flex flex-col min-h-[70vh]">
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Conversación con el Experto</CardTitle></CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[60vh]">
              {msgs.length === 0 && (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Pregúntame sobre esta licitación con las fuentes de la izquierda. Ejemplos:</p>
                  {['¿Vale la pena postular? ¿Qué me juega en contra?', '¿Cuáles son los criterios de evaluación y cómo gano puntos?', '¿Qué garantías y multas tiene y qué riesgo veo?', '¿A qué precio debería ofertar según lo que se ha pagado?'].map((e) => (
                    <button key={e} className="block text-left rounded-full border px-3 py-1 hover:border-primary" onClick={() => setPregunta(e)}>{e}</button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => m.rol === 'yo' ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-firmavb-blue text-white px-4 py-2 text-sm">{m.texto}</div>
              ) : (
                <div key={i} className="max-w-[95%] rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                  {m.texto ? <div dangerouslySetInnerHTML={{ __html: expertoMd(m.texto) }} /> : <span className="text-muted-foreground">Buscando en las fuentes…</span>}
                  {m.pedirBases && <p className="mt-2 text-xs text-muted-foreground">Sube las bases en el panel de Fuentes y vuelve a preguntar.</p>}
                  {m.texto && m.fuentes && m.fuentes.length > 0 && (
                    <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Fuentes ({m.fuentes.length})</summary>
                      {m.fuentes.map((s: any) => <div key={s.n}>[{s.n}] {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.fuente}</a> : s.fuente}</div>)}
                    </details>
                  )}
                  {m.texto && !ocupado && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {i === msgs.length - 1 && <>¿Te sirvió?
                        <button onClick={() => opinar(msgs[i - 1]?.texto ?? '', true)}><ThumbsUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => opinar(msgs[i - 1]?.texto ?? '', false)}><ThumbsDown className="h-3.5 w-3.5" /></button></>}
                      <button className="ml-auto flex items-center gap-1 underline" onClick={() => compartirTexto('chat', (msgs[i - 1]?.texto ?? `Respuesta del Experto · ${cod}`).slice(0, 120), `**Pregunta:** ${msgs[i - 1]?.texto ?? ''}\n\n${m.texto}`)}><Share2 className="h-3.5 w-3.5" />Compartir</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); preguntar(); }}>
              <Input value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder={`Pregunta sobre ${cod}…`} disabled={!!ocupado} />
              <Button type="submit" disabled={!!ocupado || !pregunta.trim()}>{ocupado === 'chat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
            </form>
          </CardContent>
        </Card>

        {/* Entregables */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Entregables</CardTitle>
            <div className="flex flex-wrap gap-1 pt-1">
              {([['informe', 'Informe de trabajo', ''], ['estudio', 'Estudio profundo', 'Experto Pro'], ['anexos', 'Anexos completados', 'Experto Plus']] as [Entregable, string, string][]).map(([k, n, tag]) => (
                <Button key={k} size="sm" variant={tab === k ? 'default' : 'outline'} onClick={() => entregables[k] ? setTab(k) : generar(k)} disabled={!!ocupado && ocupado !== k}>
                  {ocupado === k ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : entregables[k] ? <ClipboardList className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {n}{tag && <span className="ml-1 text-[10px] opacity-70">{tag}</span>}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="text-sm flex-1">
            {entregables[tab] ? (
              <div>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(entregables[tab]); toast.success('Copiado'); }}><Copy className="h-3.5 w-3.5 mr-1" />Copiar</Button>
                  <Button size="sm" variant="ghost" onClick={() => generar(tab)} disabled={!!ocupado}>Volver a generar</Button>
                  <Button size="sm" variant="ghost" onClick={compartirEntregable}><Share2 className="h-3.5 w-3.5 mr-1" />Compartir / PDF</Button>
                </div>
                {tab === 'anexos' && faltantes.length > 0 && <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2">Completa a mano: {faltantes.join(', ')}</p>}
                <div className="max-h-[62vh] overflow-y-auto pr-1" dangerouslySetInnerHTML={{ __html: expertoMd(entregables[tab]) }} />
              </div>
            ) : (
              <div className="text-muted-foreground space-y-2">
                <p>{tab === 'informe' && 'Informe de trabajo: veredicto, fechas, checklist de admisibilidad, cómo se ganan los puntos, riesgos, competencia y próximos pasos.'}
                   {tab === 'estudio' && 'Estudio profundo (Pro): historial de compras parecidas del organismo, quién ganó y con cuánto, precio objetivo.'}
                   {tab === 'anexos' && 'Anexos completados (Plus): los formularios de las bases con los datos de tu empresa, listos para revisar y firmar.'}</p>
                {!esPro && tab !== 'informe' && <p className="text-xs">Requiere Experto {tab === 'anexos' ? 'Plus' : 'Pro'} o FirmaVB ERP.</p>}
                <Button size="sm" onClick={() => generar(tab)} disabled={!!ocupado}><Sparkles className="h-4 w-4 mr-1" />Generar</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
