/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. */
import { evidenceRequiredReply, INCOMPLETE_REPLY, isIncompleteReply, normalizeTenderCode, type SupportIntent } from './evaristoSafety.ts';

export type SupportSource = { n: number; fuente: string; seccion: string | null; url: string | null };
export type SupportSourceStates = Record<string, { estado: 'ok' | 'empty' | 'error'; cantidad?: number }>;
export type ExpertSupportResult = {
  reply: string;
  status: 'answered_with_sources' | 'needs_evidence' | 'access_denied' | 'incomplete';
  httpStatus: number;
  upstreamStatus: number | null;
  sources: SupportSource[];
  sourceStates: SupportSourceStates;
  model: string | null;
  finishReason: string | null;
};
type Input = {
  baseUrl: string; anonKey: string; authorization: string; code: string;
  question: string; intent: Exclude<SupportIntent, 'interface' | null>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  fetchImpl: typeof fetch; requestHeaders?: Headers; timeoutMs?: number;
};
const clean = (value: unknown, length: number) => typeof value === 'string' ? value.slice(0, length) : '';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function publicSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
    }
    if (/\/storage\/v1\/object\/(?:sign|authenticated)\//i.test(url.pathname)) return null;
    const sensitive = /^(?:x-amz-|x-goog-)|(?:token|signature|credential|password|secret)|^(?:sig|key|api_?key|authorization|auth|jwt|awsaccesskeyid|googleaccessid|key-pair-id|policy)$/i;
    if ([...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some(key => sensitive.test(key))) return null;
    return url.href;
  } catch { return null; }
}

function sourcesFrom(value: unknown): SupportSource[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<number>();
  return value.slice(0, 64).flatMap(source => {
    const n = source?.n;
    const fuente = clean(source?.fuente, 400).trim();
    if (!Number.isInteger(n) || n < 1 || n > 1000 || !fuente || used.has(n)) return [];
    used.add(n);
    return [{ n, fuente, seccion: clean(source.seccion, 600) || null, url: publicSourceUrl(source.url) }];
  });
}

function statesFrom(value: unknown): SupportSourceStates {
  const states: SupportSourceStates = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return states;
  for (const [name, state] of Object.entries(value).slice(0, 40)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(name) || name === 'constructor' || name === '__proto__') continue;
    if (!state || typeof state !== 'object' || !('estado' in state)) continue;
    const estado = state.estado;
    if (estado === 'ok' || estado === 'empty' || estado === 'error') {
      const cantidad = 'cantidad' in state && typeof state.cantidad === 'number' && Number.isInteger(state.cantidad) && state.cantidad >= 0 ? state.cantidad : undefined;
      states[name] = { estado, ...(cantidad === undefined ? {} : { cantidad }) };
    }
  }
  return states;
}

