// © 2024-2026 Firma VB SpA. Todos los derechos reservados.
// Offline only: no conexión, credenciales ni aplicación automática a DB.
// node --experimental-strip-types scripts/academia-normativa-preview.ts snapshot.json salida.json
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ACADEMIA_REEMPLAZOS, ACADEMIA_FUENTES } from '../supabase/functions/_shared/academia-normativa.ts';

const allowed = new Set(['vende-al-estado-desde-cero', 'programa-pro-adjudica-al-estado']);
export function patchAcademiaRows(input: unknown): unknown {
  if (!Array.isArray(input)) throw new Error('Se espera un arreglo de filas {slug, modulos}.');
  return input.map(row => {
    if (!row || typeof row !== 'object' || !allowed.has(row.slug)) return row;
    if (!Array.isArray(row.modulos)) throw new Error('modulos debe ser un arreglo.');
    return { ...row, modulos: row.modulos.map((modulo: {lecciones: {bloques: Record<string, unknown>[]}[]}) => ({
      ...modulo, lecciones: modulo.lecciones.map(leccion => {
        let changed = false;
        const replace = (v: unknown): unknown => {
          if (typeof v === 'string' && Object.prototype.hasOwnProperty.call(ACADEMIA_REEMPLAZOS, v)) { changed = true; return ACADEMIA_REEMPLAZOS[v]; }
          if (Array.isArray(v)) return v.map(replace);
          if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, replace(val)]));
          return v;
        };
        const bloques = leccion.bloques.map(b => replace(b) as Record<string, unknown>);
        if (changed) for (const fuente of ACADEMIA_FUENTES) {
          if (!bloques.some(b => b.url === fuente.url)) bloques.push(fuente);
        }
        return { ...leccion, bloques };
      }),
    })) };
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , source, target] = process.argv;
  if (!source || !target || source === target) throw new Error('Indica snapshot.json y salida.json distintos. Conserva el original para comparar y revertir.');
  writeFileSync(target, JSON.stringify(patchAcademiaRows(JSON.parse(readFileSync(source, 'utf8'))), null, 2) + '\n', { flag: 'wx' });
  console.log('Propuesta local escrita. Revisar diff por slug; no se aplicó a ninguna base de datos.');
}
