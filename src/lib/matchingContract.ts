import { validateSpecifications, UMBRAL_MATCH } from '@/services/fuzzyMatching';

export const SUGGESTION_FLOOR = 40;
export function similarityScore(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}
export function requestedQuantity(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}
export function knownUnit(value: unknown): boolean {
  const units = new Set(['ea','un','und','unid','c62','pz','pce','bx','cj','bg','pk','pac','pa','set','kit','res','rm','kg','gr','g','lt','l','ml','mt','m','cm','mm','m2','m3','doc','dz','rol','rl','tam','gl','unidad','unidades','caja','cajas','bolsa','bolsas','paquete','paquetes','resma','resmas','rollo','rollos','hora','horas','servicio','servicios','mes','meses','día','dias','días','litro','litros','metro','metros','kilogramo','kilogramos']);
  return typeof value === 'string' && units.has(value.trim().toLowerCase());
}
export interface MatchInput {
  requested: { nombre: string; descripcion?: string; cantidad?: unknown; unidad?: unknown };
  product?: { nombre_producto: string; descripcion?: string | null } | null;
  score?: unknown;
  selectedByUser?: boolean;
  discarded?: boolean;
  exceedsBudget?: boolean;
}
export function assessMatch(input: MatchInput) {
  const score = similarityScore(input.score);
  const quantity = requestedQuantity(input.requested.cantidad);
  const quantityKnown = quantity !== null && knownUnit(input.requested.unidad);
  const specification = (input.requested.descripcion || input.requested.nombre).trim();
  const specificationsKnown = !!specification && !/(?:ver|seg[uú]n|revisar|consultar).*(?:adjunt|document|anexo|bases)|(?:detalle|especificaciones).*adjunt/i.test(specification);
  const penalty = input.product ? validateSpecifications({ id: 'assessment', nombre: input.requested.nombre, descripcion: input.requested.descripcion }, {nombre_producto:input.product.nombre_producto, descripcion:input.product.descripcion ?? null}) : 0;
  const compatibility: 'incompatible' | 'unknown' | 'no_detected_conflict' = penalty < 0 ? 'incompatible' : !input.product || !specificationsKnown ? 'unknown' : 'no_detected_conflict';
  const reasons: string[] = [];
  if (!quantityKnown) reasons.push('Cantidad o unidad por confirmar');
  if (!specificationsKnown) reasons.push('Especificaciones pendientes: leer el documento adjunto');
  if (penalty < 0) reasons.push('Especificaciones incompatibles o ambiguas');
  if (input.exceedsBudget) reasons.push('Advertencia comercial: subtotal supera el presupuesto; revisar bases');
  const suggested = !!input.product && !input.discarded && (input.selectedByUser || (score ?? 0) >= SUGGESTION_FLOOR);
  const technicallyEligible = suggested && quantityKnown && compatibility === 'no_detected_conflict' && (input.selectedByUser || (score ?? 0) >= UMBRAL_MATCH);
  const selected = technicallyEligible && !!input.selectedByUser;
  const state = !suggested ? 'Sin producto' : selected ? 'Seleccionado por ti' : technicallyEligible ? 'Sugerencia alta: confirmar' : 'Revisar';
  return { score, suggested, technicallyEligible, selected, state, reasons, quantity, quantityKnown, compatibility, documents: 'not_verified' as const, compliance: 'unknown' as const };
}
export function suggestionCoverage(matchedIds: Iterable<string>, requestedIds: Iterable<string>) {
  const requested = new Set(requestedIds);
  const suggested = new Set([...matchedIds].filter(id => requested.has(id)));
  return { suggested: suggested.size, total: requested.size, percentage: requested.size ? Math.round(suggested.size / requested.size * 100) : null };
}
