export const SAGA_BUNDLE_SLUG = 'saga-completa-7x1';

export const SAGA_COURSE_SLUGS = [
  'saga-1-fundamentos',
  'saga-2-oportunidades',
  'saga-3-ofertas',
  'saga-4-ganar',
  'saga-5-ejecutar',
  'saga-6-escalar',
  'saga-7-automatizacion',
] as const;

export interface AcademyProduct {
  slug: string;
  title: string;
  amount: number;
  courseSlugs: readonly string[];
  returnPath: string;
}

const individualProduct = (
  slug: string,
  title: string,
  amount: number,
): AcademyProduct => ({
  slug,
  title,
  amount,
  courseSlugs: [slug],
  returnPath: `/academia/curso/${slug}`,
});

export const ACADEMY_PRODUCTS: Readonly<Record<string, AcademyProduct>> = {
  'programa-pro-adjudica-al-estado': individualProduct(
    'programa-pro-adjudica-al-estado',
    'Programa Pro: Estudia y Gana Licitaciones',
    45_000,
  ),
  'iniciar-en-mercado-publico': individualProduct(
    'iniciar-en-mercado-publico',
    'Inicia en Mercado Público (Express)',
    5_000,
  ),
  'saga-1-fundamentos': individualProduct(
    'saga-1-fundamentos',
    'Saga 1 · Fundamentos del Sistema',
    45_000,
  ),
  'saga-2-oportunidades': individualProduct(
    'saga-2-oportunidades',
    'Saga 2 · Oportunidades',
    45_000,
  ),
  'saga-3-ofertas': individualProduct(
    'saga-3-ofertas',
    'Saga 3 · Ofertas',
    45_000,
  ),
  'saga-4-ganar': individualProduct(
    'saga-4-ganar',
    'Saga 4 · Ganar',
    45_000,
  ),
  'saga-5-ejecutar': individualProduct(
    'saga-5-ejecutar',
    'Saga 5 · Ejecutar',
    45_000,
  ),
  'saga-6-escalar': individualProduct(
    'saga-6-escalar',
    'Saga 6 · Escalar',
    45_000,
  ),
  'saga-7-automatizacion': individualProduct(
    'saga-7-automatizacion',
    'Saga 7 · Automatización',
    45_000,
  ),
  [SAGA_BUNDLE_SLUG]: {
    slug: SAGA_BUNDLE_SLUG,
    title: 'Saga Completa 7x1',
    amount: 250_000,
    courseSlugs: SAGA_COURSE_SLUGS,
    returnPath: '/academia',
  },
};

export function getAcademyProduct(slug: string): AcademyProduct | undefined {
  return ACADEMY_PRODUCTS[slug];
}
