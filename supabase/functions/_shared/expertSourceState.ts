// Copyright © 2024-2026 Firma VB SpA. Todos los derechos reservados.
/** Source retrieval state, independent of the SDK, network and model. */
export type ExpertSourceStatus = 'ok' | 'empty' | 'error';
export type ExpertSourceState = {
  estado: ExpertSourceStatus;
  cantidad?: number;
  mensaje?: string;
  conocimiento?: 'desconocido';
};
export type ExpertSourceStates = Record<string, ExpertSourceState>;
export type ExpertQueryResult<T> = { data: T | null; error: unknown };
export type ExpertSourceResult<T> = { data: T | null; state: ExpertSourceState };

const SOURCE_ERROR: ExpertSourceState = {
  estado: 'error',
  conocimiento: 'desconocido',
  mensaje: 'No se pudo consultar esta fuente. Su contenido no es verificable en esta respuesta.',
};

function isEmpty(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0)
    || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
}

/** RPCs may resolve with { error } rather than throw. Never retain partial data on error. */
export async function readExpertSource<T, U = T>(
  operation: () => PromiseLike<ExpertQueryResult<T>>,
  project?: (data: T) => U | null | undefined,
): Promise<ExpertSourceResult<U>> {
  try {
    const result = await operation();
    if (!result || typeof result !== 'object' || !('data' in result) || result.error) return { data: null, state: { ...SOURCE_ERROR } };
    const data = result.data == null ? null : project ? project(result.data) : result.data as unknown as U;
    const empty = isEmpty(data);
    return { data: empty && !Array.isArray(data) ? null : data ?? null, state: { estado: empty ? 'empty' : 'ok', ...(Array.isArray(data) ? { cantidad: data.length } : {}) } };
  } catch {
    // Public metadata must never leak SQL, stack traces, identifiers or credentials.
    return { data: null, state: { ...SOURCE_ERROR } };
  }
}

const SOURCE_LABELS: Record<string, string> = {
  ficha: 'ficha de la licitación', bases: 'bases', anexos: 'anexos y adjuntos',
  panorama: 'antecedentes y panorama de la licitación', docs: 'documentos de trabajo',
  fragmentacion: 'compras relacionadas', patrones: 'patrones de compra',
  normOr: 'fuentes normativas', normAnd: 'fuentes normativas', normaOrg: 'fuentes del organismo',
  lic: 'licitaciones abiertas', ca: 'compras ágiles', comp: 'competencia', pan: 'panorama del mercado',
  adj: 'adjudicaciones', topadj: 'adjudicatarios del organismo', orgBusqueda: 'búsqueda del organismo',
  org: 'ficha del organismo', noticias: 'noticias', noticiasTema: 'noticias de la licitación',
  perfil: 'perfil del usuario', memoria: 'consultas anteriores', memoriaEvaristo: 'conversaciones recientes',
};

export function failedExpertSources(states: ExpertSourceStates): string[] {
  return Object.entries(states).filter(([, state]) => state.estado === 'error').map(([source]) => source);
}

export function expertSourceWarning(states: ExpertSourceStates): string {
  const labels = [...new Set(failedExpertSources(states).map(source => SOURCE_LABELS[source] ?? (/^tema\d+$/.test(source) ? 'fuentes normativas' : source)))];
  return labels.length
    ? `No pude consultar: ${labels.join('; ')}. Esa información queda desconocida y no verificable; el error no confirma que no exista.`
    : '';
}

export function hasDocumentSourceError(states: ExpertSourceStates): boolean {
  return ['ficha', 'bases', 'anexos', 'panorama', 'docs'].some(source => states[source]?.estado === 'error');
}

/** An incomplete read cannot support a substantive tender assessment, even if other reads worked. */
export function expertCriticalSourceReply(code: string | null, states: ExpertSourceStates): string | null {
  if (!code || !['ficha', 'bases', 'anexos'].some(source => states[source]?.estado === 'error')) return null;
  return `No pude verificar la documentación de la licitación ${code}. ${expertSourceWarning(states)}\n\nNo puedo confirmar sus requisitos, garantías ni que la documentación esté completa. Vuelve a intentar la consulta antes de decidir si postulas.`;
}

export const EXPERT_MISSING_SUMMARY_RULE = 'Un dato marcado como «no indicado» o «ninguno indicado» solo significa que no se identificó en el resumen disponible; no demuestra que no se exija ni que no figure en las bases. Confírmalo en la cláusula o numeral del documento original; si no está en los extractos, indica que no es verificable con el material disponible.';

/** A support-only evidence requirement avoids model cost when the consumer cannot accept an answer. */
export function expertRequiredDocumentReply(
  code: string | null,
  requirement: 'requirements' | 'commercial_terms' | 'forum' | undefined,
  bases: Array<{ archivo?: unknown }>,
  anexos: Array<{ archivo?: unknown }>,
): string | null {
  if (!code || !requirement) return null;
  const documents = [...bases, ...anexos];
  if (requirement === 'forum' && !documents.some(document =>
    /respuestas?|aclaracion(?:es)?|consultas?|foro/.test(String(document.archivo ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()))) {
    return `No pude verificar las respuestas oficiales de ${code} en los documentos recuperados. Un foro vacío no demuestra que no existan: falta revisar el adjunto o resolución de respuestas y su fecha, sin limitarse a esperar.`;
  }
  if (!documents.length) {
    return `La consulta de ${code} no recuperó bases ni anexos. No puedo confirmar sus requisitos ni qué valores seleccionar con esta información. Sube los documentos oficiales con el botón "Subir bases (PDF)" o revísalos en el Libro antes de preparar la oferta. No uses precios ni stock ficticios.`;
  }
  return null;
}
