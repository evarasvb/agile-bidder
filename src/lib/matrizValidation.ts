/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
export interface Requirement {
  requisito?: unknown;
  regla?: unknown;
  condicion?: unknown;
  entrada?: unknown;
  estado?: string;
  fuente?: unknown;
  nota?: unknown;
  revision_manual?: string;
  chequeo?: { tipo?: unknown; esperado?: unknown; umbral?: unknown; umbral2?: unknown };
}

// Do not discard letters, units, or punctuation: doing so turned unknown values
// into zero and changed 0.001 into 1. Ambiguous thousands/decimal notation needs review.
export function numeroMatriz(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || !/^-?\d+(?:[.,]\d+)*$/.test(text)) return null;
  let normalized = text;
  if (/^-?\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) normalized = text.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) normalized = text.replace(/,/g, '');
  else if (/^-?\d{1,3}(?:\.\d{3}){2,}$/.test(text)) normalized = text.replace(/\./g, '');
  else if (/^-?\d{1,3}(?:,\d{3}){2,}$/.test(text)) normalized = text.replace(/,/g, '');
  else if (/^-?\d+(?:[.,]\d+)?$/.test(text)) {
    if (/^-?[1-9]\d{0,2}[.,]\d{3}$/.test(text)) return null;
    normalized = text.replace(',', '.');
  } else return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const yesNo = (v: unknown) => /^s[ií]$/i.test(String(v ?? '').trim()) ? 'SI' : /^no$/i.test(String(v ?? '').trim()) ? 'NO' : null;
export const fuenteIdentificada = (v: unknown): boolean => typeof v === 'string' && !!v.trim()
  && !/^(s\/?i|n\/?a|sin (fuente|datos)|no (informad[oa]|indicad[oa]|disponible)|revisar(?: en bases)?)\.?$/i.test(v.trim());

export function evaluarEntrada(r: Requirement): string {
  if (!r || typeof r !== 'object') return 'revisar';
  if (r.entrada == null || String(r.entrada).trim() === '') return 'pendiente';
  const ch = r.chequeo;
  if (!ch) return 'revisar';
  if (ch.tipo === 'si_no') {
    const expected = yesNo(ch.esperado), actual = yesNo(r.entrada);
    return !expected || !actual ? 'revisar' : actual === expected ? 'cumple' : 'no_cumple';
  }
  const n = numeroMatriz(r.entrada), low = numeroMatriz(ch.umbral), high = numeroMatriz(ch.umbral2);
  if (n == null || low == null) return 'revisar';
  if (ch.tipo === 'minimo') return n >= low ? 'cumple' : 'no_cumple';
  if (ch.tipo === 'maximo') return n <= low ? 'cumple' : 'no_cumple';
  if (ch.tipo === 'rango') return high == null || low > high ? 'revisar' : n >= low && n <= high ? 'cumple' : 'no_cumple';
  return 'revisar';
}

function revisionRequirement(r: Requirement): string {
  const ch = r.chequeo;
  return JSON.stringify([r.requisito, r.regla, r.condicion, r.entrada, r.estado, r.fuente, r.nota,
    ch?.tipo, ch?.esperado, ch?.umbral, ch?.umbral2]);
}

// An explicit review can resolve textual/conditional rules, but never silently
// survives a change to the input, rule, source, or note that the user reviewed.
export function revisarRequisito<T extends Requirement>(r: T, estado: string): T {
  const updated = { ...r, estado };
  return { ...updated, revision_manual: revisionRequirement(updated) };
}

export function revisionManualVigente(r: Requirement): string | null {
  return fuenteIdentificada(r.fuente) && r.revision_manual === revisionRequirement(r)
    && ['cumple', 'ok', 'no_aplica', 'solo_si_adjudica', 'no_cumple'].includes(r.estado ?? '') ? r.estado! : null;
}

export function estadoAdmisibilidad(r: Requirement): string {
  if (!r || typeof r !== 'object') return 'revisar';
  if (r.estado === 'no_cumple') return 'no_cumple';
  if (!fuenteIdentificada(r.fuente)) return 'revisar';
  const manual = revisionManualVigente(r);
  if (manual) return manual;
  if (r.estado === 'cumple' || r.estado === 'ok') return evaluarEntrada(r);
  return ['pendiente', 'revisar', 'verificar'].includes(r.estado ?? '') ? r.estado! : 'revisar';
}

export const admisibilidadResuelta = (r: Requirement): boolean => ['cumple', 'ok', 'no_aplica', 'solo_si_adjudica'].includes(estadoAdmisibilidad(r));

export interface EvaluationCriterion { criterio?: unknown; fuente?: unknown; ponderacion?: unknown; ponderacion_num?: unknown; puntaje_max?: unknown; puntaje_max_num?: unknown; puntaje_estimado?: unknown }
export function ponderacionMatriz(r: EvaluationCriterion): number | null {
  const explicitPercent = typeof r.ponderacion === 'string' && /^\s*-?\d+(?:[.,]\d+)?\s*%\s*$/.test(r.ponderacion);
  const n = numeroMatriz(r.ponderacion_num ?? (explicitPercent ? String(r.ponderacion).replace('%', '').trim() : r.ponderacion));
  if (n == null || n <= 0 || n > 100) return null;
  return (r.ponderacion_num == null && explicitPercent) || n > 1 ? n / 100 : n;
}

export function evaluarPuntaje(rows: EvaluationCriterion[]) {
  let total = 0, weights = 0;
  let complete = rows.length > 0;
  for (const row of rows) {
    const r = row ?? {};
    const w = ponderacionMatriz(r), max = numeroMatriz(r.puntaje_max_num ?? r.puntaje_max), score = numeroMatriz(r.puntaje_estimado);
    if (!fuenteIdentificada(r.fuente) || !String(r.criterio ?? '').trim() || w == null || max == null || max <= 0 || score == null || score < 0 || score > max) complete = false;
    if (w != null) weights += w;
    if (w != null && score != null) total += w * score;
  }
  complete = complete && Math.abs(weights - 1) < 0.000001;
  return { complete, total: complete ? total : null };
}
