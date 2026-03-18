/**
 * Seed Compras Ágiles — Downloads 2026 monthly ZIPs from transparenciachc,
 * extracts CSVs (Latin-1, semicolon-delimited), and upserts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/seed-compras-agiles.ts
 *
 * Environment:
 *   SUPABASE_URL              — Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (required)
 *   MONTHS                    — Comma-separated months, e.g. "01,02" (default: "01,02")
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MONTHS = (process.env.MONTHS || '01,02').split(',').map(m => m.trim());
const YEAR = 2026;
const BATCH_SIZE = 500;
const ZIP_BASE = 'https://transparenciachc.blob.core.windows.net/trnspchc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) { console.log(`[compras-agiles] ${msg}`); }
function warn(msg: string) { console.warn(`[compras-agiles] WARN: ${msg}`); }

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Decode a Latin-1 (Windows-1252) buffer to UTF-8 string */
function decodeLatin1(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    chars.push(String.fromCharCode(bytes[i]));
  }
  return chars.join('');
}

/** Parse a semicolon-delimited CSV string into rows of string arrays. */
function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(line => {
    // Handle quoted fields with semicolons inside
    const fields: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === ';' && !inQuote) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  });
}

/** Parse a numeric string, handling commas as decimal separators and quoted values */
function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/"/g, '').replace(/\./g, '').replace(',', '.').trim();
  if (!cleaned || cleaned === '' || cleaned.toLowerCase() === 'na' || cleaned.toLowerCase() === 'n/a') return null;
  const val = Number(cleaned);
  return isNaN(val) ? null : val;
}

/** Parse a date string in various formats */
function parseDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/"/g, '').trim();
  if (!cleaned || cleaned === '' || cleaned.toLowerCase() === 'na') return null;
  // Try ISO format first (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned;
  // DD/MM/YYYY format
  const parts = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  // DD-MM-YYYY format
  const parts2 = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (parts2) return `${parts2[3]}-${parts2[2].padStart(2, '0')}-${parts2[1].padStart(2, '0')}`;
  return null;
}

function cleanStr(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/"/g, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'na' || cleaned.toLowerCase() === 'n/a') return null;
  return cleaned;
}

// ---------------------------------------------------------------------------
// Column mapping — CSV column index → compras_agiles field
// Based on the spec's 30-column definition
// ---------------------------------------------------------------------------
const CSV_COLUMNS = [
  'RazonSocialUnidaddeCompra',   // 0  → organismo / nombre_organismo
  'NombreUnidaddeCompra',         // 1
  'RUTUnidaddeCompra',            // 2
  'CodigoUnidaddeCompra',         // 3
  'CodigoCotizacion',             // 4  → codigo (UNIQUE)
  'NombreCotizacion',             // 5  → nombre
  'DescripcionCotizacion',        // 6  → descripcion
  'DireccionEntrega',             // 7
  'Region',                       // 8  → region
  'FechaPublicacionParaCotizar',  // 9
  'FechaCierreParaCotizar',       // 10 → fecha_cierre
  'PlazoEntrega',                 // 11
  'MontoTotalDisponble',          // 12 → monto_estimado / monto
  'ProductoCotizado',             // 13
  'CodigoProducto',               // 14
  'NombreProductoGenerico',       // 15
  'CantidadSolicitada',           // 16
  'Estado',                       // 17 → estado
  'NOMBRECONTACTO',               // 18
  'RazonSocialProveedor',         // 19
  'RUTProveedor',                 // 20
  'Tamano',                       // 21
  'DetalleCotizacion',            // 22
  'ProveedorSeleccionado',        // 23
  'moneda',                       // 24
  'MontoTotal',                   // 25
  'NombreCriterio',               // 26
  'CodigoOC',                     // 27
  'EstadoOC',                     // 28
  'MotivoCancelacion',            // 29
] as const;

// ---------------------------------------------------------------------------
// Build row for compras_agiles table
// ---------------------------------------------------------------------------
interface CompraAgilRow {
  codigo: string;
  nombre: string;
  organismo: string;
  nombre_organismo: string | null;
  monto: number | null;
  monto_estimado: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  region: string | null;
  descripcion: string | null;
  link_oficial: string | null;
  datos_json: Record<string, unknown>;
  tipo_proceso: string;
  categoria: string;
}

