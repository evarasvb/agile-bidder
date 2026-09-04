// Matriz de postulación: checklist trabajable (admisibilidad, puntaje, anexos, reglas, tareas, fechas).
// Se edita en pantalla (estado y nota) y se exporta a Excel, Word o PDF con marca FirmaVB.
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { compartirPdfExperto } from '@/services/expertoPdf';
import { matrizAExcelPro } from '@/services/matrizExcel';

export interface Matriz { titulo?: string; resumen?: string; codigo?: string; generada_en?: string; umbral_adjudicacion?: any; admisibilidad?: any[]; evaluacion?: any[]; anexos?: any[]; reglas_especiales?: any[]; tareas?: any[]; fechas?: any[] }
// Misma lógica que las fórmulas del Excel: la entrada del usuario define el estado.
const aNum = (v: any): number | null => { if (v == null || v === '') return null; const n = Number(String(v).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
export function evaluarEntrada(r: any): string {
  const e = String(r.entrada ?? '').trim(); if (!e) return 'pendiente';
  const ch = r.chequeo ?? {}; const tipo = ch.tipo ?? 'texto'; const u = aNum(ch.umbral), u2 = aNum(ch.umbral2), n = aNum(e);
  if (tipo === 'si_no') return /^s[ií]$/i.test(e) ? 'cumple' : /^no$/i.test(e) ? 'no_cumple' : 'revisar';
  if (tipo === 'minimo') return n == null || u == null ? 'revisar' : n >= u ? 'cumple' : 'no_cumple';
  if (tipo === 'maximo') return n == null || u == null ? 'revisar' : n <= u ? 'cumple' : 'no_cumple';
  if (tipo === 'rango') return n == null || u == null || u2 == null ? 'revisar' : n >= u && n <= u2 ? 'cumple' : 'no_cumple';
  return 'cumple';
}
type Seccion = { clave: keyof Matriz; titulo: string; cols: [string, string][] };
const SECCIONES: Seccion[] = [
  { clave: 'admisibilidad', titulo: '1. Admisibilidad (si falla una, quedas fuera)', cols: [['requisito', 'Requisito'], ['regla', 'Regla'], ['entrada', 'Tu dato'], ['estado', 'Estado'], ['nota', 'Nota'], ['fuente', 'Fuente']] },
  { clave: 'evaluacion', titulo: '2. Cómo se puntúa', cols: [['criterio', 'Criterio'], ['como_se_puntua', 'Cómo se puntúa'], ['ponderacion', 'Ponderación'], ['puntaje_max', 'Máximo'], ['que_hacer', 'Qué hacer para el máximo'], ['fuente', 'Fuente']] },
  { clave: 'anexos', titulo: '3. Anexos', cols: [['anexo', 'Anexo'], ['cuando', 'Cuándo'], ['quien_firma', 'Quién firma'], ['nota', 'Nota']] },
  { clave: 'reglas_especiales', titulo: '4. Reglas especiales', cols: [['aspecto', 'Aspecto'], ['regla', 'Regla']] },
  { clave: 'tareas', titulo: '5. Plan de tareas', cols: [['estado', 'Estado'], ['fase', 'Fase'], ['documento', 'Documento'], ['responsable', 'Responsable'], ['accion', 'Acción'], ['plazo', 'Plazo']] },
  { clave: 'fechas', titulo: '6. Fechas', cols: [['hito', 'Hito'], ['fecha', 'Fecha']] },
];
const ESTADOS: Record<string, string> = { pendiente: 'Pendiente', cumple: 'Cumple', ok: 'OK', no_cumple: 'No cumple', revisar: 'Revisar' };
const colorEstado = (e: string) => e === 'cumple' || e === 'ok' ? 'bg-green-100 text-green-800' : e === 'no_cumple' ? 'bg-red-100 text-red-800' : e === 'revisar' ? 'bg-yellow-100 text-yellow-800' : 'bg-muted text-muted-foreground';
const filas = (m: Matriz, k: keyof Matriz) => (Array.isArray(m[k]) ? (m[k] as any[]) : []);
const txt = (v: any) => v == null ? '' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v);

export function matrizAExcel(m: Matriz) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[m.titulo ?? 'Matriz de postulación'], [m.resumen ?? ''], ['Generada con el Experto FirmaVB · firmavb.cl', m.generada_en ?? '']]), 'Resumen');
  for (const s of SECCIONES) {
    const f = filas(m, s.clave); if (!f.length) continue;
    const ws = XLSX.utils.aoa_to_sheet([s.cols.map((c) => c[1]), ...f.map((r) => s.cols.map((c) => c[0] === 'estado' ? ESTADOS[r[c[0]]] ?? txt(r[c[0]]) : txt(r[c[0]])))]);
    ws['!cols'] = s.cols.map((c) => ({ wch: c[0] === 'estado' ? 12 : c[0] === 'fuente' || c[0] === 'plazo' || c[0] === 'ponderacion' ? 18 : 42 }));
    XLSX.utils.book_append_sheet(wb, ws, s.titulo.slice(0, 28).replace(/[\\/?*[\]:]/g, ' '));
  }
  XLSX.writeFile(wb, `${m.codigo ?? 'licitacion'}-matriz-postulacion.xlsx`);
}
export function matrizAMarkdown(m: Matriz): string {
  const out: string[] = [];
  if (m.resumen) out.push(m.resumen, '');
  for (const s of SECCIONES) {
    const f = filas(m, s.clave); if (!f.length) continue;
    out.push(`## ${s.titulo}`);
    for (const r of f) out.push('- ' + s.cols.map((c) => r[c[0]] != null && r[c[0]] !== '' ? `${c[1]}: ${c[0] === 'estado' ? ESTADOS[r[c[0]]] ?? txt(r[c[0]]) : txt(r[c[0]])}` : '').filter(Boolean).join(' · '));
    out.push('');
  }
  return out.join('\n');
}
export function matrizAWord(m: Matriz) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tablas = SECCIONES.map((s) => { const f = filas(m, s.clave); if (!f.length) return ''; return `<h2>${esc(s.titulo)}</h2><table border="1" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:10pt"><tr>${s.cols.map((c) => `<th style="background:#1b2540;color:#fff">${esc(c[1])}</th>`).join('')}</tr>${f.map((r) => `<tr>${s.cols.map((c) => `<td>${esc(c[0] === 'estado' ? ESTADOS[r[c[0]]] ?? txt(r[c[0]]) : txt(r[c[0]]))}</td>`).join('')}</tr>`).join('')}</table>`; }).join('');
  const html = `<html><head><meta charset="utf-8"><title>${esc(m.titulo ?? 'Matriz')}</title></head><body style="font-family:Arial,sans-serif"><h1 style="color:#1b2540">${esc(m.titulo ?? 'Matriz de postulación')}</h1><p>${esc(m.resumen ?? '')}</p>${tablas}<p style="color:#888;font-size:9pt">Generada con el Experto FirmaVB · firmavb.cl · no reemplaza la lectura de las bases.</p></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', html], { type: 'application/msword' })); a.download = `${m.codigo ?? 'licitacion'}-matriz-postulacion.doc`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export function MatrizPostulacion({ m, onChange, empresa, url }: { m: Matriz; onChange?: (m: Matriz) => void; empresa?: string | null; url?: string }) {
  const editable = !!onChange;
  const set = (k: keyof Matriz, i: number, campo: string, v: string) => { const f = filas(m, k).map((r, j) => j === i ? (campo === 'entrada' ? { ...r, entrada: v, estado: evaluarEntrada({ ...r, entrada: v }) } : { ...r, [campo]: v }) : r); onChange?.({ ...m, [k]: f }); };
  const pdf = async () => { const r = await compartirPdfExperto({ titulo: m.titulo ?? 'Matriz de postulación', empresa, contenido: matrizAMarkdown(m), url }, `${m.codigo ?? 'licitacion'}-matriz.pdf`); if (r === 'descargado') toast.success('PDF descargado'); };
  const total = filas(m, 'admisibilidad').length, ok = filas(m, 'admisibilidad').filter((r) => r.estado === 'cumple').length;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" variant="outline" onClick={() => matrizAExcelPro(m).catch(() => matrizAExcel(m))} title="Con fórmulas, listas desplegables y semáforo rojo/verde"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel con fórmulas</Button>
        <Button size="sm" variant="outline" onClick={() => matrizAWord(m)}><FileText className="h-3.5 w-3.5 mr-1" />Word</Button>
        <Button size="sm" variant="outline" onClick={pdf}><Printer className="h-3.5 w-3.5 mr-1" />PDF</Button>
        {total > 0 && <span className="ml-auto text-xs text-muted-foreground">Admisibilidad: {ok}/{total} cumplidos</span>}
      </div>
      {m.resumen && <p className="text-muted-foreground">{m.resumen}</p>}
      {SECCIONES.map((s) => { const f = filas(m, s.clave); if (!f.length) return null; return (
        <div key={s.clave}>
          <p className="font-semibold mb-1">{s.titulo}</p>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60"><tr>{s.cols.map((c) => <th key={c[0]} className="text-left px-2 py-1 font-medium whitespace-nowrap">{c[1]}</th>)}</tr></thead>
              <tbody>{f.map((r, i) => (
                <tr key={i} className="border-t align-top">{s.cols.map((c) => (
                  <td key={c[0]} className="px-2 py-1">
                    {c[0] === 'estado' ? (editable
                      ? <select value={r.estado ?? 'pendiente'} onChange={(e) => set(s.clave, i, 'estado', e.target.value)} className={`rounded px-1 py-0.5 text-xs ${colorEstado(r.estado)}`}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      : <span className={`rounded px-1.5 py-0.5 ${colorEstado(r.estado)}`}>{ESTADOS[r.estado] ?? txt(r.estado)}</span>)
                    : c[0] === 'nota' && editable ? <input value={txt(r.nota)} onChange={(e) => set(s.clave, i, 'nota', e.target.value)} className="w-full min-w-[160px] bg-transparent border-b border-dashed border-muted-foreground/40 focus:outline-none" placeholder="anota aquí" />
                    : c[0] === 'entrada' ? (editable
                      ? (r.chequeo?.tipo === 'si_no' || !r.chequeo?.tipo
                        ? <select value={txt(r.entrada)} onChange={(e) => set(s.clave, i, 'entrada', e.target.value)} className="rounded border bg-yellow-50 px-1 py-0.5 text-xs"><option value="">—</option><option value="SÍ">SÍ</option><option value="NO">NO</option></select>
                        : <input value={txt(r.entrada)} onChange={(e) => set(s.clave, i, 'entrada', e.target.value)} className="w-20 rounded border bg-yellow-50 px-1 py-0.5 text-xs" placeholder={r.chequeo?.unidad ?? 'valor'} title={r.chequeo?.umbral != null ? `Regla: ${r.chequeo.tipo} ${r.chequeo.umbral}${r.chequeo.umbral2 != null ? ' a ' + r.chequeo.umbral2 : ''} ${r.chequeo.unidad ?? ''}` : ''} />)
                      : <span>{txt(r.entrada)}</span>)
                    : <span className={c[0] === 'fuente' || c[0] === 'plazo' ? 'text-muted-foreground' : ''}>{txt(r[c[0]])}</span>}
                  </td>))}</tr>))}</tbody>
            </table>
          </div>
        </div>); })}
    </div>
  );
}
