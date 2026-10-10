/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */

/** Pure safeguards shared by the support handler and its regression tests. */
export type SupportIntent = 'forum' | 'commercial_terms' | 'requirements' | 'interface' | null;
export type SupportStatus = 'ok' | 'needs_evidence' | 'clarification' | 'incomplete' | 'model_error' | 'action_only' | 'answered_with_sources' | 'access_denied';
const CODE = /^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/i;
const CODES = /\b\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}\b/gi;
const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const PURCHASE_AGILE_LIMIT_UTM = 100;
export const PURCHASE_AGILE_RULE_SOURCE = 'https://www.chilecompra.cl/compra-agil-proveedor/';

export function normalizeTenderCode(value: unknown): string | null {
  return typeof value === 'string' && CODE.test(value.trim()) ? value.trim().toUpperCase() : null;
}

export function resolveActiveTender(input: {
  message: string; routeCode?: unknown; storedCode?: unknown; clientHint?: unknown;
}): { code: string | null; ambiguous: boolean; source: 'message' | 'route' | 'conversation' | 'hint' | null } {
  const explicit = [...new Set((input.message.match(CODES) ?? []).map((code) => code.toUpperCase()))];
  if (explicit.length > 1) return { code: normalizeTenderCode(input.storedCode), ambiguous: true, source: 'conversation' };
  if (explicit.length === 1) return { code: explicit[0], ambiguous: false, source: 'message' };
  for (const [source, value] of [['route', input.routeCode], ['conversation', input.storedCode], ['hint', input.clientHint]] as const) {
    const code = normalizeTenderCode(value);
    if (code) return { code, ambiguous: false, source };
  }
  return { code: null, ambiguous: false, source: null };
}

export function classifySupportIntent(question: string, previousQuestion = ''): SupportIntent {
  const current = normalize(question).replace(/^[¿¡\s]+/, '');
  // Short follow-ups such as “¿no marco nada?” inherit the prior user's question,
  // never a factual claim invented by a previous assistant response.
  const shortFollowup = current.split(/\s+/).length <= 7 && /^(si|no|y |entonces|que |cual|como|eso|aca|ahi|lo |la |el |este|esta|marco|selecciono)/.test(current);
  const text = shortFollowup ? `${normalize(previousQuestion)} ${current}` : current;
  if (/inventario/.test(text) && /cargar|importar|editar|actualizar|modificar|como|donde/.test(text) && !/convenio|oferta|postular|simbolic|fictic|referencial/.test(text)) return null;
  if (/\bforo\b|publicacion de respuestas|respuestas (del|de la) (licitacion|convenio)/.test(text)) return 'forum';
  if (/condiciones (por producto|comerciales)|stock|precio (referencial|simbolico)|productos? (a|en|por) \$?\s*[01]\b|(?:convenio marco|\bcm\b).*(servicio|precio|producto)|servicios?.*(convenio marco|\bcm\b)/.test(text)) return 'commercial_terms';
  if (/boton.*(particip|manito|interes)|(?:participar|manifestar interes).*(boton|manito)|donde.*sub[io]r.*document/.test(text)) return 'interface';
  if (/admisib|inhabil|garanti[az]|que (?:documentos?|requisitos?|anexos?)|documentos?.*(necesit|obligatori|postular|inscrib)|(?:como|puedo|debo).*postular|que (?:marco|selecciono)|no marco nada|(?:cual|cuales).*(?:selecciono|marco)|bases.*(?:exig|pide|requisit)|(?:certificado|anexo).*(necesit|obligatori|exig)/.test(text)) return 'requirements';
  return null;
}

export function evidenceRequiredReply(intent: Exclude<SupportIntent, null>, code: string | null): string {
  const process = code ? ` para ${code}` : '';
  const book = code ? ` [Revisar documentos en el Libro](/experto/libro/${code}).` : ' ¿Cuál es el código del proceso?';
  const access = ' Si el Libro te limita por tu plan, usa «¿Prefieres que te contacte el equipo?» abajo; conserva esta consulta para revisar el caso.';
  if (intent === 'forum') return `Que el foro esté vacío no permite saber si faltan respuestas oficiales${process}. Hay que revisar la fecha de publicación y los adjuntos o resolución de respuestas; si la fecha ya pasó, no basta con esperar. Este chat no ha verificado esos documentos.${book} Si están bloqueados, puedes compartir el documento oficial o una captura de la fecha y el listado de adjuntos.`;
  if (intent === 'commercial_terms') return `No uses precios ni stock ficticios para completar campos${process}. Debemos verificar en las bases la relación entre productos y servicios, qué debes seleccionar y cómo declarar las condiciones comerciales. Este chat no ha consultado esas cláusulas y no puede validar la selección.${book}${access}`;
  if (intent === 'interface') return `No puedo confirmar qué hace ese botón ni dónde se adjunta la oferta${process} sin identificar la pantalla. «Participar» y «Manifestar interés» no deben tratarse como equivalentes sin verificarlo. Mándame una captura con el título y los campos visibles; no incluyas claves ni datos sensibles.`;
  return `Los documentos y requisitos${process} dependen de sus bases y modificaciones. Este chat no ha consultado esas cláusulas: no voy a presentar una lista genérica como obligatoria.${book}${access}`;
}

export function containsUnsupportedAdvice(reply: string): boolean {
  const text = normalize(reply);
  return /(?:pon|asigna|ingresa|usa|coloca|rellena|completa).{0,100}(?:stock simbolico|stock ficticio|precio simbolico|precio referencial|\$\s*[01]\b)|stock simbolico|(?:pon|asigna|ingresa|usa|coloca).{0,70}stock.{0,20}\b[01]\b|(?:he |ya )?(?:leido|lei|revisado|revise|analizado|analice|consultado|consulte) (?:las )?bases|(?:las )?bases.{0,40}(?:exigen|requieren|establecen|indican|obligan)|(?:participar|manifestar interes).{0,80}(?:obligatorio|habilita|no te va a dejar)/.test(text);
}

export function isIncompleteReply(finishReason: unknown, reply: string): boolean {
  if (finishReason === 'length' || finishReason === 'max_tokens' || finishReason === 'content_filter') return true;
  // Detect clearly dangling connectors even when a provider omits finish_reason.
  return /\b(?:o en|o el|o la|y en|y el|y la|para que|sino que)\s*$/i.test(reply.trim());
}

export const INCOMPLETE_REPLY = 'La respuesta quedó incompleta y no la usaré para indicarte qué completar o enviar. Puedes reintentar o pedir que el equipo revise el caso con el botón de abajo.';
