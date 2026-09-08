// Piloto de datos abiertos ChileCompra (órdenes de compra).
// Lee los CSV ya descomprimidos en ./ocdata y, según MODO:
//   - probe: mide (archivos, tamaño, columnas, N filas, muestra) SIN insertar.
//   - load : inserta en Supabase (se activa después de validar el probe).
// CSV: UTF-8, separado por ';'. Fuente: transparenciachc.blob.core.windows.net/oc-da/AAAA-M.zip
import { readdirSync, statSync, createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const MODO = process.env.MODO || 'probe';
const DIR = process.env.OCDIR || 'ocdata';

function parseLinea(linea, sep = ';') {
  // Parser CSV simple con comillas dobles.
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) {
      if (c === '"') { if (linea[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function listarCsv(dir) {
  const res = [];
  for (const name of readdirSync(dir)) {
    const p = `${dir}/${name}`;
    const st = statSync(p);
    if (st.isDirectory()) res.push(...listarCsv(p));
    else if (/\.csv$/i.test(name)) res.push({ path: p, size: st.size });
  }
  return res;
}

async function probeArchivo(path) {
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  let header = null; let n = 0; const muestra = [];
  for await (const linea of rl) {
    if (n === 0) { header = linea; n++; continue; }
    if (linea.trim() === '') continue;
    if (muestra.length < 2) muestra.push(linea.slice(0, 400));
    n++;
    if (n > 3_000_000) break; // tope de seguridad
  }
  return { header, filas: n - 1, muestra };
}

const csvs = listarCsv(DIR);
console.log(`=== MODO=${MODO} · archivos CSV encontrados: ${csvs.length} ===`);
for (const c of csvs) {
  console.log(`\n--- ${c.path} (${(c.size / 1e6).toFixed(1)} MB) ---`);
  const info = await probeArchivo(c.path);
  const cols = parseLinea(info.header || '');
  console.log(`columnas (${cols.length}): ${cols.join(' | ')}`);
  console.log(`filas de datos: ${info.filas}`);
  info.muestra.forEach((m, i) => console.log(`muestra[${i}]: ${m}`));
}

if (MODO === 'load') {
  console.log('\n[load] Aún no implementado: primero validar columnas con el probe.');
}
