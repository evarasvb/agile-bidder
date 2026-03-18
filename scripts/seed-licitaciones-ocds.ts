/**
 * Seed Licitaciones from OCDS API — Paginates through licitaciones, trato directo,
 * and convenio marco endpoints. Fetches tender details and upserts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-licitaciones-ocds.ts
 *
 * Environment:
 *   SUPABASE_URL              — Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (required)
 *   MONTHS                    — Comma-separated months, e.g. "01,02,03" (default: "01,02,03")
 *   TYPES                     — Comma-separated types: licitaciones,trato_directo,convenio_marco (default: all)
 *   SKIP_DETAILS              — Set to "true" to skip tender detail fetching (faster, less data)
 *   DETAIL_CONCURRENCY        — Number of concurrent detail fetches (default: 5)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MONTHS = (process.env.MONTHS || '01,02,03').split(',').map(m => m.trim());
const TYPES = (process.env.TYPES || 'licitaciones,trato_directo,convenio_marco').split(',').map(t => t.trim());
const SKIP_DETAILS = process.env.SKIP_DETAILS === 'true';
const DETAIL_CONCURRENCY = parseInt(process.env.DETAIL_CONCURRENCY || '5', 10);
const YEAR = 2026;
const PAGE_SIZE = 100;
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 150; // ms between API calls

const OCDS_BASE = 'https://api.mercadopublico.cl/APISOCDS/OCDS';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) { console.log(`[ocds] ${msg}`); }
function warn(msg: string) { console.warn(`[ocds] WARN: ${msg}`); }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Fetch with retry logic */
async function fetchWithRetry(url: string, retries = 3, delayMs = 1000): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) return response;
      if (response.status === 429) {
        const waitMs = delayMs * attempt * 2;
        warn(`Rate limited (429), waiting ${waitMs}ms before retry ${attempt}/${retries}`);
        await sleep(waitMs);
        continue;
      }
      if (response.status >= 500 && attempt < retries) {
        warn(`Server error ${response.status}, retry ${attempt}/${retries}`);
        await sleep(delayMs * attempt);
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (err) {
      if (attempt === retries) throw err;
      warn(`Fetch error (attempt ${attempt}/${retries}): ${err instanceof Error ? err.message : String(err)}`);
      await sleep(delayMs * attempt);
    }
  }
  throw new Error('Unreachable');
}

// ---------------------------------------------------------------------------
// OCDS API types
// ---------------------------------------------------------------------------
interface OcdsListItem {
  ocid?: string;
  urlTender?: string;
  urlAward?: string;
  urlPlanning?: string;
  CodigoExterno?: string;
}

interface OcdsTenderDetail {
  releases?: Array<{
    tender?: {
      id?: string;
      title?: string;
      description?: string;
      status?: string;
      procuringEntity?: {
        name?: string;
        id?: string;
        address?: {
          streetAddress?: string;
          locality?: string;
          region?: string;
        };
      };
      tenderPeriod?: {
        startDate?: string;
        endDate?: string;
      };
      value?: {
        amount?: number;
        currency?: string;
      };
      items?: Array<{
        id?: string;
        description?: string;
        quantity?: number;
        unit?: { name?: string };
        classification?: {
          id?: string;
          description?: string;
          scheme?: string;
        };
      }>;
      documents?: Array<{
        id?: string;
        title?: string;
        url?: string;
      }>;
    };
    awards?: Array<{
      status?: string;
      value?: { amount?: number; currency?: string };
      suppliers?: Array<{
        name?: string;
        id?: string;
      }>;
      date?: string;
    }>;
    planning?: {
      budget?: {
        amount?: { amount?: number; currency?: string };
      };
    };
  }>;
}

