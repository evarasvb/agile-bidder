// Sala de postulación: el libro ordenado como proceso. Une lo que ya existe (informe, matriz,
// anexos, bases, documentos) en un solo tablero: veredicto → admisibilidad → puntaje → equipo →
// documentos → revisión y postulación. Nada se genera aquí; se lee y se coordina.
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, AlertTriangle, Sparkles, ExternalLink, ShieldCheck } from 'lucide-react';
import type { Matriz } from '@/components/experto/MatrizPostulacion';
import { pagoOrganismo, presupuestoTexto } from '@/lib/organismoPago';

type Paso = { k: string; t: string; listo: boolean; accion?: () => void; ayuda?: string };
const pond = (r: any): number => { const n = r.ponderacion_num != null ? Number(r.ponderacion_num) : Number(String(r.ponderacion ?? '').replace(/[^0-9.,]/g, '').replace(',', '.')); if (!Number.isFinite(n) || n === 0) return 0; return n > 1 ? n / 100 : n; };
const num = (v: any): number | null => { const n = Number(String(v ?? '').replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')); return v == null || v === '' || !Number.isFinite(n) ? null : n; };
const ESTADO: Record<string, [string, string]> = { cumple: ['Cumple', 'bg-green-100 text-green-800'], ok: ['OK', 'bg-green-100 text-green-800'], verificar: ['Verificar', 'bg-yellow-100 text-yellow-800'], no_aplica: ['No aplica', 'bg-muted text-muted-foreground'], solo_si_adjudica: ['Solo si adjudica', 'bg-blue-100 text-blue-800'], no_cumple: ['No cumple', 'bg-red-100 text-red-800'], revisar: ['Revisar', 'bg-yellow-100 text-yellow-800'], pendiente: ['Pendiente', 'bg-muted text-muted-foreground'] };
const Chip = ({ e }: { e?: string }) => { const [t, c] = ESTADO[e ?? 'pendiente'] ?? ESTADO.pendiente; return <span className={`rounded px-1.5 py-0.5 text-[11px] ${c}`}>{t}</span>; };

export interface SalaProps {
  cod: string; ficha: any; bases: any[]; documentos: any[]; plan?: string;
  informe: string; matriz: Matriz | null; anexos: string; faltantes: string[]; veredicto: { t: string; c: string } | null;
  onGenerar: (tipo: 'informe' | 'matriz' | 'anexos' | 'estudio') => void; onIr: (tab: any) => void; onMatriz: (m: Matriz) => void; onPreguntar: (q: string) => void; irOportunidad?: () => void;
  aprobar: () => void; ocupado: string | null;
}

export function SalaPostulacion(p: SalaProps) {
  const m = p.matriz; const f = p.ficha ?? {}; const o = f.organismo ?? {};
  const adm = m?.admisibilidad ?? []; const ev = m?.evaluacion ?? []; const tareas = m?.tareas ?? [];
  const noCumple = adm.filter((r) => r.estado === 'no_cumple'); const pend = adm.filter((r) => !r.estado || r.estado === 'pendiente' || r.estado === 'revisar'); const cumple = adm.filter((r) => r.estado === 'cumple');
  const total = ev.reduce((a, r) => a + (num(r.puntaje_estimado) ?? 0) * pond(r), 0);
  const umbral = num(m?.umbral_adjudicacion);
  const dias = f.fecha_cierre ? Math.ceil((new Date(f.fecha_cierre).getTime() - Date.now()) / 86400000) : null;
  const campos = (p.anexos.match(/\[\[[^\]]+\]\]/g) ?? []).length;
  const aprob = (m as any)?.aprobacion as { por?: string; en?: string } | undefined;
  const proxima = tareas.find((t) => !['ok', 'no_aplica', 'solo_si_adjudica'].includes(t.estado));
  const garantias = (m as any)?.garantias ?? []; const carga = (m as any)?.secuencia_carga ?? []; const pendHum = ((m as any)?.pendientes_humanos ?? []) as any[];
  const pasos: Paso[] = [
    { k: 'bases', t: 'Bases leídas', listo: p.bases.length > 0, ayuda: 'Sube el PDF de las bases en Fuentes' },
    { k: 'informe', t: 'Veredicto', listo: !!p.informe, accion: () => p.onGenerar('informe') },
    { k: 'matriz', t: 'Requisitos y puntaje', listo: !!m, accion: () => p.onGenerar('matriz') },
    { k: 'evidencias', t: 'Admisibilidad completa', listo: !!m && adm.length > 0 && noCumple.length === 0 && pend.length === 0, accion: () => p.onIr('matriz') },
    { k: 'anexos', t: 'Anexos completados', listo: !!p.anexos && campos === 0, accion: () => p.anexos ? p.onIr('anexos') : p.onGenerar('anexos') },
    { k: 'revision', t: 'Revisada y aprobada', listo: !!aprob?.en, accion: p.aprobar },
  ];
  const listaParaPostular = pasos.every((s) => s.listo);
  const setTarea = (i: number, campo: string, v: string) => { if (!m) return; p.onMatriz({ ...m, tareas: tareas.map((t, j) => j === i ? { ...t, [campo]: v } : t) }); };

  return (
    <div className="space-y-4 text-sm">
      {/* Proceso */}
      <div className="flex flex-wrap gap-1">
        {pasos.map((s, i) => (
          <button key={s.k} onClick={s.accion} title={s.ayuda} className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${s.listo ? 'border-green-300 bg-green-50 text-green-800' : 'hover:border-primary'}`}>
            {s.listo ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}{i + 1}. {s.t}
          </button>
        ))}
      </div>

      {/* 1. Resumen ejecutivo */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold">Resumen ejecutivo</p>
          {p.veredicto ? <span className={`rounded border px-2 py-0.5 text-xs font-medium ${p.veredicto.c}`}>{p.veredicto.t}</span> : <Button size="sm" variant="outline" className="h-7" onClick={() => p.onGenerar('informe')} disabled={!!p.ocupado}><Sparkles className="h-3.5 w-3.5 mr-1" />Pedir veredicto</Button>}
          {listaParaPostular && <span className="rounded bg-green-600 text-white px-2 py-0.5 text-xs font-medium">Lista para postular</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
          {[['Presupuesto', presupuestoTexto(f.presupuesto, f.codigo), ''], ['Cierre', dias == null ? 's/i' : dias < 0 ? 'cerrada' : `en ${dias} días`, ''], ['Pago del organismo', pagoOrganismo(o).valor, pagoOrganismo(o).detalle], ['Puntaje estimado', m && ev.length ? `${total.toFixed(1)}${umbral != null ? ` / umbral ${umbral}` : ''}` : 's/i', '']].map(([k, v, d]) => (
            <div key={k} className="rounded-md border bg-muted/30 px-2 py-1" title={d}><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</p><p className="font-semibold truncate">{v}</p>{d && <p className="text-[10px] text-muted-foreground truncate">{d}</p>}</div>
          ))}
        </div>
        {m && ev.length > 0 && umbral != null && <p className={`text-xs ${total >= umbral ? 'text-green-700' : 'text-red-700'}`}>{total >= umbral ? 'Con tu puntaje estimado superas el umbral de adjudicación.' : `Te faltan ${(umbral - total).toFixed(1)} puntos para el umbral: revisa qué criterios puedes subir en Requisitos y puntaje.`}</p>}
        {proxima && <p className="text-xs"><span className="font-medium">Próxima acción:</span> {proxima.accion} <span className="text-muted-foreground">({proxima.responsable ?? 'sin responsable'}{proxima.plazo ? ` · ${proxima.plazo}` : ''})</span></p>}
      </div>

      {/* 2. Admisibilidad */}
      <div className="rounded-lg border p-3 space-y-1">
        <div className="flex items-center gap-2"><p className="font-semibold">Admisibilidad</p>{m && <span className="text-xs text-muted-foreground">{cumple.length}/{adm.length} cumplidos</span>}<Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => m ? p.onIr('matriz') : p.onGenerar('matriz')}>{m ? 'Editar' : 'Generar'}</Button></div>
        {!m && <p className="text-xs text-muted-foreground">Genera la matriz: el Experto convierte las bases en requisitos con su fuente y cómo se chequea cada uno.</p>}
        {noCumple.map((r, i) => <p key={'n' + i} className="text-xs flex items-start gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5" /><span><b>{r.requisito}</b>: {r.nota || r.regla} <span className="text-muted-foreground">({r.fuente})</span></span></p>)}
        {pend.slice(0, 6).map((r, i) => <p key={'p' + i} className="text-xs flex items-center gap-1"><Chip e={r.estado} /><span>{r.requisito}</span><span className="text-muted-foreground truncate">· {r.fuente}</span></p>)}
        {m && noCumple.length === 0 && pend.length === 0 && <p className="text-xs text-green-700 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Todos los requisitos de admisibilidad están cumplidos.</p>}
      </div>

      {/* 3. Equipo y tareas */}
      <div className="rounded-lg border p-3 space-y-1">
        <p className="font-semibold">Equipo y tareas</p>
        {!tareas.length && <p className="text-xs text-muted-foreground">Las tareas salen de la matriz. Asigna responsable y plazo aquí; se guardan solos.</p>}
        {tareas.map((t, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-1 text-xs border-b last:border-0 py-1">
            <button onClick={() => setTarea(i, 'estado', t.estado === 'ok' ? 'pendiente' : 'ok')} title="Marcar">{t.estado === 'ok' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}</button>
            <span className={t.estado === 'ok' ? 'line-through text-muted-foreground' : ''}>{t.accion}</span>
            <input value={t.responsable ?? ''} onChange={(e) => setTarea(i, 'responsable', e.target.value)} placeholder="responsable" className="w-28 bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none" />
            <input value={t.plazo ?? ''} onChange={(e) => setTarea(i, 'plazo', e.target.value)} placeholder="plazo" className="w-24 bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none" />
          </div>
        ))}
      </div>

      {/* 4. Documentos */}
      <div className="rounded-lg border p-3 space-y-1">
        <p className="font-semibold">Documentos</p>
        <p className="text-xs"><b>Bases:</b> {p.bases.length ? p.bases.map((b) => `${b.archivo} (${b.paginas} pág.)`).join(', ') : <span className="text-amber-700">faltan, súbelas en Fuentes</span>}</p>
        <p className="text-xs"><b>Mis documentos:</b> {p.documentos.length ? p.documentos.map((d) => d.nombre).join(', ') : 'ninguno todavía'}</p>
        <p className="text-xs"><b>Anexos:</b> {p.anexos ? (campos ? <span className="text-amber-700">{campos} campos por completar a mano ({p.faltantes.slice(0, 4).join(', ')}{p.faltantes.length > 4 ? '…' : ''})</span> : <span className="text-green-700">completos, listos para firmar</span>) : <button className="underline" onClick={() => p.onGenerar('anexos')}>generar con los datos de tu empresa (Plus)</button>}</p>
      </div>

      {/* 4b. Garantías, secuencia de carga y pendientes de la empresa (vienen de la matriz) */}
      {(garantias.length > 0 || carga.length > 0 || pendHum.length > 0) && (
        <div className="rounded-lg border p-3 space-y-1">
          <p className="font-semibold">Garantías, carga y pendientes</p>
          {garantias.map((g: any, i: number) => <p key={'g' + i} className="text-xs"><b>{g.tipo}:</b> {g.exigida === false ? 'no se exige' : [g.monto_o_porcentaje, g.beneficiario && `a favor de ${g.beneficiario}`, g.vigencia && `vigencia ${g.vigencia}`].filter(Boolean).join(' · ')} {g.fuente && <span className="text-muted-foreground">({g.fuente})</span>}</p>)}
          {carga.length > 0 && <p className="text-xs"><b>Orden de carga en el portal:</b> {carga.map((c: any) => `${c.orden ?? ''}. ${c.documento}${c.donde ? ` (${c.donde})` : ''}`).join(' → ')}</p>}
          {pendHum.length > 0 && <div className="text-xs"><b>Debe validar la empresa:</b><ol className="list-decimal ml-4">{pendHum.map((t: any, i: number) => <li key={i}>{typeof t === 'string' ? t : t.texto ?? JSON.stringify(t)}</li>)}</ol></div>}
        </div>
      )}

      {/* 5. Revisión y postulación */}
      <div className="rounded-lg border p-3 space-y-2">
        <p className="font-semibold">Revisión y postulación</p>
        <ul className="text-xs space-y-0.5">
          {pasos.map((s) => <li key={s.k} className="flex items-center gap-1">{s.listo ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}{s.t}</li>)}
        </ul>
        {aprob?.en ? <p className="text-xs text-green-700">Aprobada por {aprob.por ?? 'el usuario'} el {new Date(aprob.en).toLocaleString('es-CL')}.</p>
          : <Button size="sm" variant="outline" onClick={p.aprobar} disabled={!m}><ShieldCheck className="h-3.5 w-3.5 mr-1" />Marcar como revisada y aprobada</Button>}
        <div className="flex flex-wrap gap-1">
          {p.irOportunidad && <Button size="sm" onClick={p.irOportunidad}><ExternalLink className="h-3.5 w-3.5 mr-1" />Ir a postular</Button>}
          <Button size="sm" variant="ghost" onClick={() => p.onPreguntar(`Sobre ${p.cod}: revisa mi postulación completa. ¿Qué me falta o qué riesgo ves antes de enviarla?`)}>Pedir revisión final al Experto</Button>
        </div>
      </div>
    </div>
  );
}