function classifyByAmount(monto: number | null): { tipo_proceso: string; categoria: string } {
  if (!monto || monto === 0) return { tipo_proceso: 'compra_agil', categoria: 'L1' };
  if (monto <= 6_975_100) return { tipo_proceso: 'compra_agil', categoria: 'L1' };
  if (monto <= 69_751_000) return { tipo_proceso: 'licitacion', categoria: 'LE' };
  if (monto <= 348_755_000) return { tipo_proceso: 'licitacion', categoria: 'LP' };
  return { tipo_proceso: 'licitacion', categoria: 'LR' };
}

function buildCompraAgilRow(fields: string[]): CompraAgilRow | null {
  const codigo = cleanStr(fields[4]);
  const nombre = cleanStr(fields[5]);
  const organismo = cleanStr(fields[0]);
  if (!codigo || !nombre || !organismo) return null;

  const montoDisponible = parseAmount(fields[12]);
  const montoTotal = parseAmount(fields[25]);
  const monto = montoDisponible ?? montoTotal;
  const { tipo_proceso, categoria } = classifyByAmount(monto);

  const linkBase = `https://www.mercadopublico.cl/CompraAgil/Cotizacion/${codigo}`;

  return {
    codigo,
    nombre,
    organismo,
    nombre_organismo: organismo,
    monto,
    monto_estimado: monto,
    fecha_cierre: parseDate(fields[10]),
    estado: cleanStr(fields[17]) || 'activa',
    region: cleanStr(fields[8]),
    descripcion: cleanStr(fields[6]),
    link_oficial: linkBase,
    datos_json: {
      unidad_compra: cleanStr(fields[1]),
      rut_comprador: cleanStr(fields[2]),
      codigo_unidad: cleanStr(fields[3]),
      fecha_publicacion: parseDate(fields[9]),
      plazo_entrega: cleanStr(fields[11]),
      producto_cotizado: cleanStr(fields[13]),
      codigo_producto: cleanStr(fields[14]),
      nombre_producto_generico: cleanStr(fields[15]),
      cantidad_solicitada: parseAmount(fields[16]),
      contacto: cleanStr(fields[18]),
      proveedor_nombre: cleanStr(fields[19]),
      proveedor_rut: cleanStr(fields[20]),
      proveedor_tamano: cleanStr(fields[21]),
      detalle_cotizacion: cleanStr(fields[22]),
      proveedor_seleccionado: cleanStr(fields[23]),
      moneda: cleanStr(fields[24]),
      monto_total: parseAmount(fields[25]),
      criterio: cleanStr(fields[26]),
      codigo_oc: cleanStr(fields[27]),
      estado_oc: cleanStr(fields[28]),
      motivo_cancelacion: cleanStr(fields[29]),
    },
    tipo_proceso,
    categoria,
  };
}

// ---------------------------------------------------------------------------
// Extract instituciones from rows
// ---------------------------------------------------------------------------
interface InstitucionRow {
  rut: string;
  nombre: string;
  codigo: string | null;
  region: string | null;
}

