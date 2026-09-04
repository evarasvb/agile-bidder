import { useEffect, useRef, useState } from 'react';

// Escritorio: tres paneles ajustables (arrastra el separador). Celular/tablet: pestañas Fuentes · Chat · Entregables.
function useEscritorio() {
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => { const mq = window.matchMedia('(min-width: 1024px)'); const f = () => setV(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  return v;
}
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { BookOpen, FileText, Upload, Loader2, Send, Sparkles, ClipboardList, ThumbsUp, ThumbsDown, ArrowLeft, Copy, Share2, MessageCircle, ExternalLink, Trash2, Paperclip, Printer, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { expertoMd } from '@/lib/expertoMd';
import { Infografia, type InfografiaDatos } from '@/components/experto/Infografia';
import { MapaConceptual, type Nodo } from '@/components/experto/MapaConceptual';
import { compartirPdfExperto } from '@/services/expertoPdf';
import { MatrizPostulacion, type Matriz } from '@/components/experto/MatrizPostulacion';
import { descargarWord } from '@/services/exportar';
import { SalaPostulacion } from '@/components/experto/SalaPostulacion';
import { pagoOrganismo, presupuestoTexto, nombrePropio } from '@/lib/organismoPago';
import { AccionesCompartir } from '@/components/oportunidades/AccionesCompartir';
import { mailtoOportunidad } from '@/lib/compartir';

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
const fmt = (n: unknown) => n == null ? 's/i' : '$' + Math.round(Number(n)).toLocaleString('es-CL');
const RE_ID = /\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2}/;
const idEn = (t: string) => t.toUpperCase().match(RE_ID)?.[0];
// Citas [n] como en NotebookLM: clic abre la fuente (o despliega la lista si no tiene link); al pasar el mouse muestra cuál es.
const conCitas = (html: string, fuentes?: any[]) => html.replace(/\[(\d{1,2})\]/g, (_m, n) => {
  const f = fuentes?.find((x) => String(x.n) === n);
  const titulo = String(f?.fuente ?? `Fuente ${n}`).replace(/"/g, '&quot;');
  return `<sup><a class="cita text-primary font-semibold no-underline hover:underline" data-n="${n}" href="${f?.url ?? '#'}" title="${titulo}"${f?.url ? ' target="_blank" rel="noreferrer"' : ''}>[${n}]</a></sup>`;
});
// Veredicto del informe (sección 1: ¿vale la pena postular? sí / con reservas / no) como semáforo en el encabezado.
function veredictoDe(informe?: string): { t: string; c: string } | null {
  if (!informe) return null;
  const z = informe.slice(0, 2500).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const v = z.match(/veredicto[^\n]{0,200}/)?.[0] ?? z.match(/vale la pena postular[^\n]{0,200}/)?.[0] ?? '';
  if (!v) return null;
  if (/con reservas|con condiciones|si corriges|depende/.test(v)) return { t: 'Postular con reservas', c: 'bg-yellow-100 text-yellow-900 border-yellow-300' };
  if (/\bno\b(?! hay atajos)/.test(v) && !/\bsi\b/.test(v.slice(0, v.indexOf('no')))) return { t: 'Descartar', c: 'bg-red-100 text-red-900 border-red-300' };
  if (/\bsi\b|vale la pena/.test(v)) return { t: 'Postular', c: 'bg-green-100 text-green-900 border-green-300' };
  return { t: 'Evaluar', c: 'bg-muted text-foreground' };
}
const fecha = (d?: string | null) => d ? new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : 's/i';

interface Msg { rol: 'yo' | 'exp'; texto: string; fuentes?: any[]; pedirBases?: string | null }
type Entregable = 'sala' | 'informe' | 'matriz' | 'estudio' | 'anexos' | 'mapa' | 'infografia';

/**
 * Libro de trabajo de una licitación: Fuentes (ficha, bases, organismo, quién gana) · Chat con el
 * Experto · Entregables (informe, estudio profundo, anexos). Todo queda guardado por licitación.
 * Sin código (/experto) es el chat general del Experto más la lista de libros del usuario.
 */
export default function LibroLicitacion() {
  const { codigo = '' } = useParams();
  const cod = codigo.toUpperCase();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const qc = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token ?? '';
  const auth = { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (token || ANON) };

  const { data: libro, isLoading } = useQuery({
    queryKey: ['experto_libro', cod],
    enabled: !!cod && !!token,
    queryFn: async () => (await (supabase as any).rpc('experto_libro', { p_codigo: cod })).data,
  });

  const [buscarLibro, setBuscarLibro] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const { data: libros = [] } = useQuery({ queryKey: ['experto_mis_libros', verArchivados, buscarLibro], enabled: !!token, queryFn: async () => ((await (supabase as any).rpc('experto_mis_libros', { p_archivados: verArchivados, p_buscar: buscarLibro || null })).data ?? []) as any[] });
  const archivarLibro = async (c: string, archivado: boolean) => {
    const { error } = await (supabase as any).rpc('experto_libro_archivar', { p_codigo: c, p_archivado: archivado });
    if (error) { toast.error('No pude archivar'); return; }
    toast.success(archivado ? 'Libro archivado (sigue guardado, lo ves en Archivados)' : 'Libro reactivado');
    qc.invalidateQueries({ queryKey: ['experto_mis_libros'] });
  };

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [codigoAbrir, setCodigoAbrir] = useState('');
  const escritorio = useEscritorio();
  const [vista, setVista] = useState<'fuentes' | 'chat' | 'entregables'>('chat');
  const [limite, setLimite] = useState<string | null>(null);
  const [compartido, setCompartido] = useState<{ url: string; titulo: string; token: string; tipo: string } | null>(null);
  const autoRef = useRef(false);
  const [pregunta, setPregunta] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [tab, setTab] = useState<Entregable>('sala');
  const [entregables, setEntregables] = useState<Record<Entregable, string>>({ sala: 'ok', informe: '', matriz: '', estudio: '', anexos: '', mapa: '', infografia: '' });
  const [faltantes, setFaltantes] = useState<string[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const guardarRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMsgs([]); setLimite(null); setCompartido(null); }, [cod]);
  useEffect(() => {
    if (!libro) return;
    setMsgs((libro.chat ?? []).flatMap((c: any) => [{ rol: 'yo', texto: c.pregunta }, { rol: 'exp', texto: c.respuesta }]));
    setEntregables({ sala: 'ok', informe: libro.informe?.texto ?? '', matriz: libro.matriz?.texto ?? '', estudio: libro.estudio?.texto ?? '', anexos: libro.anexos?.texto ?? '', mapa: libro.mapa?.texto ?? '', infografia: libro.ficha ? 'ok' : '' });
    setFaltantes(libro.anexos?.faltantes ?? []);
  }, [libro]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [msgs]);

  // Streaming SSE del Experto (chat, informe y estudio comparten el formato).
  async function pedir(body: Record<string, unknown>, fn: 'experto-consultar' | 'experto-estudio', onTexto: (t: string, meta?: any) => void) {
    const r = await fetch(`${SUPA}/functions/v1/${fn}`, { method: 'POST', headers: auth, body: JSON.stringify(body) });
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

  const preguntar = async (texto?: string) => {
    const p = (texto ?? pregunta).trim(); if (!p || ocupado) return;
    setPregunta('');
    // Sin libro abierto, un ID de licitación solo abre su libro.
    if (!cod && RE_ID.test(p.toUpperCase()) && p.length < 20) { navigate(`/experto/libro/${idEn(p)}`); return; }
    const historial = msgs.slice(-6).map((m) => ({ role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto }));
    setMsgs((m) => [...m, { rol: 'yo', texto: p }, { rol: 'exp', texto: '' }]);
    setOcupado('chat');
    try {
      await pedir({ modo: 'chat', pregunta: p, codigo: cod || undefined, historial, huella: 'libro' }, 'experto-consultar', (t, meta) =>
        setMsgs((m) => { const c = [...m]; c[c.length - 1] = { rol: 'exp', texto: t, fuentes: meta?.fuentes, pedirBases: meta?.pedir_bases }; return c; }));
    } catch (e: any) {
      if (e.status === 402 || e.status === 401) setLimite(e.message);
      setMsgs((m) => { const c = [...m]; c[c.length - 1] = { rol: 'exp', texto: (e.status === 402 ? '' : 'No pude responder: ') + e.message }; return c; });
    }
    setOcupado(null);
  };
  // Pregunta que llega por la URL (landing, tarjeta de riesgo del organismo): se envía sola una vez.
  useEffect(() => {
    const q = sp.get('q') ?? sp.get('pregunta');
    if (q && token && !autoRef.current) { autoRef.current = true; preguntar(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const generar = async (tipo: Entregable) => {
    if (ocupado) return;
    setTab(tipo); setOcupado(tipo);
    try {
      if (tipo === 'mapa') {
        const r = await fetch(`${SUPA}/functions/v1/experto-mapa`, { method: 'POST', headers: auth, body: JSON.stringify({ codigo: cod }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
        setEntregables((e) => ({ ...e, mapa: JSON.stringify(j.mapa) }));
      } else if (tipo === 'matriz') {
        const r = await fetch(`${SUPA}/functions/v1/experto-matriz`, { method: 'POST', headers: auth, body: JSON.stringify({ codigo: cod }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(j.mensaje || j.error || `Error ${r.status}`), { status: r.status });
        setEntregables((e) => ({ ...e, matriz: JSON.stringify(j.matriz) }));
        if (j.documentos) toast.success(`Matriz hecha con tus ${j.documentos} documento(s) de trabajo`);
      } else if (tipo === 'infografia') {
        setEntregables((e) => ({ ...e, infografia: 'ok' }));
      } else if (tipo === 'anexos') {
        const r = await fetch(`${SUPA}/functions/v1/experto-anexos`, { method: 'POST', headers: auth, body: JSON.stringify({ codigo: cod }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
        setEntregables((e) => ({ ...e, anexos: j.contenido })); setFaltantes(j.faltantes ?? []);
      } else {
        await pedir({ modo: tipo, codigo: cod, pregunta: '', huella: 'libro' }, tipo === 'estudio' ? 'experto-estudio' : 'experto-consultar', (t) => setEntregables((e) => ({ ...e, [tipo]: t })));
      }
    } catch (e: any) { toast.error(e.message, e.status === 402 ? { action: { label: 'Ver planes', onClick: () => navigate('/cuenta') } } : undefined); }
    setOcupado(null);
  };

  // Fuentes subidas (una sola entrada): PDF de bases (se reconocen solos y quedan para todos), Excel, Word,
  // imágenes o texto (privados, cuentan para el cupo del plan). Varios archivos a la vez, uno tras otro.
  const subirFuentes = async (files: FileList | File[]) => {
    const lista = Array.from(files); if (!lista.length) return;
    setOcupado('fuentes');
    let bases = 0, docs = 0;
    for (const file of lista) {
      try {
        const r = await fetch(`${SUPA}/functions/v1/experto-documentos`, { method: 'POST', headers: { ...auth, 'Content-Type': file.type || 'application/octet-stream', 'X-Codigo': cod, 'X-Nombre': encodeURIComponent(file.name), 'X-Destino': 'auto' }, body: file });
        const j = await r.json().catch(() => ({}));
        if (r.status === 402 || r.status === 413) { toast.error(j.mensaje || 'Límite del plan', { action: { label: 'Ver planes', onClick: () => navigate('/cuenta') }, duration: 9000 }); break; }
        if (!r.ok) { toast.error(`${file.name}: ${j.mensaje || j.error || 'Error ' + r.status}`); continue; }
        if (j.destino === 'bases') { bases++; toast.success(`Bases leídas: ${file.name} (${j.paginas} páginas). Quedan disponibles para todos.`); }
        else { docs++; toast.success(`Leído: ${file.name}${j.maximo ? ` · ${j.usados}/${j.maximo} de tu cupo` : ''}`); }
      } catch (e: any) { toast.error(`${file.name}: ${e.message}`); }
    }
    if (bases || docs) qc.invalidateQueries({ queryKey: ['experto_libro', cod] });
    setOcupado(null);
  };
  // Anexos Word oficiales completados por el Experto (conservan el formato; amarillo = validar).
  const { data: anexosWord = [] } = useQuery({
    queryKey: ['experto_anexos_word', cod],
    enabled: !!cod && !!token,
    queryFn: async () => { const r = await fetch(`${SUPA}/functions/v1/experto-anexo-word?codigo=${cod}`, { headers: auth }); const j = await r.json().catch(() => ({})); return (j.anexos ?? []) as any[]; },
  });
  // Devuelve false si hay que detener la tanda (plan o datos de empresa).
  const completarUno = async (d: any): Promise<boolean> => {
    const r = await fetch(`${SUPA}/functions/v1/experto-anexo-word`, { method: 'POST', headers: auth, body: JSON.stringify({ codigo: cod, documento_id: d.id }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 402) { toast.error(j.mensaje || 'Requiere Experto Plus', { action: { label: 'Ver planes', onClick: () => navigate('/cuenta') }, duration: 9000 }); return false; }
    if (r.status === 428) { toast.error(j.mensaje, { action: { label: 'Mi empresa', onClick: () => navigate('/configuracion/empresa') }, duration: 9000 }); return false; }
    if (!r.ok) { toast.error(`${d.nombre}: ${j.mensaje || j.error || 'no pude completarlo'}`); return true; }
    if (j.aplica === false) { toast.info(`${d.nombre}: no aplica (${j.motivo})`, { duration: 8000 }); return true; }
    toast.success(`${j.nombre}: ${j.cambios} campos completados, ${j.campos_validar} en amarillo para validar. ${j.resumen ?? ''}`, { duration: 9000 });
    qc.invalidateQueries({ queryKey: ['experto_anexos_word', cod] });
    return true;
  };
  const completarWord = async (d: any) => {
    setOcupado('word:' + d.id);
    try { await completarUno(d); } catch (e: any) { toast.error(e.message); } finally { setOcupado(null); }
  };
  // Todos los Word de la licitación, uno tras otro. Si hay varias copias del mismo anexo
  // ("Anexo_N_3 (6)", "(7)", "(8)") se usa la última subida.
  const wordsUnicos = () => {
    const base = (n: string) => n.replace(/\s*\(\d+\)/g, '').replace(/\.docx$/i, '').trim().toLowerCase();
    const m = new Map<string, any>();
    for (const d of documentos.filter((x: any) => x.tipo === 'docx')) { const k = base(d.nombre); if (!m.has(k) || new Date(d.creado_en) > new Date(m.get(k).creado_en)) m.set(k, d); }
    return Array.from(m.values());
  };
  const completarTodos = async () => {
    const lista = wordsUnicos(); if (!lista.length) return;
    setOcupado('word:todos');
    try { for (const d of lista) { if (!(await completarUno(d))) break; } } catch (e: any) { toast.error(e.message); } finally { setOcupado(null); }
  };
  const borrarAnexoWord = async (id: string) => {
    await fetch(`${SUPA}/functions/v1/experto-anexo-word?id=${id}`, { method: 'DELETE', headers: auth });
    qc.invalidateQueries({ queryKey: ['experto_anexos_word', cod] });
  };
  const borrarDocumento = async (id: string) => {
    await fetch(`${SUPA}/functions/v1/experto-documentos?id=${id}`, { method: 'DELETE', headers: auth });
    qc.invalidateQueries({ queryKey: ['experto_libro', cod] });
  };
  const matrizCambio = (m: Matriz) => {
    setEntregables((e) => ({ ...e, matriz: JSON.stringify(m) }));
    if (guardarRef.current) clearTimeout(guardarRef.current);
    guardarRef.current = setTimeout(async () => { const { error } = await (supabase as any).rpc('experto_matriz_guardar', { p_codigo: cod, p_matriz: m }); if (error) toast.error('No pude guardar la matriz'); }, 1200);
  };
  const aprobarPostulacion = () => {
    if (!entregables.matriz) { toast.error('Genera primero la matriz de postulación'); return; }
    const m = JSON.parse(entregables.matriz); m.aprobacion = { por: session?.user?.email ?? 'usuario', en: new Date().toISOString() };
    matrizCambio(m); toast.success('Postulación marcada como revisada y aprobada');
  };
  // Word / PDF de cualquier texto del Experto (informe, estudio, anexos, respuesta del chat)
  const aWord = (titulo: string, md: string) => descargarWord(titulo, expertoMd(md), `${cod || 'experto'}-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.doc`);
  const datosPdf = () => ({ subtitulo: f ? `Licitación ${cod} · ${f.nombre ?? ''} · ${nombrePropio(f.institucion)}` : `Licitación ${cod}`, kpis: f ? [{ k: 'Presupuesto', v: presupuestoTexto(f.presupuesto, cod) }, { k: 'Cierre', v: fecha(f.fecha_cierre) }, { k: 'Pago del organismo', v: pagoOrganismo(o).valor, tono: pagoOrganismo(o).tono }] : [], veredicto: (() => { const v = veredictoDe(entregables.informe); return v ? { t: v.t, tono: (/reservas/.test(v.t) ? 'warn' : v.t === 'Descartar' ? 'bad' : v.t === 'Postular' ? 'ok' : 'neutral') as 'ok' | 'warn' | 'bad' | 'neutral' } : null; })() });
  const aPdf = async (titulo: string, md: string) => { const r = await compartirPdfExperto({ titulo, ...datosPdf(), contenido: md, url: `${window.location.origin}/experto/libro/${cod}` }, `${cod || 'experto'}-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.pdf`); if (r === 'descargado') toast.success('PDF descargado'); };

  const opinar = async (p: string, util: boolean) => {
    const comentario = util ? null : window.prompt('¿Qué faltó? (queda guardado y el Experto lo tendrá en cuenta)') ?? '';
    await (supabase as any).rpc('experto_feedback', { p_huella: 'libro', p_pregunta: p, p_util: util, p_comentario: comentario });
    toast.success(util ? 'Gracias' : 'Anotado');
  };

  const compartirTexto = async (tipo: string, titulo: string, contenido: string) => {
    const { data, error } = await (supabase as any).rpc('experto_compartir', { p_codigo: cod || null, p_tipo: tipo, p_titulo: titulo, p_contenido: contenido });
    if (error || !data) { toast.error('No pude crear el link'); return; }
    const url = `${window.location.origin}/experto/c/${data}`;
    try { await navigator.clipboard.writeText(url); } catch { /* sin permiso */ }
    setCompartido({ url, titulo, token: data, tipo });
    toast.success('Link listo y copiado: la página lleva tu nombre y la marca FirmaVB');
  };
  const waUrl = (c: { url: string; titulo: string }) => `https://wa.me/?text=${encodeURIComponent(`${c.titulo}\n${c.url}`)}`;
  // PDF con marca para adjuntar en WhatsApp (celular: se comparte directo; escritorio: se descarga).
  const pdfCompartido = async () => {
    if (!compartido) return;
    setOcupado('pdf');
    try {
      const fila = (await (supabase as any).rpc('experto_compartido', { p_token: compartido.token })).data?.[0];
      if (!fila) throw new Error('No encontré el análisis');
      const r = await compartirPdfExperto({ titulo: fila.titulo ?? compartido.titulo, ...datosPdf(), empresa: fila.empresa, contenido: fila.contenido, url: compartido.url, fecha: fila.creado_en }, `${cod || 'experto'}-${compartido.tipo}.pdf`);
      if (r === 'descargado') toast.success('PDF descargado: adjúntalo en WhatsApp o correo');
    } catch (e: any) { toast.error(e.message); }
    setOcupado(null);
  };
  const datosInfografia = (): InfografiaDatos => ({
    codigo: cod, nombre: f?.nombre, institucion: f?.institucion, tipo: f?.tipo, presupuesto: f?.presupuesto, cierre: f?.fecha_cierre, publicada: f?.fecha_publicacion, region: f?.region,
    pago: o.institucion ? { conducta: o.conducta_pago, dias: o.pago_promedio_dias, reclamos_100: o.reclamos_pago_por_100_procesos, reclamos: o.reclamos_pago_12m ?? o.reclamos } : null,
    ganadores: top.slice(0, 4).map((t: any) => ({ nombre: t.adjudicatario, n: t.licitaciones, monto: t.monto })),
    competencia: (f?.competencia ?? []).slice(0, 4).map((c: any) => ({ proveedor: c.proveedor, ordenes: c.ordenes, precio: c.precio_unit_mediano })),
    items: (f?.items ?? []).slice(0, 6).map((i: any) => i.producto),
  });
  const nombresEntregable: Record<Entregable, string> = { sala: 'Sala de postulación', informe: 'Informe de trabajo', matriz: 'Matriz de postulación', estudio: 'Estudio profundo', anexos: 'Anexos', mapa: 'Mapa conceptual', infografia: 'Infografía' };
  const compartirEntregable = async () => {
    const nombres = nombresEntregable;
    const titulo = `${nombres[tab]} · ${cod}${f?.nombre ? ' · ' + f.nombre : ''}`;
    await compartirTexto(tab, titulo, tab === 'infografia' ? JSON.stringify(datosInfografia()) : entregables[tab]);
  };
  const f = libro?.ficha; const o = f?.organismo ?? {};
  const bases: any[] = libro?.bases ?? [];
  const documentos: any[] = libro?.documentos ?? [];
  const top: any[] = libro?.top_adjudicatarios ?? [];
  const esPro = libro?.plan && libro.plan !== 'free';

  // Oportunidad en el formato que usan los botones de calendario y email; el email
  // lleva además el veredicto del informe y, si existe, el link público del análisis.
  const oportunidadLibro = f ? { codigo: cod, nombre: f.nombre, tipo: f.tipo, organismo: f.institucion, monto: typeof f.presupuesto === 'number' ? f.presupuesto : null, fecha_cierre: f.fecha_cierre, fecha_publicacion: f.fecha_publicacion, link: f.url } : null;
  const extraEmailLibro = (() => {
    const v = veredictoDe(entregables.informe);
    const partes = [v ? `Veredicto del Experto FirmaVB: ${v.t}` : null, compartido ? `${compartido.titulo}\n${compartido.url}` : null];
    return partes.filter(Boolean).join('\n\n') || undefined;
  })();

  const abrirLibro = (c: string) => { const id = idEn(c); if (id) navigate(`/experto/libro/${id}`); else toast.error('Escribe un ID de licitación, ej. 2699-35-LE26'); };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {cod ? <Button variant="ghost" size="sm" onClick={() => navigate('/experto')}><ArrowLeft className="h-4 w-4 mr-1" />Experto</Button> : <><BookOpen className="h-5 w-5 text-primary" /><h1 className="text-xl font-bold">Experto FirmaVB</h1></>}
        {!cod && (
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); abrirLibro(codigoAbrir); }}>
            <Input value={codigoAbrir} onChange={(e) => setCodigoAbrir(e.target.value)} placeholder="Abrir libro por ID, ej. 2699-35-LE26" className="h-8 w-64" />
            <Button size="sm" type="submit" className="h-8">Abrir</Button>
          </form>
        )}
        <Button size="sm" variant="ghost" className="h-8" onClick={() => navigate('/experto/compartidos')}>Mis compartidos</Button>
        {cod && <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => archivarLibro(cod, true).then(() => navigate('/experto'))}>Archivar libro</Button>}
        {f && <Button variant="outline" size="sm" onClick={() => navigate(String(f.tipo ?? '').toLowerCase().includes('gil') ? `/compras-agiles/${cod}` : `/oportunidades/licitacion/${cod}`)}>Ver la oportunidad</Button>}
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">{cod}</h1>
        {f && <span className="text-muted-foreground truncate max-w-[50vw]">{f.nombre} · {nombrePropio(f.institucion)}</span>}
        {f && <Badge variant="outline">cierra {fecha(f.fecha_cierre)}</Badge>}
        {oportunidadLibro && <AccionesCompartir oportunidad={oportunidadLibro} extraEmail={extraEmailLibro} />}
        {(() => { const v = veredictoDe(entregables.informe); return v ? <Badge variant="outline" className={v.c} title="Veredicto del informe de trabajo">{v.t}</Badge> : null; })()}
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      {compartido && (
        <div className="flex items-center gap-1 flex-wrap text-xs rounded-md border border-primary/30 bg-primary/5 px-2 py-1">
          <span className="font-medium truncate max-w-[30vw]" title={compartido.titulo}>Link listo</span>
          <Button size="sm" className="h-7 bg-[#25D366] hover:bg-[#1ebe5d] text-white" asChild><a href={waUrl(compartido)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1" />WhatsApp (link)</a></Button>
          {compartido.tipo !== 'mapa' && compartido.tipo !== 'infografia' && <Button size="sm" variant="outline" className="h-8" onClick={pdfCompartido} disabled={ocupado === 'pdf'}>{ocupado === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}PDF para WhatsApp</Button>}
          <Button size="sm" variant="outline" className="h-8" onClick={() => { navigator.clipboard.writeText(compartido.url); toast.success('Copiado'); }}><Copy className="h-4 w-4 mr-1" />Copiar link</Button>
          <Button size="sm" variant="outline" className="h-8" asChild><a href={oportunidadLibro ? mailtoOportunidad(oportunidadLibro, `${compartido.titulo}\n${compartido.url}`) : `mailto:?subject=${encodeURIComponent(compartido.titulo)}&body=${encodeURIComponent(compartido.titulo + '\n' + compartido.url)}`}><Mail className="h-4 w-4 mr-1" />Email (link)</a></Button>
          <Button size="sm" variant="outline" className="h-8" asChild><a href={compartido.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Ver página</a></Button>
          {typeof navigator !== 'undefined' && 'share' in navigator && <Button size="sm" variant="ghost" className="h-8" onClick={() => navigator.share({ title: compartido.titulo, url: compartido.url }).catch(() => {})}><Share2 className="h-4 w-4 mr-1" />Más…</Button>}
          <button className="ml-auto text-muted-foreground" onClick={() => setCompartido(null)}>✕</button>
        </div>
      )}
      {!isLoading && cod && libro && !f && (
        <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">No encontré {cod} en la base de Mercado Público. Revisa el ID o sube las bases para trabajar igual.</p>
      )}

      {(() => {
      const panelFuentes = (
        <div className="space-y-3 h-full overflow-y-auto pr-1">
          {!cod && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Mis libros</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex gap-1">
                  <Input value={buscarLibro} onChange={(e) => setBuscarLibro(e.target.value)} placeholder="Buscar por ID, nombre u organismo" className="h-8" />
                  <Button size="sm" variant={verArchivados ? 'default' : 'outline'} className="h-8 shrink-0" onClick={() => setVerArchivados((v) => !v)}>{verArchivados ? 'Archivados' : 'Activos'}</Button>
                </div>
                {libros.length === 0 && <p className="text-muted-foreground">{verArchivados ? 'No tienes libros archivados.' : 'Cada licitación que estudies queda aquí con sus fuentes, bases, chat y entregables, sin límite. Escribe un ID arriba o desde una oportunidad usa "Libro del Experto".'}</p>}
                {libros.map((l: any) => (
                  <div key={l.codigo} className="flex items-start gap-1 rounded-md border px-2 py-1 hover:border-primary">
                    <button onClick={() => navigate(`/experto/libro/${l.codigo}`)} className="flex-1 text-left min-w-0">
                      <span className="font-medium">{l.codigo}</span>{l.nombre && <span className="text-muted-foreground"> · {l.nombre}</span>}
                      <p className="text-[11px] text-muted-foreground">{l.cierre ? `cierra ${fecha(l.cierre)} · ` : ''}{l.consultas} interacciones</p>
                    </button>
                    <button className="text-[11px] text-muted-foreground underline shrink-0" onClick={() => archivarLibro(l.codigo, !l.archivado)}>{l.archivado ? 'Reactivar' : 'Archivar'}</button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {cod && <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Fuentes</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium flex items-center gap-1"><FileText className="h-4 w-4" />Ficha Mercado Público</p>
                {f ? <p className="text-muted-foreground">{f.tipo ?? ''} · {fmt(f.presupuesto)} · {f.estado}</p> : <p className="text-muted-foreground">sin ficha</p>}
                {f?.url && <a className="text-primary underline text-xs" href={f.url} target="_blank" rel="noreferrer">ver en Mercado Público</a>}
              </div>
              <div>
                <p className="font-medium flex items-center gap-1"><Upload className="h-4 w-4" />Fuentes subidas · bases (PDF)</p>
                {bases.length ? bases.map((b) => <p key={b.id} className="text-muted-foreground truncate">{b.archivo} · {b.paginas} pág.</p>) : <p className="text-muted-foreground">Nadie las ha subido aún.</p>}
                <input ref={fileRef} type="file" multiple accept=".pdf,.xlsx,.xls,.xlsm,.csv,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp" className="hidden" onChange={(e) => { if (e.target.files?.length) subirFuentes(e.target.files); e.target.value = ''; }} />
                <Button size="sm" variant="outline" className="mt-1" onClick={() => fileRef.current?.click()} disabled={ocupado === 'fuentes'}>
                  {ocupado === 'fuentes' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}Subir fuentes (PDF, Excel, Word, imágenes)
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1">Puedes elegir varios a la vez. Los PDF de bases se reconocen solos y quedan para todos; el resto es tuyo. {esPro ? 'Tu plan permite hasta 10 archivos por licitación (Plus y ERP: 50).' : 'Plan gratis: 2 archivos de hasta 5 MB por licitación.'}</p>
              </div>
              <div>
                <p className="font-medium flex items-center gap-1"><Paperclip className="h-4 w-4" />Mis documentos de trabajo</p>
                <p className="text-xs text-muted-foreground">Excel, Word, PDF o imágenes (tu matriz, checklist, anexos a medio llenar). El Experto los lee para anotar qué te falta y ayudarte a completarlos.{documentos.length === 0 ? ' Sube con el botón de arriba.' : ''}</p>
                {documentos.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-1 text-muted-foreground">
                    <span className="truncate flex-1" title={d.nombre}>{d.nombre} <span className="text-[10px] uppercase">{d.tipo}</span></span>
                    {d.tipo === 'docx' && (
                      // Anexo oficial en Word: el Experto lo completa en el mismo archivo (formato intacto).
                      <button onClick={() => completarWord(d)} disabled={!!ocupado} title="Completar este Word con los datos de tu empresa, conservando el formato" className="flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] text-firmavb-blue hover:bg-muted disabled:opacity-50">
                        {ocupado === 'word:' + d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}<span className="hidden sm:inline">Completar</span>
                      </button>
                    )}
                    <button onClick={() => borrarDocumento(d.id)} title="Quitar"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {documentos.filter((x: any) => x.tipo === 'docx').length > 1 && (
                  <Button size="sm" variant="outline" className="mt-1 w-full sm:w-auto" onClick={completarTodos} disabled={!!ocupado}>
                    {ocupado === 'word:todos' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}Completar todos los anexos Word
                  </Button>
                )}
                {anexosWord.length > 0 && (
                  <div className="mt-2 rounded-md border border-yellow-200 bg-yellow-50/40 p-2 space-y-1">
                    <p className="font-medium text-xs flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-firmavb-blue" />Anexos completados por el Experto</p>
                    <p className="text-[11px] text-muted-foreground">Mismo Word oficial, con tus datos. Lo amarillo es lo que debes validar o decidir antes de firmar.</p>
                    {anexosWord.map((a: any) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-1 text-xs">
                        <span className="truncate flex-1 min-w-[140px]" title={a.campos?.[0]?.resumen ?? a.nombre}>{a.nombre}{a.campos?.[0]?.tipo ? <span className="ml-1 text-[10px] uppercase text-muted-foreground">{String(a.campos[0].tipo).replace(/_/g, ' ')}</span> : null}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${a.campos_validar ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>{a.campos_validar ? `${a.campos_validar} por validar` : 'sin pendientes'}</span>
                        {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-firmavb-blue hover:bg-muted"><FileText className="h-3.5 w-3.5" />Descargar</a>}
                        <button onClick={() => borrarAnexoWord(a.id)} title="Quitar"><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                    ))}
                  </div>
                )}

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
          </Card>}
        </div>);
      const panelChat = (
        <Card className="flex flex-col h-full min-h-[60vh]">
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Conversación con el Experto</CardTitle></CardHeader>
          <CardContent className="flex-1 flex flex-col gap-2">
            <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[70vh]">
              {msgs.length === 0 && (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>{cod ? 'Pregúntame sobre esta licitación con las fuentes de la izquierda. Ejemplos:' : 'Pregúntame lo que quieras sobre vender al Estado: ley, garantías, un organismo, qué se está licitando, noticias. Si me das un ID de licitación, abro su libro con fuentes y entregables. Ejemplos:'}</p>
                  {(cod ? ['¿Vale la pena postular? ¿Qué me juega en contra?', '¿Cuáles son los criterios de evaluación y cómo gano puntos?', '¿Qué garantías y multas tiene y qué riesgo veo?', '¿A qué precio debería ofertar según lo que se ha pagado?']
                    : ['¿Cómo funciona una compra ágil y cómo la gano?', '¿Es riesgoso venderle a la Municipalidad de Puerto Montt? ¿Cómo paga?', '¿Hay licitaciones abiertas de servicios de aseo?', '¿Qué garantía de seriedad me pueden pedir y cuándo?']).map((e) => (
                    <button key={e} className="block text-left rounded-full border px-3 py-1 hover:border-primary" onClick={() => setPregunta(e)}>{e}</button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => m.rol === 'yo' ? (
                <div key={i} className="ml-auto max-w-[85%] rounded-2xl bg-firmavb-blue text-white px-4 py-2 text-sm">{m.texto}</div>
              ) : (
                <div key={i} className="max-w-[95%] rounded-2xl bg-muted/50 px-4 py-3 text-sm">
                  {m.texto ? <div dangerouslySetInnerHTML={{ __html: conCitas(expertoMd(m.texto), m.fuentes) }} onClick={(e) => {
                    const a = (e.target as HTMLElement).closest('a.cita') as HTMLAnchorElement | null; if (!a || a.getAttribute('href') !== '#') return;
                    e.preventDefault(); const d = document.getElementById(`fuentes-${i}`) as HTMLDetailsElement | null; if (d) d.open = true;
                    const fila = document.getElementById(`fuente-${i}-${a.dataset.n}`); if (fila) { fila.scrollIntoView({ block: 'nearest' }); fila.classList.add('bg-yellow-100'); setTimeout(() => fila.classList.remove('bg-yellow-100'), 1500); }
                  }} /> : <span className="text-muted-foreground">Buscando en las fuentes…</span>}
                  {m.pedirBases && <p className="mt-2 text-xs text-muted-foreground">Sube las bases en el panel de Fuentes y vuelve a preguntar.</p>}
                  {!cod && m.texto && idEn(msgs[i - 1]?.texto ?? '') && <Button size="sm" variant="outline" className="mt-2" onClick={() => navigate(`/experto/libro/${idEn(msgs[i - 1].texto)}`)}><BookOpen className="h-3.5 w-3.5 mr-1" />Abrir el libro de {idEn(msgs[i - 1].texto)}</Button>}
                  {m.texto && m.fuentes && m.fuentes.length > 0 && (
                    <details id={`fuentes-${i}`} className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Fuentes ({m.fuentes.length}) · haz clic en un [n] del texto para ver de dónde salió</summary>
                      {m.fuentes.map((s: any) => <div key={s.n} id={`fuente-${i}-${s.n}`} className="rounded px-1 transition-colors">[{s.n}] {s.url ? <a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.fuente}</a> : s.fuente}</div>)}
                    </details>
                  )}
                  {m.texto && !ocupado && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {i === msgs.length - 1 && <>¿Te sirvió?
                        <button onClick={() => opinar(msgs[i - 1]?.texto ?? '', true)}><ThumbsUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => opinar(msgs[i - 1]?.texto ?? '', false)}><ThumbsDown className="h-3.5 w-3.5" /></button></>}
                      <button className="ml-auto flex items-center gap-1 underline" onClick={() => aPdf('Respuesta del Experto', `**Pregunta:** ${msgs[i - 1]?.texto ?? ''}\n\n${m.texto}`)}><Printer className="h-3.5 w-3.5" />PDF</button>
                      <button className="flex items-center gap-1 underline" onClick={() => compartirTexto('chat', (msgs[i - 1]?.texto ?? `Respuesta del Experto · ${cod}`).slice(0, 120), `**Pregunta:** ${msgs[i - 1]?.texto ?? ''}\n\n${m.texto}`)}><Share2 className="h-3.5 w-3.5" />Compartir</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {limite && (
              <div className="flex items-center gap-2 flex-wrap text-xs rounded-md border border-yellow-200 bg-yellow-50 text-yellow-900 px-3 py-2">
                <span>{limite}</span>
                <Button size="sm" className="h-7 ml-auto" onClick={() => navigate('/cuenta')}>Ver planes</Button>
              </div>
            )}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); preguntar(); }}>
              <Input value={pregunta} onChange={(e) => setPregunta(e.target.value)} placeholder={cod ? `Pregunta sobre ${cod}…` : 'Pregúntale al Experto o escribe un ID de licitación…'} disabled={!!ocupado} />
              <Button type="submit" disabled={!!ocupado || !pregunta.trim()}>{ocupado === 'chat' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
            </form>
          </CardContent>
        </Card>);
      const panelEntregables = cod ? (
        <Card className="flex flex-col h-full overflow-y-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Entregables</CardTitle>
            <div className="flex flex-wrap gap-1 pt-1">
              {([['sala', 'Sala de postulación', ''], ['informe', 'Informe de trabajo', ''], ['matriz', 'Matriz de postulación', 'Experto Pro'], ['estudio', 'Estudio profundo', 'Experto Pro'], ['mapa', 'Mapa conceptual', ''], ['infografia', 'Infografía', ''], ['anexos', 'Anexos completados', 'Experto Plus']] as [Entregable, string, string][]).map(([k, n, tag]) => (
                <Button key={k} size="sm" variant={tab === k ? 'default' : 'outline'} onClick={() => entregables[k] ? setTab(k) : generar(k)} disabled={!!ocupado && ocupado !== k}>
                  {ocupado === k ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : entregables[k] ? <ClipboardList className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  {n}{tag && <span className="ml-1 text-[10px] opacity-70">{tag}</span>}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="text-sm flex-1">
            {tab === 'sala' ? (
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <SalaPostulacion cod={cod} ficha={f} bases={bases} documentos={documentos} plan={libro?.plan} informe={entregables.informe}
                  matriz={entregables.matriz ? JSON.parse(entregables.matriz) : null} anexos={entregables.anexos} faltantes={faltantes} veredicto={veredictoDe(entregables.informe)}
                  onGenerar={(t) => generar(t)} onIr={(t) => setTab(t)} onMatriz={matrizCambio} onPreguntar={(q) => { setPregunta(q); if (!escritorio) setVista('chat'); }}
                  irOportunidad={f ? () => navigate(String(f.tipo ?? '').toLowerCase().includes('gil') ? `/compras-agiles/${cod}` : `/oportunidades/licitacion/${cod}`) : undefined}
                  aprobar={aprobarPostulacion} ocupado={ocupado} />
              </div>
            ) : entregables[tab] ? (
              <div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <Button size="sm" variant="outline" onClick={compartirEntregable}><Share2 className="h-3.5 w-3.5 mr-1" />Compartir · PDF · WhatsApp</Button>
                  {tab !== 'mapa' && tab !== 'infografia' && tab !== 'matriz' && <>
                    <Button size="sm" variant="ghost" onClick={() => aWord(nombresEntregable[tab], entregables[tab])}><FileText className="h-3.5 w-3.5 mr-1" />Word</Button>
                    <Button size="sm" variant="ghost" onClick={() => aPdf(nombresEntregable[tab], entregables[tab])}><Printer className="h-3.5 w-3.5 mr-1" />PDF</Button>
                    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(entregables[tab]); toast.success('Copiado'); }}><Copy className="h-3.5 w-3.5 mr-1" />Copiar</Button></>}
                  <Button size="sm" variant="ghost" onClick={() => generar(tab)} disabled={!!ocupado}>Volver a generar</Button>
                </div>
                {tab === 'anexos' && faltantes.length > 0 && <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 mb-2">Completa a mano: {faltantes.join(', ')}</p>}
                {tab === 'mapa' ? (
                  <div className="max-h-[62vh] overflow-y-auto pr-1"><MapaConceptual raiz={JSON.parse(entregables.mapa) as Nodo} onPreguntar={(t) => setPregunta(`Sobre ${cod}: explícame "${t}" y qué debo hacer con eso`)} /></div>
                ) : tab === 'matriz' ? (
                  <div className="max-h-[62vh] overflow-y-auto pr-1"><MatrizPostulacion m={JSON.parse(entregables.matriz) as Matriz} onChange={matrizCambio} url={`${window.location.origin}/experto/libro/${cod}`} /></div>
                ) : tab === 'infografia' ? (
                  <div className="max-h-[62vh] overflow-y-auto pr-1"><Infografia d={datosInfografia()} /></div>
                ) : (
                  <div className="max-h-[62vh] overflow-y-auto pr-1">
                    {f && (tab === 'estudio' || tab === 'informe') && (
                      <div className="grid grid-cols-2 gap-1 mb-3 text-xs">
                        {(() => { const pg = pagoOrganismo(o); return [['Presupuesto', presupuestoTexto(f.presupuesto, cod), ''], ['Cierra', fecha(f.fecha_cierre), ''], ['Pago del organismo', pg.valor, pg.detalle], ['Organismo', nombrePropio(f.institucion), f.region ?? '']]; })().map(([k, v, d]) => (
                          <div key={k} className="rounded-md border bg-muted/30 px-2 py-1" title={d}><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p><p className="font-semibold truncate">{v}</p>{d && <p className="text-[10px] text-muted-foreground truncate">{d}</p>}</div>
                        ))}
                      </div>
                    )}
                    <div className="prose-experto" dangerouslySetInnerHTML={{ __html: conCitas(expertoMd(entregables[tab])) }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground space-y-2">
                <p>{tab === 'mapa' && 'Mapa conceptual navegable: qué compran, fechas, cómo se gana, requisitos, garantías, organismo, competencia, riesgos y tu jugada. Cada nodo se abre y se le puede preguntar al Experto.'}
                   {tab === 'infografia' && 'Lámina con marca FirmaVB: presupuesto, cierre, riesgo de pago, quién gana y quién vende. Para WhatsApp, LinkedIn o PDF.'}
                   {tab === 'matriz' && 'Matriz de postulación (Pro): checklist de admisibilidad, cómo se puntúa, anexos, reglas especiales y plan de tareas con responsable y plazo. Se edita aquí, se exporta a Excel, Word o PDF, y usa tus documentos de trabajo para marcar lo que ya tienes listo.'}
                   {tab === 'informe' && 'Informe de trabajo: veredicto, fechas, checklist de admisibilidad, cómo se ganan los puntos, riesgos, competencia y próximos pasos.'}
                   {tab === 'estudio' && 'Estudio profundo (Pro): historial de compras parecidas del organismo, quién ganó y con cuánto, precio objetivo.'}
                   {tab === 'anexos' && 'Anexos completados (Plus): los formularios de las bases con los datos de tu empresa, listos para revisar y firmar.'}</p>
                {!esPro && tab !== 'informe' && <p className="text-xs">Requiere Experto {tab === 'anexos' ? 'Plus' : 'Pro'} o FirmaVB ERP.</p>}
                <Button size="sm" onClick={() => generar(tab)} disabled={!!ocupado}><Sparkles className="h-4 w-4 mr-1" />Generar</Button>
              </div>
            )}
          </CardContent>
        </Card>) : null;
      if (!escritorio) return (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1 rounded-md border p-1 text-sm">
            {([['fuentes', cod ? 'Fuentes' : 'Mis libros'], ['chat', 'Chat'], ['entregables', 'Entregables']] as const).filter(([k]) => k !== 'entregables' || cod).map(([k, n]) => (
              <button key={k} onClick={() => setVista(k)} className={`rounded px-2 py-1 ${vista === k ? 'bg-firmavb-blue text-white' : 'hover:bg-muted'}`}>{n}</button>
            ))}
          </div>
          {vista === 'fuentes' ? panelFuentes : vista === 'entregables' && panelEntregables ? panelEntregables : panelChat}
        </div>
      );
      return (
        <ResizablePanelGroup orientation="horizontal" className="min-h-[calc(100vh-11rem)]">
          <ResizablePanel defaultSize={cod ? 22 : 26} minSize={14} collapsible collapsedSize={0}>{panelFuentes}</ResizablePanel>
          <ResizableHandle withHandle className="mx-1" />
          <ResizablePanel defaultSize={cod ? 46 : 74} minSize={30}>{panelChat}</ResizablePanel>
          {panelEntregables && <><ResizableHandle withHandle className="mx-1" /><ResizablePanel defaultSize={32} minSize={22} collapsible collapsedSize={0}>{panelEntregables}</ResizablePanel></>}
        </ResizablePanelGroup>
      );
      })()}
    </div>
  );
}
