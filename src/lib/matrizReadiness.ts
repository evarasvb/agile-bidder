/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { admisibilidadResuelta, evaluarPuntaje, numeroMatriz, type EvaluationCriterion, type Requirement } from './matrizValidation';

export interface MatrixReview {
  codigo?: string;
  generada_en?: string;
  umbral_adjudicacion?: unknown;
  admisibilidad?: Requirement[];
  evaluacion?: EvaluationCriterion[];
  aprobacion?: { por?: string; en?: string; revision?: string };
}
export interface ReviewSource { id?: unknown; archivo?: unknown; nombre?: unknown; creado_en?: unknown }
export interface ReviewContext {
  codigo: string;
  matriz: MatrixReview | null;
  bases: ReviewSource[];
  documentos?: ReviewSource[];
  cierre?: unknown;
  informe?: string;
  anexos?: string;
  faltantes?: string[];
}
export const mismoCodigoMatriz = (a: unknown, b: unknown): boolean => typeof a === 'string' && typeof b === 'string' && !!a.trim() && a.trim().toUpperCase() === b.trim().toUpperCase();
export function timestampMatriz(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : null;
}
const rows = <T>(value: T[] | undefined): T[] => Array.isArray(value) ? value.map(r => r != null && typeof r === 'object' && !Array.isArray(r) ? r : {} as T) : [];
const sourceSnapshot = (sources: ReviewSource[]) => sources.map(s => [s.id, s.archivo ?? s.nombre, s.creado_en]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}

// Exact content snapshot, not a security credential. Old approvals without it
// remain visible as historical reviews, but cannot approve a changed package.
export function revisionPostulacion(p: ReviewContext): string {
  const { aprobacion: _approval, ...matrix } = p.matriz ?? {};
  return JSON.stringify(canonical([p.codigo.trim().toUpperCase(), matrix, sourceSnapshot(p.bases), sourceSnapshot(p.documentos ?? []), p.cierre, p.informe, p.anexos, p.faltantes ?? []]));
}

export function sinAprobacion<T extends MatrixReview>(matrix: T): T {
  const { aprobacion: _approval, ...rest } = matrix;
  return rest as T;
}

export function evaluarPreparacion(p: ReviewContext, now = Date.now()) {
  const matrix = p.matriz;
  const adm = rows(matrix?.admisibilidad), evaluation = rows(matrix?.evaluacion);
  const sources = [...p.bases, ...(p.documentos ?? [])];
  const generated = timestampMatriz(matrix?.generada_en);
  const sourceTimes = sources.map(s => timestampMatriz(s.creado_en));
  const sourcesDated = p.bases.length > 0 && sourceTimes.every(t => t != null && t <= now);
  const newest = Math.max(0, ...sourceTimes.filter((t): t is number => t != null));
  const code = p.codigo.trim().toUpperCase();
  const foreignSource = [...p.bases.map(b => b.archivo), ...adm.map(r => r.fuente), ...evaluation.map(r => r.fuente)]
    .some(value => (String(value ?? '').toUpperCase().match(/\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}/g) ?? []).some(found => found !== code));
  const sameTender = mismoCodigoMatriz(matrix?.codigo, code) && !foreignSource;
  const fresh = !!matrix && sameTender && sourcesDated && generated != null && generated >= newest && generated <= now;
  const score = evaluarPuntaje(evaluation);
  const rawThreshold = matrix?.umbral_adjudicacion;
  const parsedThreshold = numeroMatriz(rawThreshold);
  const thresholdValid = rawThreshold == null || rawThreshold === '' || (parsedThreshold != null && parsedThreshold >= 0);
  const admissible = fresh && adm.length > 0 && adm.every(admisibilidadResuelta);
  const close = timestampMatriz(p.cierre);
  const open = close != null && close > now;
  const approved = timestampMatriz(matrix?.aprobacion?.en);
  const approvalCurrent = fresh && approved != null && approved >= generated! && approved <= now
    && matrix?.aprobacion?.revision === revisionPostulacion(p);
  const warnings: string[] = [];
  if (matrix && !sameTender) warnings.push('La matriz o una fuente identifica otra licitación. Revisa las fuentes antes de continuar.');
  if (!p.bases.length) warnings.push('Faltan las bases de esta licitación.');
  else if (!sourcesDated) warnings.push('No se pudo comprobar la fecha de todas las fuentes.');
  if (matrix && (generated == null || generated > now || generated < newest)) warnings.push('La matriz no acredita una generación posterior a las fuentes actuales. Vuelve a revisarla con las bases vigentes.');
  if (matrix && !adm.length) warnings.push('La matriz no contiene requisitos de admisibilidad.');
  if (matrix && !score.complete) warnings.push('Faltan criterios, fuentes, ponderaciones o puntajes válidos. No hay un puntaje completo.');
  if (!thresholdValid) warnings.push('El umbral de adjudicación requiere revisión: debe ser un número válido, mayor o igual a cero.');
  if (!open) warnings.push(close == null ? 'Falta una fecha de cierre válida y verificable.' : 'El plazo para postular ya cerró.');
  if (matrix?.aprobacion && !approvalCurrent) warnings.push('La aprobación anterior no corresponde a esta versión completa. Revisa y aprueba nuevamente.');
  return { fresh, sameTender, admissible, score, thresholdValid, open, approvalCurrent, warnings };
}