// ---------------------------------------------------------------------------
// Paginate OCDS list endpoint
// ---------------------------------------------------------------------------
async function paginateOcdsList(endpoint: string, monthNum: number): Promise<OcdsListItem[]> {
  const items: OcdsListItem[] = [];
  let offset = 0;

  while (true) {
    const url = `${OCDS_BASE}/${endpoint}/${YEAR}/${monthNum}/${offset}/${PAGE_SIZE}`;
    try {
      const response = await fetchWithRetry(url);
      const data = await response.json();

      // The API returns an array of items or an object with data
      const batch: OcdsListItem[] = Array.isArray(data) ? data : (data?.data || []);

      if (!batch || batch.length === 0) break;

      items.push(...batch);
      offset += PAGE_SIZE;

      if (items.length % 500 === 0 || batch.length < PAGE_SIZE) {
        log(`  ${endpoint} month ${monthNum}: ${items.length} items fetched (offset ${offset})`);
      }

      if (batch.length < PAGE_SIZE) break;

      await sleep(RATE_LIMIT_MS);
    } catch (err) {
      warn(`Failed at offset ${offset}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Fetch tender detail
// ---------------------------------------------------------------------------
function extractTenderCode(item: OcdsListItem): string | null {
  // Try ocid first, then extract from URLs
  if (item.CodigoExterno) return item.CodigoExterno;
  if (item.ocid) {
    // ocid format: ocds-70d2nz-XXXX-XX-XXXX
    const parts = item.ocid.split('-');
    if (parts.length >= 3) return parts.slice(2).join('-');
    return item.ocid;
  }
  if (item.urlTender) {
    const match = item.urlTender.match(/tender\/([^/]+)/);
    if (match) return match[1];
  }
  return null;
}

async function fetchTenderDetail(code: string): Promise<OcdsTenderDetail | null> {
  const url = `${OCDS_BASE}/tender/${code}`;
  try {
    const response = await fetchWithRetry(url, 2, 500);
    return await response.json() as OcdsTenderDetail;
  } catch {
    return null;
  }
}

/** Fetch details for a batch of items with concurrency control */
async function fetchDetailsBatch(
  codes: string[],
  concurrency: number
): Promise<Map<string, OcdsTenderDetail>> {
  const results = new Map<string, OcdsTenderDetail>();
  let idx = 0;

  async function worker() {
    while (idx < codes.length) {
      const myIdx = idx++;
      const code = codes[myIdx];
      await sleep(RATE_LIMIT_MS);
      const detail = await fetchTenderDetail(code);
      if (detail) results.set(code, detail);
      if ((myIdx + 1) % 50 === 0) {
        log(`  Detail fetch progress: ${myIdx + 1}/${codes.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, codes.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Map OCDS data to DB rows
// ---------------------------------------------------------------------------
interface LicitacionBiRow {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
  tipo: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  fecha_adjudicacion: string | null;
  institucion_nombre: string | null;
  institucion_rut: string | null;
  institucion_codigo: string | null;
  unidad_compra: string | null;
  unidad_compra_region: string | null;
  presupuesto_estimado: number | null;
  moneda: string;
  raw_data: Record<string, unknown>;
}

interface LicitacionBiItemRow {
  licitacion_codigo: string;
  correlativo: number;
  codigo_producto: string | null;
  codigo_categoria: string | null;
  categoria: string | null;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
}

interface InstitucionRow {
  rut: string;
  nombre: string;
  codigo: string | null;
  region: string | null;
}

interface ProveedorRow {
  rut: string;
  nombre: string;
}

interface AdjudicacionRow {
  licitacion_codigo: string;
  proveedor_nombre: string | null;
  proveedor_rut: string | null;
  monto_adjudicado: number | null;
  moneda: string;
  fecha_adjudicacion: string | null;
}

function mapOcdsToLicitacionBi(
  code: string,
  detail: OcdsTenderDetail | null,
  item: OcdsListItem,
  sourceType: string
): {
  licitacion: LicitacionBiRow;
  items: LicitacionBiItemRow[];
  instituciones: InstitucionRow[];
  proveedores: ProveedorRow[];
  adjudicaciones: AdjudicacionRow[];
} {
  const release = detail?.releases?.[0];
  const tender = release?.tender;
  const planning = release?.planning;
  const awards = release?.awards || [];

  const titulo = tender?.title || code;
  const descripcion = tender?.description || null;
  const estado = tender?.status || null;
  const procuringEntity = tender?.procuringEntity;
  const tenderPeriod = tender?.tenderPeriod;
  const value = tender?.value;
  const budgetAmount = planning?.budget?.amount;

  const licitacion: LicitacionBiRow = {
    codigo: code,
    nombre: titulo,
    descripcion,
    estado,
    tipo: sourceType,
    fecha_publicacion: tenderPeriod?.startDate || null,
    fecha_cierre: tenderPeriod?.endDate || null,
    fecha_adjudicacion: awards[0]?.date || null,
    institucion_nombre: procuringEntity?.name || null,
    institucion_rut: procuringEntity?.id || null,
    institucion_codigo: null,
    unidad_compra: procuringEntity?.name || null,
    unidad_compra_region: procuringEntity?.address?.region || null,
    presupuesto_estimado: value?.amount ?? budgetAmount?.amount ?? null,
    moneda: value?.currency || budgetAmount?.currency || 'CLP',
    raw_data: { ocid: item.ocid, urlTender: item.urlTender, detail: detail || null },
  };

  // Map items
  const items: LicitacionBiItemRow[] = (tender?.items || []).map((tItem, idx) => ({
    licitacion_codigo: code,
    correlativo: idx + 1,
    codigo_producto: tItem.classification?.id || null,
    codigo_categoria: tItem.classification?.scheme || null,
    categoria: tItem.classification?.description || null,
    nombre_producto: tItem.description || `Item ${idx + 1}`,
    descripcion: tItem.description || null,
    cantidad: tItem.quantity || 1,
    unidad: tItem.unit?.name || null,
  }));

  // Extract instituciones
  const instituciones: InstitucionRow[] = [];
  if (procuringEntity?.id && procuringEntity?.name) {
    instituciones.push({
      rut: procuringEntity.id,
      nombre: procuringEntity.name,
      codigo: null,
      region: procuringEntity.address?.region || null,
    });
  }

  // Extract proveedores and adjudicaciones
  const proveedores: ProveedorRow[] = [];
  const adjudicaciones: AdjudicacionRow[] = [];
  for (const award of awards) {
    for (const supplier of (award.suppliers || [])) {
      if (supplier.id && supplier.name) {
        proveedores.push({ rut: supplier.id, nombre: supplier.name });
        adjudicaciones.push({
          licitacion_codigo: code,
          proveedor_nombre: supplier.name,
          proveedor_rut: supplier.id,
          monto_adjudicado: award.value?.amount || null,
          moneda: award.value?.currency || 'CLP',
          fecha_adjudicacion: award.date || null,
        });
      }
    }
  }

  return { licitacion, items, instituciones, proveedores, adjudicaciones };
}

// ---------------------------------------------------------------------------
// Upsert into Supabase
// ---------------------------------------------------------------------------
async function upsertLicitacionesBi(supabase: SupabaseClient, rows: LicitacionBiRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('licitaciones_bi')
      .upsert(batch, { onConflict: 'codigo', ignoreDuplicates: false });

    if (error) {
      warn(`licitaciones_bi batch error: ${error.message}`);
      // Fallback to individual inserts
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from('licitaciones_bi')
          .upsert(row, { onConflict: 'codigo', ignoreDuplicates: false });
        if (!singleErr) total++;
      }
    } else {
      total += batch.length;
    }
  }
  return total;
}

async function upsertLicitacionesBiItems(
  supabase: SupabaseClient,
  rows: LicitacionBiItemRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  // Get licitacion IDs for the codes we have
  const codes = [...new Set(rows.map(r => r.licitacion_codigo))];
  const codeToId = new Map<string, string>();

  for (let i = 0; i < codes.length; i += 100) {
    const batch = codes.slice(i, i + 100);
    const { data } = await supabase
      .from('licitaciones_bi')
      .select('id, codigo')
      .in('codigo', batch);
    if (data) {
      for (const row of data) {
        codeToId.set(row.codigo, row.id);
      }
    }
  }

  // Map items with licitacion_id
  const itemsWithId = rows
    .filter(r => codeToId.has(r.licitacion_codigo))
    .map(r => ({
      licitacion_id: codeToId.get(r.licitacion_codigo),
      correlativo: r.correlativo,
      codigo_producto: r.codigo_producto,
      codigo_categoria: r.codigo_categoria,
      categoria: r.categoria,
      nombre_producto: r.nombre_producto,
      descripcion: r.descripcion,
      cantidad: r.cantidad,
      unidad: r.unidad,
    }));

  let total = 0;
  for (let i = 0; i < itemsWithId.length; i += BATCH_SIZE) {
    const batch = itemsWithId.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('licitaciones_bi_items').insert(batch);
    if (error) {
      warn(`licitaciones_bi_items batch error: ${error.message}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

async function upsertInstituciones(supabase: SupabaseClient, rows: InstitucionRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  // Deduplicate
  const map = new Map<string, InstitucionRow>();
  for (const row of rows) map.set(row.rut, row);
  const unique = Array.from(map.values());

  let total = 0;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('instituciones')
      .upsert(batch, { onConflict: 'rut', ignoreDuplicates: false });
    if (error) {
      warn(`instituciones batch error: ${error.message}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

async function upsertProveedores(supabase: SupabaseClient, rows: ProveedorRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const map = new Map<string, ProveedorRow>();
  for (const row of rows) map.set(row.rut, row);
  const unique = Array.from(map.values());

  let total = 0;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('proveedores')
      .upsert(batch, { onConflict: 'rut', ignoreDuplicates: false });
    if (error) {
      warn(`proveedores batch error: ${error.message}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

async function insertAdjudicaciones(
  supabase: SupabaseClient,
  rows: AdjudicacionRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  // Resolve licitacion IDs
  const codes = [...new Set(rows.map(r => r.licitacion_codigo))];
  const codeToId = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 100) {
    const batch = codes.slice(i, i + 100);
    const { data } = await supabase
      .from('licitaciones_bi')
      .select('id, codigo')
      .in('codigo', batch);
    if (data) {
      for (const row of data) {
        codeToId.set(row.codigo, row.id);
      }
    }
  }

  const adjWithId = rows
    .filter(r => codeToId.has(r.licitacion_codigo))
    .map(r => ({
      licitacion_id: codeToId.get(r.licitacion_codigo),
      proveedor_nombre: r.proveedor_nombre,
      proveedor_rut: r.proveedor_rut,
      monto_adjudicado: r.monto_adjudicado,
      moneda: r.moneda,
      fecha_adjudicacion: r.fecha_adjudicacion,
    }));

  let total = 0;
  for (let i = 0; i < adjWithId.length; i += BATCH_SIZE) {
    const batch = adjWithId.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('licitaciones_adjudicaciones').insert(batch);
    if (error) {
      warn(`adjudicaciones batch error: ${error.message}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Process one source type for all months
// ---------------------------------------------------------------------------
async function processSourceType(
  supabase: SupabaseClient,
  sourceType: string,
  endpoint: string,
  label: string
): Promise<{
  totalLicitaciones: number;
  totalItems: number;
  totalInst: number;
  totalProv: number;
  totalAdj: number;
}> {
  const allLicitaciones: LicitacionBiRow[] = [];
  const allItems: LicitacionBiItemRow[] = [];
  const allInstituciones: InstitucionRow[] = [];
  const allProveedores: ProveedorRow[] = [];
  const allAdjudicaciones: AdjudicacionRow[] = [];

  for (const month of MONTHS) {
    const monthNum = parseInt(month, 10);
    log(`\n  ${label} — month ${YEAR}-${month}`);

    const listItems = await paginateOcdsList(endpoint, monthNum);
    log(`  Listed ${listItems.length} items`);

    if (listItems.length === 0) continue;

    // Extract codes
    const codes: string[] = [];
    const codeToItem = new Map<string, OcdsListItem>();
    for (const item of listItems) {
      const code = extractTenderCode(item);
      if (code && !codeToItem.has(code)) {
        codes.push(code);
        codeToItem.set(code, item);
      }
    }
    log(`  Unique codes: ${codes.length}`);

    // Fetch details if enabled
    let detailsMap = new Map<string, OcdsTenderDetail>();
    if (!SKIP_DETAILS && codes.length > 0) {
      log(`  Fetching tender details (concurrency=${DETAIL_CONCURRENCY})...`);
      detailsMap = await fetchDetailsBatch(codes, DETAIL_CONCURRENCY);
      log(`  Got ${detailsMap.size} details out of ${codes.length} codes`);
    }

    // Map to DB rows
    for (const code of codes) {
      const item = codeToItem.get(code)!;
      const detail = detailsMap.get(code) || null;
      const mapped = mapOcdsToLicitacionBi(code, detail, item, sourceType);

      allLicitaciones.push(mapped.licitacion);
      allItems.push(...mapped.items);
      allInstituciones.push(...mapped.instituciones);
      allProveedores.push(...mapped.proveedores);
      allAdjudicaciones.push(...mapped.adjudicaciones);
    }
  }

  // Upsert all data
  log(`\n  Upserting ${allLicitaciones.length} ${label}...`);
  const totalLicitaciones = await upsertLicitacionesBi(supabase, allLicitaciones);

  log(`  Upserting ${allItems.length} items...`);
  const totalItems = await upsertLicitacionesBiItems(supabase, allItems);

  const totalInst = await upsertInstituciones(supabase, allInstituciones);
  const totalProv = await upsertProveedores(supabase, allProveedores);
  const totalAdj = await insertAdjudicaciones(supabase, allAdjudicaciones);

  return { totalLicitaciones, totalItems, totalInst, totalProv, totalAdj };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log('=== Seed Licitaciones OCDS 2026 ===');
  log(`Months: ${MONTHS.join(', ')}`);
  log(`Types: ${TYPES.join(', ')}`);
  log(`Skip details: ${SKIP_DETAILS}`);
  log(`Detail concurrency: ${DETAIL_CONCURRENCY}`);

  const stats = {
    licitaciones: 0,
    trato_directo: 0,
    convenio_marco: 0,
    items: 0,
    instituciones: 0,
    proveedores: 0,
    adjudicaciones: 0,
  };

  // Licitaciones
  if (TYPES.includes('licitaciones')) {
    log('\n=== LICITACIONES ===');
    const result = await processSourceType(
      supabase,
      'licitacion',
      'listaOCDSAgnoMes',
      'Licitaciones'
    );
    stats.licitaciones = result.totalLicitaciones;
    stats.items += result.totalItems;
    stats.instituciones += result.totalInst;
    stats.proveedores += result.totalProv;
    stats.adjudicaciones += result.totalAdj;
  }

  // Trato Directo
  if (TYPES.includes('trato_directo')) {
    log('\n=== TRATO DIRECTO ===');
    const result = await processSourceType(
      supabase,
      'trato_directo',
      'listaOCDSAgnoMesTratoDirecto',
      'Trato Directo'
    );
    stats.trato_directo = result.totalLicitaciones;
    stats.items += result.totalItems;
    stats.instituciones += result.totalInst;
    stats.proveedores += result.totalProv;
    stats.adjudicaciones += result.totalAdj;
  }

  // Convenio Marco
  if (TYPES.includes('convenio_marco')) {
    log('\n=== CONVENIO MARCO ===');
    const result = await processSourceType(
      supabase,
      'convenio_marco',
      'listaOCDSAgnoMesConvenio',
      'Convenio Marco'
    );
    stats.convenio_marco = result.totalLicitaciones;
    stats.items += result.totalItems;
    stats.instituciones += result.totalInst;
    stats.proveedores += result.totalProv;
    stats.adjudicaciones += result.totalAdj;
  }

  log('\n======================================');
  log('SEED LICITACIONES OCDS — RESUMEN');
  log('======================================');
  log(`Licitaciones     : ${stats.licitaciones}`);
  log(`Trato Directo    : ${stats.trato_directo}`);
  log(`Convenio Marco   : ${stats.convenio_marco}`);
  log(`Items            : ${stats.items}`);
  log(`Instituciones    : ${stats.instituciones}`);
  log(`Proveedores      : ${stats.proveedores}`);
  log(`Adjudicaciones   : ${stats.adjudicaciones}`);
  log('======================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
