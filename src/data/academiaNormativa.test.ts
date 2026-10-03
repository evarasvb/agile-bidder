// © 2024-2026 Firma VB SpA. Todos los derechos reservados.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CURSOS } from './academiaCursos';
import { ACADEMIA_NORMATIVA as copy, ACADEMIA_FUENTES as sources, ACADEMIA_REEMPLAZOS } from '../../supabase/functions/_shared/academia-normativa';
import { patchAcademiaRows } from '../../scripts/academia-normativa-preview';

describe('Academia: reglas de compra y pago verificadas 2026-10-03', () => {
  const course = CURSOS.find(c => c.slug === 'vende-al-estado-desde-cero')!;
  it('mantiene seis lecciones y corrige todos los mensajes auditados', () => {
    expect(course.modulos.flatMap(m => m.lecciones)).toHaveLength(6);
    const text = JSON.stringify(course);
    for (const value of Object.values(copy)) expect(text).toContain(value);
    for (const old of Object.keys(ACADEMIA_REEMPLAZOS)) expect(text).not.toContain(old);
    expect(copy.compraAgil).toContain('100 UTM inclusive');
    expect(copy.compraAgil).toContain('aunque se reciban menos');
    expect(copy.pago).toContain('desde la recepción');
    expect(copy.pago).toContain('no garantiza el pago efectivo');
  });
  it('expone enlaces oficiales fechados con bloques ya soportados', () => {
    const blocks = course.modulos.flatMap(m => m.lecciones.flatMap(l => l.bloques));
    for (const source of sources) {
      expect(blocks).toContainEqual(source);
      expect(new URL(source.url).protocol).toBe('https:');
      expect(source.texto).toContain('03-10-2026');
    }
    expect(sources.map(s => new URL(s.url).hostname)).toEqual(['www.bcn.cl', 'www.chilecompra.cl']);
  });
  it('corrige el respaldo premium y conserva la prioridad de DB', () => {
    const edge = readFileSync('supabase/functions/academia-premium/index.ts', 'utf8');
    for (const key of ['fueraSistema','compraAgil','licitacion','pago','utm']) expect(edge).toContain(`ACADEMIA_NORMATIVA.${key}`);
    expect(edge).toContain('return data?.modulos ?? CONTENIDO[slug]');
    for (const old of Object.keys(ACADEMIA_REEMPLAZOS)) expect(edge).not.toContain(old);
  });
  it('parchea exportación exacta, conserva otros cursos, es idempotente y no muta el original', () => {
    const fixture = [{slug:'programa-pro-adjudica-al-estado', modulos:[{titulo:'Módulo',lecciones:[{titulo:'Lección',bloques:[{tipo:'lista',items:Object.keys(ACADEMIA_REEMPLAZOS)}]}]}]}, {slug:'otro-curso',modulos:[]}];
    const before = JSON.stringify(fixture);
    const result = patchAcademiaRows(fixture) as typeof fixture;
    expect(JSON.stringify(fixture)).toBe(before);
    expect(result[1]).toEqual(fixture[1]);
    expect(patchAcademiaRows(result)).toEqual(result);
    for (const value of Object.values(copy)) expect(JSON.stringify(result[0])).toContain(value);
    expect(result[0].modulos[0].lecciones[0].bloques).toHaveLength(3);
    expect(() => patchAcademiaRows({})).toThrow();
  });
});
