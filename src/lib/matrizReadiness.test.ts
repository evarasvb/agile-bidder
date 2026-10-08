/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. Software propietario. */
import { describe, expect, it } from 'vitest';
import { evaluarPreparacion, revisionPostulacion, sinAprobacion, type ReviewContext } from './matrizReadiness';

const now = Date.parse('2026-10-08T12:00:00Z');
export function syntheticReview(): ReviewContext {
  const context: ReviewContext = {
    codigo: '900001-1-LE26',
    bases: [{ id: 'synthetic-source', archivo: 'Bases 900001-1-LE26.pdf', creado_en: '2026-10-07T10:00:00Z' }],
    documentos: [], cierre: '2026-10-09T12:00:00Z', informe: 'Informe sintético', anexos: 'Anexos sintéticos', faltantes: [],
    matriz: {
      codigo: '900001-1-LE26', generada_en: '2026-10-07T11:00:00Z',
      admisibilidad: [{ requisito: 'Cantidad mínima', estado: 'cumple', fuente: 'Bases 900001-1-LE26, p. 3', entrada: 1, chequeo: { tipo: 'minimo', umbral: 1 } }],
      evaluacion: [{ criterio: 'Prueba', fuente: 'Bases, p. 4', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: 80 }],
    },
  };
  context.matriz!.aprobacion = { por: 'Revisor sintético', en: '2026-10-07T12:00:00Z', revision: revisionPostulacion(context) };
  return context;
}

describe('readiness tied to the current tender and revision', () => {
  it('allows a complete, documented, fresh synthetic package', () => {
    expect(evaluarPreparacion(syntheticReview(), now)).toMatchObject({ fresh: true, sameTender: true, admissible: true, score: { complete: true, total: 80 }, open: true, approvalCurrent: true, warnings: [] });
  });
  it('does not count empty or unknown requirements as complete', () => {
    for (const rows of [[], [{ estado: 'verificar' }], [{ estado: 'inventado' }]]) {
      const c = syntheticReview(); c.matriz!.admisibilidad = rows;
      expect(evaluarPreparacion(c, now).admissible).toBe(false);
    }
  });
  it('invalidates approval after content, source, deadline, or annex changes', () => {
    const variants = [
      (c: ReviewContext) => { c.matriz!.admisibilidad![0].entrada = 2; },
      (c: ReviewContext) => { c.bases[0].id = 'different-source'; },
      (c: ReviewContext) => { c.cierre = '2026-10-10T12:00:00Z'; },
      (c: ReviewContext) => { c.anexos = 'Otro anexo'; },
      (c: ReviewContext) => { c.faltantes = ['Dato pendiente']; },
    ];
    for (const change of variants) { const c = syntheticReview(); change(c); expect(evaluarPreparacion(c, now).approvalCurrent).toBe(false); }
    expect(sinAprobacion(syntheticReview().matriz!).aprobacion).toBeUndefined();
  });
  it('keeps approval across jsonb object-key reordering', () => {
    const c = syntheticReview();
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reorder(v)])) : value;
    const roundTripped = JSON.parse(JSON.stringify(reorder(c))) as ReviewContext;
    expect(evaluarPreparacion(roundTripped, now).approvalCurrent).toBe(true);
  });
  it('does not treat suffixes as the same tender', () => {
    const c = syntheticReview(); c.bases[0].archivo = 'Bases 1-1-LE26.pdf';
    expect(evaluarPreparacion(c, now).sameTender).toBe(false);
  });
  it('keeps legacy and invalid timestamps under review', () => {
    for (const en of [undefined, 'invalid', '2026-10-06T12:00:00Z', '2026-10-10T12:00:00Z']) {
      const c = syntheticReview(); c.matriz!.aprobacion!.en = en;
      expect(evaluarPreparacion(c, now).approvalCurrent).toBe(false);
    }
    const c = syntheticReview(); delete c.matriz!.aprobacion!.revision;
    expect(evaluarPreparacion(c, now).approvalCurrent).toBe(false);
  });
  it('requires regeneration freshness after newer sources, even after another approval', () => {
    const c = syntheticReview(); c.bases[0].creado_en = '2026-10-07T11:30:00Z';
    c.matriz!.aprobacion!.revision = revisionPostulacion(c);
    expect(evaluarPreparacion(c, now)).toMatchObject({ fresh: false, approvalCurrent: false, admissible: false });
  });
  it('blocks a foreign matrix or filename without pretending names prove provenance', () => {
    const c = syntheticReview(); c.matriz!.codigo = '900002-2-LE26';
    expect(evaluarPreparacion(c, now).sameTender).toBe(false);
    const d = syntheticReview(); d.bases[0].archivo = 'PDF900002-2-LE26.pdf';
    expect(evaluarPreparacion(d, now).sameTender).toBe(false);
  });
  it('closes at the exact deadline instead of rounding up to zero days', () => {
    const c = syntheticReview(); c.cierre = '2026-10-08T11:59:59Z';
    expect(evaluarPreparacion(c, now).open).toBe(false);
  });
});