function extractInstituciones(allFields: string[][]): InstitucionRow[] {
  const map = new Map<string, InstitucionRow>();
  for (const fields of allFields) {
    const rut = cleanStr(fields[2]);
    const nombre = cleanStr(fields[0]);
    if (!rut || !nombre) continue;
    if (!map.has(rut)) {
      map.set(rut, {
        rut,
        nombre,
        codigo: cleanStr(fields[3]),
        region: cleanStr(fields[8]),
      });
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Extract proveedores from rows
// ---------------------------------------------------------------------------
interface ProveedorRow {
  rut: string;
  nombre: string;
  tamanio_empresa: string | null;
}

function extractProveedores(allFields: string[][]): ProveedorRow[] {
  const map = new Map<string, ProveedorRow>();
  for (const fields of allFields) {
    const rut = cleanStr(fields[20]);
    const nombre = cleanStr(fields[19]);
    if (!rut || !nombre) continue;
    if (!map.has(rut)) {
      map.set(rut, {
        rut,
        nombre,
        tamanio_empresa: cleanStr(fields[21]),
      });
    }
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Download and extract ZIP
// ---------------------------------------------------------------------------
async function downloadAndExtractZip(month: string): Promise<string[][]> {
  const url = `${ZIP_BASE}/COT_${YEAR}-${month}.zip`;
  log(`Downloading ${url} ...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  log(`Downloaded ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

  const zip = await JSZip.loadAsync(arrayBuffer);
  const csvFiles = Object.keys(zip.files).filter(name => name.endsWith('.csv'));
  log(`Found CSV files in ZIP: ${csvFiles.join(', ')}`);

  let allRows: string[][] = [];
  for (const csvName of csvFiles) {
    const csvBuffer = await zip.files[csvName].async('arraybuffer');
    const csvText = decodeLatin1(csvBuffer);
    const rows = parseCsv(csvText);

    if (rows.length <= 1) {
      warn(`${csvName} has no data rows, skipping`);
      continue;
    }

    // First row is header, validate it
    const header = rows[0];
    log(`${csvName}: ${rows.length - 1} data rows, ${header.length} columns`);

    // Skip header row
    allRows = allRows.concat(rows.slice(1));
  }

  return allRows;
}

// ---------------------------------------------------------------------------
// Upsert into Supabase
// ---------------------------------------------------------------------------
async function upsertComprasAgiles(supabase: SupabaseClient, rows: CompraAgilRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('compras_agiles')
      .upsert(batch, { onConflict: 'codigo', ignoreDuplicates: false })
      .select('codigo');

    if (error) {
      warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`);
      // Try individual inserts for failed batch
      for (const row of batch) {
        const { error: singleError } = await supabase
          .from('compras_agiles')
          .upsert(row, { onConflict: 'codigo', ignoreDuplicates: false });
        if (singleError) {
          warn(`Row ${row.codigo} error: ${singleError.message}`);
        } else {
          total++;
        }
      }
    } else {
      total += batch.length;
    }

    if (i + BATCH_SIZE < rows.length) {
      process.stdout.write(`  Upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} compras\r`);
    }
  }
  return total;
}

async function upsertInstituciones(supabase: SupabaseClient, rows: InstitucionRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('instituciones')
      .upsert(batch, { onConflict: 'rut', ignoreDuplicates: false });
    if (error) {
      warn(`Instituciones batch error: ${error.message}`);
    } else {
      total += batch.length;
    }
  }
  return total;
}

async function upsertProveedores(supabase: SupabaseClient, rows: ProveedorRow[]): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('proveedores')
      .upsert(batch, { onConflict: 'rut', ignoreDuplicates: false });
    if (error) {
      warn(`Proveedores batch error: ${error.message}`);
    } else {
      total += batch.length;
    }
  }
  return total;
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

  log('=== Seed Compras Ágiles 2026 ===');
  log(`Months: ${MONTHS.join(', ')}`);
  log(`Batch size: ${BATCH_SIZE}`);

  let grandTotalCompras = 0;
  let grandTotalInst = 0;
  let grandTotalProv = 0;
  const allRawRows: string[][] = [];

  for (const month of MONTHS) {
    log(`\n--- Processing month ${YEAR}-${month} ---`);
    try {
      const rawRows = await downloadAndExtractZip(month);
      log(`Raw rows from CSVs: ${rawRows.length}`);
      allRawRows.push(...rawRows);

      // Build compras_agiles rows
      const compraRows: CompraAgilRow[] = [];
      const seen = new Set<string>();
      for (const fields of rawRows) {
        const row = buildCompraAgilRow(fields);
        if (row && !seen.has(row.codigo)) {
          seen.add(row.codigo);
          compraRows.push(row);
        }
      }
      log(`Unique compras to upsert: ${compraRows.length}`);

      const upserted = await upsertComprasAgiles(supabase, compraRows);
      log(`Upserted ${upserted} compras agiles`);
      grandTotalCompras += upserted;
    } catch (err) {
      warn(`Month ${month} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Extract and upsert instituciones & proveedores from all months combined
  log('\n--- Extracting instituciones ---');
  const instituciones = extractInstituciones(allRawRows);
  log(`Unique instituciones: ${instituciones.length}`);
  grandTotalInst = await upsertInstituciones(supabase, instituciones);
  log(`Upserted ${grandTotalInst} instituciones`);

  log('\n--- Extracting proveedores ---');
  const proveedores = extractProveedores(allRawRows);
  log(`Unique proveedores: ${proveedores.length}`);
  grandTotalProv = await upsertProveedores(supabase, proveedores);
  log(`Upserted ${grandTotalProv} proveedores`);

  log('\n======================================');
  log('SEED COMPRAS ÁGILES — RESUMEN');
  log('======================================');
  log(`Compras ágiles upserted : ${grandTotalCompras}`);
  log(`Instituciones upserted  : ${grandTotalInst}`);
  log(`Proveedores upserted    : ${grandTotalProv}`);
  log('======================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
