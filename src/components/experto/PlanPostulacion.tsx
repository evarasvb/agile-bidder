// Plan de postulación del Libro: calendario de pasos con fecha límite, responsable
// y check de hecho. Se guarda solo por licitación; la campanita avisa el día antes.
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CalendarPlus, Copy, RefreshCw, Trash2, Plus, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { aFecha, etiquetaPlazo, hoyIso, nuevoPasoManual, ordenarPlan, planAIcs, planATexto, type IrPlan, type PasoPlan } from '@/lib/planPostulacion';

const TONO: Record<ReturnType<typeof etiquetaPlazo>['tono'], string> = {
  ok: 'bg-green-100 text-green-800 border-green-200',
  hoy: 'bg-red-100 text-red-800 border-red-200',
  pronto: 'bg-amber-100 text-amber-900 border-amber-200',
  vencido: 'bg-red-50 text-red-700 border-red-200',
  neutro: 'bg-muted text-muted-foreground border-border',
};
const NOMBRE_IR: Record<IrPlan, string> = { informe: 'Pedir informe', matriz: 'Abrir matriz', bajo_agua: 'Ver Bajo el Agua', anexos: 'Ver anexos', postular: 'Ir a postular' };

export interface PlanPostulacionProps {
  cod: string;
  nombre?: string | null;
  fechaCierre?: string | null;
  pasos: PasoPlan[];
  onChange: (pasos: PasoPlan[]) => void;
  onRecalcular: () => void;
  onIr?: (destino: IrPlan) => void;
  guardando?: boolean;
}

export function PlanPostulacion(p: PlanPostulacionProps) {
  const [nuevo, setNuevo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const hoy = hoyIso();
  const hechos = p.pasos.filter((x) => x.hecho).length;
  const total = p.pasos.length;
  const pct = total ? Math.round((hechos / total) * 100) : 0;
  const diasCierre = useMemo(() => { const c = aFecha(p.fechaCierre); return c ? Math.ceil((c.getTime() - Date.now()) / 86400000) : null; }, [p.fechaCierre]);
  const responsables = useMemo(() => Array.from(new Set(p.pasos.map((x) => (x.responsable ?? '').trim()).filter(Boolean))), [p.pasos]);
  const proximo = p.pasos.find((x) => !x.hecho);

  const cambiar = (id: string, cambios: Partial<PasoPlan>) => p.onChange(p.pasos.map((x) => (x.id === id ? { ...x, ...cambios } : x)));
  const marcar = (x: PasoPlan, v: boolean) => cambiar(x.id, { hecho: v, hecho_en: v ? new Date().toISOString() : null });
  const quitar = (id: string) => p.onChange(p.pasos.filter((x) => x.id !== id));
  const agregar = () => {
    if (!nuevo.trim()) return;
    p.onChange(ordenarPlan([...p.pasos, nuevoPasoManual(nuevo, nuevaFecha || null)]));
    setNuevo(''); setNuevaFecha('');
  };
  const copiar = async () => { await navigator.clipboard.writeText(planATexto(p.cod, p.nombre, p.pasos)); toast.success('Plan copiado: pégalo en WhatsApp o correo del equipo'); };
  const calendario = () => {
    const blob = new Blob([planAIcs(p.cod, p.nombre, p.pasos)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `plan-${p.cod}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Calendario descargado: ábrelo en Google Calendar, Outlook o iPhone');
  };

  return (
    <section className="rounded-lg border p-3 space-y-3" aria-label="Plan de postulación">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Plan de postulación</p>
        <span className="text-xs text-muted-foreground">{hechos}/{total} pasos listos{diasCierre != null && (diasCierre >= 0 ? ` · cierra en ${diasCierre} día${diasCierre === 1 ? '' : 's'}` : ' · cerrada')}</span>
        {p.guardando && <span className="text-[11px] text-muted-foreground">guardando…</span>}
        <div className="ml-auto flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={p.onRecalcular} title="Vuelve a calcular las fechas desde Mercado Público. Lo hecho, los responsables y tus fechas manuales se conservan."><RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Recalcular fechas</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={calendario}><CalendarPlus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Calendario</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={copiar}><Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Copiar</Button>
        </div>
      </div>
      <Progress value={pct} className="h-1.5" aria-label={`${pct}% del plan completado`} />
      {proximo && (
        <p className="text-xs text-muted-foreground">
          Siguiente: <span className="font-medium text-foreground">{proximo.titulo}</span>{proximo.fecha ? ` · ${etiquetaPlazo(proximo, hoy).texto.toLowerCase()}` : ''}. Las fechas salen de Mercado Público; marca lo hecho y pon un responsable: la campanita avisa el día antes.
        </p>
      )}

      <ul className="divide-y">
        {p.pasos.map((x) => {
          const et = etiquetaPlazo(x, hoy);
          return (
            <li key={x.id} className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 py-2 sm:grid-cols-[auto_1fr_auto] sm:items-start">
              <Checkbox checked={!!x.hecho} onCheckedChange={(v) => marcar(x, v === true)} aria-label={`${x.titulo}: ${x.hecho ? 'hecho' : 'pendiente'}`} className="mt-0.5" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-sm ${x.hecho ? 'line-through text-muted-foreground' : 'font-medium'}`}>{x.titulo}</span>
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] ${TONO[et.tono]}`}>{et.texto}</span>
                  {x.ir && p.onIr && !x.hecho && (
                    <button type="button" onClick={() => p.onIr!(x.ir!)} className="inline-flex items-center gap-0.5 text-[11px] text-firmavb-blue hover:underline">{NOMBRE_IR[x.ir]}<ArrowRight className="h-3 w-3" aria-hidden="true" /></button>
                  )}
                </div>
                {x.detalle && !x.hecho && <p className="text-xs text-muted-foreground">{x.detalle}</p>}
              </div>
              <div className="col-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-3 sm:justify-end">
                <input type="date" value={x.fecha ?? ''} onChange={(e) => cambiar(x.id, { fecha: e.target.value || null, fecha_manual: true })} aria-label={`Fecha límite de ${x.titulo}`} className="h-7 rounded border bg-background px-1.5 text-xs" />
                <input list="plan-responsables" value={x.responsable ?? ''} onChange={(e) => cambiar(x.id, { responsable: e.target.value })} placeholder="responsable" aria-label={`Responsable de ${x.titulo}`} className="h-7 w-28 rounded border bg-background px-1.5 text-xs" />
                {x.origen === 'manual' && <button type="button" onClick={() => quitar(x.id)} aria-label={`Quitar ${x.titulo}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>}
              </div>
            </li>
          );
        })}
      </ul>
      <datalist id="plan-responsables">{responsables.map((r) => <option key={r} value={r} />)}</datalist>

      <form className="flex flex-col gap-1.5 sm:flex-row" onSubmit={(e) => { e.preventDefault(); agregar(); }}>
        <Input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Agregar un paso propio, ej: pedir certificado de la mutual" aria-label="Nuevo paso" className="h-8 text-xs" />
        <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} aria-label="Fecha del nuevo paso" className="h-8 rounded border bg-background px-1.5 text-xs" />
        <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!nuevo.trim()}><Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" />Agregar</Button>
      </form>
    </section>
  );
}