/** Reuses the existing endpoint, JWT, plan and quota. It never calls a model or uses service_role. */
export async function consultExpertForSupport(input: Input): Promise<ExpertSupportResult> {
  const safe: ExpertSupportResult = {
    reply: evidenceRequiredReply(input.intent, input.code), status: 'needs_evidence', httpStatus: 200,
    upstreamStatus: null, sources: [], sourceStates: {}, model: null, finishReason: null,
  };
  if (!normalizeTenderCode(input.code) || !/^Bearer\s+\S+$/i.test(input.authorization)) return safe;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('expert_timeout')); }, input.timeoutMs ?? 25000);
  });
  try {
    return await Promise.race([timeout, (async (): Promise<ExpertSupportResult> => {
      const endpoint = new URL('/functions/v1/experto-consultar', input.baseUrl);
      if (endpoint.protocol !== 'https:') return safe;
      const headers: Record<string, string> = { Authorization: input.authorization, apikey: input.anonKey, 'Content-Type': 'application/json' };
      // Executed in-process: preserve the existing trusted gateway headers and IP quota.
      for (const name of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']) {
        const value = input.requestHeaders?.get(name);
        if (value) headers[name] = value;
      }
      const response = await input.fetchImpl(endpoint.href, {
        method: 'POST', signal: controller.signal,
        headers,
        body: JSON.stringify({
          modo: 'chat', codigo: input.code, pregunta: input.question.slice(0, 8000),
          // Old assistant replies may contain the very unsupported claim being repaired.
          historial: input.history.filter(turn => turn.role === 'user' && turn.content !== input.question).slice(-3)
            .map(turn => ({ role: 'user', content: turn.content.slice(0, 2000) })),
        }),
      });
      safe.upstreamStatus = response.status;
      if ([401, 402, 403, 429].includes(response.status)) {
        const denial = response.status === 401 ? 'Tu sesión no permite consultar el Experto. Vuelve a iniciar sesión y reintenta.'
          : response.status === 403 ? 'Tu cuenta no tiene permiso para consultar esta información. Pide al equipo que revise el acceso de tu empresa.'
          : response.status === 429 ? 'Se alcanzó el límite de consultas seguidas. Espera antes de reintentar; no intentaré saltar ese límite.'
          : 'El Experto alcanzó el límite disponible de tu plan. No se generó otra respuesta ni se cambió tu plan. Puedes pedir al equipo que revise el caso.';
        return { ...safe, status: 'access_denied', httpStatus: response.status, reply: denial };
      }
      if (response.status === 503) {
        try {
          const detail = await response.json();
          if (detail?.error === 'cuota_no_disponible') return { ...safe, status: 'access_denied', httpStatus: 503,
            reply: 'No pude verificar el cupo de tu cuenta. La consulta se detuvo antes de usar IA; esto no significa que necesites cambiar de plan. Reintenta o pide al equipo que revise el acceso.' };
        } catch { /* No raw upstream detail is exposed. */ }
      }
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) return safe;
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '', answer = '', bytes = 0, doneEvent = false, failed = false;
      let meta: Record<string, unknown> | null = null;
      const event = (line: string) => {
        if (!line.startsWith('data:')) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') return;
        try {
          const item = JSON.parse(raw);
          if (doneEvent) failed = true;
          if (item.meta) { if (meta) failed = true; else meta = item.meta; }
          if (typeof item.delta === 'string') answer += item.delta;
          if (typeof item.finish === 'string') safe.finishReason = item.finish;
          if (item.error) failed = true;
          if (item.done === true) doneEvent = true;
        } catch { failed = true; }
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 512000) return { ...safe, reply: INCOMPLETE_REPLY, status: 'incomplete' };
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
        for (const line of lines) event(line.trimEnd());
        if (answer.length > 30000) return { ...safe, reply: INCOMPLETE_REPLY, status: 'incomplete' };
      }
      buffer += decoder.decode();
      if (buffer.trim()) event(buffer.trimEnd());
      // Assignment inside the event callback is not tracked by TS control-flow analysis.
      const metadata = meta as Record<string, unknown> | null;
      if (!metadata || normalizeTenderCode(metadata.codigo) !== input.code) return safe;
      safe.sources = sourcesFrom(metadata.fuentes);
      safe.sourceStates = statesFrom(metadata.estados_fuentes);
      safe.model = clean(metadata.modelo, 100) || null;
      safe.reply = input.intent === 'forum'
        ? `No pude verificar las respuestas oficiales de ${input.code} en los documentos recuperados. Un foro vacío no demuestra que no existan: falta revisar el adjunto o resolución de respuestas y su fecha, sin limitarse a esperar.`
        : `Consulté la documentación disponible de ${input.code}, pero no obtuve una respuesta con citas suficientes para esta pregunta. No puedo confirmar requisitos ni qué seleccionar. No uses precios o stock ficticios. Puedes revisar los documentos en el Libro o pedir al equipo que revise esta consulta.`;
      if (!doneEvent || failed || isIncompleteReply(safe.finishReason, answer) || safe.finishReason !== 'stop') {
        return { ...safe, reply: INCOMPLETE_REPLY, status: 'incomplete' };
      }
      const critical = ['ficha', 'bases', 'anexos'];
      if (critical.some(name => !safe.sourceStates[name] || safe.sourceStates[name].estado === 'error')) {
        return { ...safe, reply: `No pude verificar la documentación de ${input.code}. Una fuente falló o no informó su estado; eso no demuestra que falten documentos. Puedes reintentar o pedir al equipo que revise el caso.` };
      }
      const citedNumbers = [...answer.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]));
      const documentSources = safe.sources.filter(source => {
        const name = normalize(source.fuente);
        return source.fuente.includes(input.code) && (
          (name.startsWith('bases de la licitacion') && safe.sourceStates.bases.estado === 'ok')
          || (name.startsWith('anexo/adjunto de la licitacion') && safe.sourceStates.anexos.estado === 'ok')
        );
      });
      const eligible = input.intent === 'forum'
        ? documentSources.filter(source => /respuestas?|aclaracion(?:es)?|consultas?|foro/.test(normalize(source.fuente))) : documentSources;
      if (!answer.trim() || !eligible.some(source => citedNumbers.includes(source.n)) || citedNumbers.some(n => !safe.sources.some(source => source.n === n))) return safe;
      // Evidence permits clause-specific explanations, never invented values to force an offer through.
      if (/(?:pon|asigna|ingresa|usa|coloca|rellena).{0,60}(?:stock simbolico|stock ficticio|precio simbolico|precio ficticio)|(?:pon|asigna|ingresa|usa|coloca).{0,60}stock.{0,20}\b[01]\b|(?:pon|asigna|ingresa|usa|coloca).{0,60}(?:\$\s*[01]\b|precio.{0,15}\b[01]\b)/.test(normalize(answer))) return safe;
      return { ...safe, reply: answer.trim(), status: 'answered_with_sources' };
    })()]);
  } catch { return safe; }
  finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    if (reader) { try { await reader.cancel(); } catch { /* no payload or credentials logged */ } }
  }
}
