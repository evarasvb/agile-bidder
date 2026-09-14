export const STATUS_BY_CODE: Readonly<Record<number, string>> = {
  5: 'Publicada', 6: 'Cerrada', 7: 'Desierta', 8: 'Adjudicada',
  18: 'Revocada', 19: 'Suspendida',
};
export const SCAN_LIMIT = 40;
export const REQUEST_LIMIT = 10;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CODE_PATTERN = /^\d{1,7}-\d{1,6}-[A-Z]{1,3}\d{2,3}$/;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface Candidate {
  id: string;
  codigo: string;
  estado: string | null;
  codigo_estado: number | null;
  fecha_cierre: string | null;
  updated_at: string | null;
  raw_data: unknown;
}
export interface StatusPatch {
  estado?: string;
  codigo_estado?: number;
  raw_data: Record<string, unknown>;
  updated_at: string;
}
export interface ReconcilePorts {
  load: () => Promise<Candidate[]>;
  // Must compare updated_at with the loaded snapshot before writing.
  save: (row: Candidate, patch: StatusPatch) => Promise<boolean>;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

function lastAttempt(row: Candidate): number {
  const meta = object(row.raw_data) ? row.raw_data._firmavb_estado : null;
  return object(meta) && typeof meta.intentado_en === 'string' ? Date.parse(meta.intentado_en) : NaN;
}

export async function reconcileStatuses(activeCodes: ReadonlySet<string>, ticket: string, ports: ReconcilePorts) {
  const result = { attempted: 0, verified: 0, changed: 0, errors: [] as string[] };
  let rows: Candidate[];
  try { rows = await ports.load(); }
  catch { result.errors.push('reconcile: candidate_read_failed'); return result; }
  const now = ports.now();
  const seen = new Set<string>();
  const candidates = rows.slice(0, SCAN_LIMIT).filter(row => {
    if (!CODE_PATTERN.test(row.codigo) || seen.has(row.codigo)) return false;
    seen.add(row.codigo);
    if (row.raw_data !== null && !object(row.raw_data)) {
      result.errors.push(`reconcile ${row.codigo}: invalid_existing_metadata`);
      return false;
    }
    const open = row.codigo_estado === 5 || /^(publicada|activa)$/i.test(row.estado ?? '') || row.estado === null;
    if (!open || now - lastAttempt(row) < CHECK_INTERVAL_MS) return false;
    const updated = Date.parse(row.updated_at ?? '');
    return !activeCodes.has(row.codigo) || Date.parse(row.fecha_cierre ?? '') <= now ||
      !Number.isFinite(updated) || now - updated >= CHECK_INTERVAL_MS;
  }).slice(0, REQUEST_LIMIT);

  for (const row of candidates) {
    if (result.attempted) await ports.sleep(1200);
    result.attempted++;
    let failure: string | null = null;
    let official: { estado: string; codigo_estado: number } | null = null;
    let rateLimited = false;
    try {
      const query = new URLSearchParams({ codigo: row.codigo, ticket });
      const response = await ports.fetch(`https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?${query}`, {
        headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        rateLimited = response.status === 429;
        failure = rateLimited ? 'rate_limited' : `http_${response.status}`;
      } else {
        const body: unknown = await response.json();
        const list = object(body) && Array.isArray(body.Listado) ? body.Listado : [];
        const detail: unknown = list.length === 1 ? list[0] : null;
        if (!object(detail) || detail.CodigoExterno !== row.codigo) failure = 'invalid_detail';
        else {
          const code = typeof detail.CodigoEstado === 'number' ? detail.CodigoEstado :
            typeof detail.CodigoEstado === 'string' && /^\d+$/.test(detail.CodigoEstado) ? Number(detail.CodigoEstado) : NaN;
          const state = STATUS_BY_CODE[code];
          const stated = typeof detail.Estado === 'string' ? detail.Estado.trim() : '';
          if (!state || (stated && stated.toLowerCase() !== state.toLowerCase())) failure = 'invalid_status';
          else official = { estado: state, codigo_estado: code };
        }
      }
    } catch { failure = 'transport_or_json_failed'; }

    const timestamp = new Date(ports.now()).toISOString();
    const raw = object(row.raw_data) ? row.raw_data : {};
    const oldMeta = object(raw._firmavb_estado) ? raw._firmavb_estado : {};
    // Preserve the full existing detail. Never copy items, budget or dates from this response.
    const patch: StatusPatch = {
      ...(official ?? {}),
      raw_data: {
        ...raw,
        ...(official ? { Estado: official.estado, CodigoEstado: official.codigo_estado } : {}),
        _firmavb_estado: {
          ...oldMeta, fuente: 'mercadopublico:licitaciones.json:codigo', intentado_en: timestamp,
          ...(official ? { verificado_en: timestamp } : {}), error: failure,
        },
      },
      updated_at: timestamp,
    };
    if (failure) result.errors.push(`reconcile ${row.codigo}: ${failure}`);
    try {
      if (!await ports.save(row, patch)) result.errors.push(`reconcile ${row.codigo}: concurrent_update`);
      else if (official) {
        result.verified++;
        if (row.estado !== official.estado || row.codigo_estado !== official.codigo_estado) result.changed++;
      }
    } catch { result.errors.push(`reconcile ${row.codigo}: persistence_failed`); }
    // No automatic retries. Leave the rest of the bounded queue for the next cron.
    if (rateLimited) break;
  }
  return result;
}
