/**
 * Seed Convenio Marco — Downloads CM_publicados.csv from transparenciachc,
 * parses master convenio data, and stores it in the database.
 *
 * Usage:
 *   npx tsx scripts/seed-convenio-marco.ts
 *
 * Environment:
 *   SUPABASE_URL              — Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (required)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CM_CSV_URL = 'https://transparenciachc.blob.core.windows.net/maestrascm/CM_publicados.csv';
const BATCH_SIZE = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function log(msg: string) { console.log(`[convenio-marco] ${msg}`); }
function warn(msg: string) { console.warn(`[convenio-marco] WARN: ${msg}`); }

/** Decode a Latin-1 (Windows-1252) buffer to UTF-8 string */
function decodeLatin1(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    chars.push(String.fromCharCode(bytes[i]));
  }
  return chars.join('');
}

/** Parse a semicolon or comma-delimited CSV */
function parseCsv(text: string, delimiter = ';'): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.map(line => {
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
      } else if (ch === delimiter && !inQuote) {
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

function cleanStr(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/"/g, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'na' || cleaned.toLowerCase() === 'n/a') return null;
  return cleaned;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ConvenioMarcoRow {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: string | null;
  tipo: string;
  fecha_publicacion: string | null;
  institucion_nombre: string | null;
  presupuesto_estimado: number | null;
  moneda: string;
  raw_data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Download and parse CM_publicados.csv
// ---------------------------------------------------------------------------
async function downloadConvenioMarcoCsv(): Promise<string[][]> {
  log(`Downloading ${CM_CSV_URL} ...`);
  const response = await fetch(CM_CSV_URL);
  if (!response.ok) {
    throw new Error(`Failed to download: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  log(`Downloaded ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`);

  // Try Latin-1 first, then UTF-8
  const text = decodeLatin1(arrayBuffer);

  // Detect delimiter (semicolon or comma)
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delimiter = firstLine.includes(';') ? ';' : ',';
  log(`Detected delimiter: "${delimiter}"`);

  const rows = parseCsv(text, delimiter);
  log(`Parsed ${rows.length} rows (including header)`);

  return rows;
}

// ---------------------------------------------------------------------------
// Map CSV rows to licitaciones_bi rows (convenio marco type)
// ---------------------------------------------------------------------------
function mapConvenioRows(allRows: string[][]): ConvenioMarcoRow[] {
  if (allRows.length < 2) return [];

  const header = allRows[0].map(h => h.toLowerCase().replace(/"/g, '').trim());
  log(`CSV header columns: ${header.join(', ')}`);

  // Find column indexes dynamically
  const idxId = header.findIndex(h =>
    h.includes('idconveniomarco') || h.includes('id_convenio') || h.includes('id')
  );
  const idxNroLic = header.findIndex(h =>
    h.includes('nrolicitacion') || h.includes('licitacion')
  );
  const idxNombre = header.findIndex(h =>
    h.includes('nombreconveniomarco') || h.includes('nombre')
  );
  const idxFecha = header.findIndex(h =>
    h.includes('fechaactualizacion') || h.includes('fecha')
  );
  const idxLink = header.findIndex(h =>
    h.includes('link') || h.includes('url')
  );

  log(`Column mapping: id=${idxId}, nro_lic=${idxNroLic}, nombre=${idxNombre}, fecha=${idxFecha}, link=${idxLink}`);

  const results: ConvenioMarcoRow[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < allRows.length; i++) {
    const fields = allRows[i];

    // Try to get a unique code
    const idConvenio = cleanStr(fields[idxId >= 0 ? idxId : 0]);
    const nroLicitacion = cleanStr(fields[idxNroLic >= 0 ? idxNroLic : 1]);
    const nombre = cleanStr(fields[idxNombre >= 0 ? idxNombre : 2]);
    const fecha = cleanStr(fields[idxFecha >= 0 ? idxFecha : 3]);
    const link = cleanStr(fields[idxLink >= 0 ? idxLink : 4]);

    // Use nroLicitacion as the unique code if available, otherwise idConvenio
    const codigo = nroLicitacion || (idConvenio ? `CM-${idConvenio}` : null);
    if (!codigo || !nombre) continue;
    if (seen.has(codigo)) continue;
    seen.add(codigo);

    results.push({
      codigo,
      nombre,
      descripcion: `Convenio Marco: ${nombre}`,
      estado: 'activa',
      tipo: 'convenio_marco',
      fecha_publicacion: fecha,
      institucion_nombre: 'ChileCompra',
      presupuesto_estimado: null,
      moneda: 'CLP',
      raw_data: {
        id_convenio_marco: idConvenio,
        nro_licitacion_publica: nroLicitacion,
        nombre_convenio_marco: nombre,
        fecha_actualizacion: fecha,
        link_maestra_prod: link,
        source: 'CM_publicados.csv',
      },
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Upsert into licitaciones_bi
// ---------------------------------------------------------------------------
async function upsertConvenioMarco(
  supabase: SupabaseClient,
  rows: ConvenioMarcoRow[]
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('licitaciones_bi')
      .upsert(batch, { onConflict: 'codigo', ignoreDuplicates: false });

    if (error) {
      warn(`Batch error: ${error.message}`);
      // Fallback to individual
      for (const row of batch) {
        const { error: singleErr } = await supabase
          .from('licitaciones_bi')
          .upsert(row, { onConflict: 'codigo', ignoreDuplicates: false });
        if (!singleErr) total++;
      }
    } else {
      total += batch.length;
    }

    if (i + BATCH_SIZE < rows.length) {
      process.stdout.write(`  Upserted ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
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

  log('=== Seed Convenio Marco ===');

  const rawRows = await downloadConvenioMarcoCsv();
  const convenioRows = mapConvenioRows(rawRows);
  log(`Unique convenios to upsert: ${convenioRows.length}`);

  const total = await upsertConvenioMarco(supabase, convenioRows);

  log('\n======================================');
  log('SEED CONVENIO MARCO — RESUMEN');
  log('======================================');
  log(`Convenios upserted: ${total}`);
  log('======================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
