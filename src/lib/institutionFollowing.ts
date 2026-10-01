export const institutionCategories = {
  licitaciones: 'Licitaciones y adjudicaciones',
  compras_agiles: 'Compras ágiles',
  noticias: 'Noticias',
  reclamos: 'Reclamos',
  ordenes_compra: 'Órdenes de compra',
  pago: 'Conducta de pago',
  rfi: 'Consultas al mercado (RFI)',
} as const;
export type InstitutionCategory = keyof typeof institutionCategories;
export interface InstitutionNotice {
  id: string;
  tipo: string;
  licitacion_id: string | null;
  datos: Record<string, unknown> | null;
}
export interface FollowedInstitution {
  id: string;
  cliente_id: string;
  rut_institucion: string;
  nombre_institucion: string | null;
  created_at: string;
}
export function noticeText(data: Record<string, unknown> | null, field: string): string {
  const value = data?.[field];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}
export function noticeInstitutionId(a: InstitutionNotice): string {
  return noticeText(a.datos, 'rut_institucion') || noticeText(a.datos, 'rut');
}
export function noticeCategory(a: InstitutionNotice): InstitutionCategory {
  if (a.tipo === 'medio_institucion') return 'noticias';
  if (a.tipo === 'reclamo_institucion') return 'reclamos';
  if (a.tipo === 'compras_institucion') return 'ordenes_compra';
  return a.datos?.tipo_oportunidad === 'compra_agil' ? 'compras_agiles' : 'licitaciones';
}
export function institutionPath(rut: string): string {
  return `/instituciones?${new URLSearchParams({ rut })}`;
}
export function noticeHref(a: InstitutionNotice): string | null {
  const rut = noticeInstitutionId(a);
  if (rut || a.tipo.endsWith('_institucion')) {
    const params = new URLSearchParams(rut ? { rut } : {});
    params.set('aviso', a.id);
    params.set('categoria', noticeCategory(a));
    return `/instituciones?${params}`;
  }
  if (!a.licitacion_id) return null;
  const tipo = a.datos?.tipo_oportunidad === 'compra_agil' ? 'compra_agil' : 'licitacion';
  return `/oportunidades/${tipo}/${encodeURIComponent(a.licitacion_id)}`;
}
/** Legacy notices had only a name. Never guess between homonyms or another tenant's follows. */
export function resolveNoticeInstitution<T extends Pick<FollowedInstitution, 'rut_institucion' | 'nombre_institucion'>>(a: InstitutionNotice, follows: T[]): T | null {
  const rut = noticeInstitutionId(a);
  const matches = rut
    ? follows.filter(f => f.rut_institucion === rut)
    : follows.filter(f => f.nombre_institucion === (noticeText(a.datos, 'organismo') || noticeText(a.datos, 'institucion')));
  return matches.length === 1 ? matches[0] : null;
}
export function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
