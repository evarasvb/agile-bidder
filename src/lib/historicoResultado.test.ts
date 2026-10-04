import { describe, expect, it } from 'vitest';
import { admiteAnalisisHistorico, resultadoHistorico } from './historicoResultado';

const ahora = Date.parse('2026-10-03T12:00:00Z');
const lic = { tipo: 'licitacion', fecha_cierre: '2026-09-01T12:00:00Z', estado_award: 'active', ganador_nombre: 'Ganador fixture' };

describe('historial con resultados verificables', () => {
  it.each([false, null, true])('una participación futura no es una pérdida definitiva (%s)', (gano) => {
    expect(resultadoHistorico({ ...lic, fecha_cierre: '2026-10-04T12:00:00Z', gano }, true, ahora)).toBe('en_curso');
  });
  it.each([null, '', 'pending', 'cancelled', 'unsuccessful', 'desierta', 'estado desconocido', 'no adjudicada'])('award %s no confirma un resultado', (estado_award) => {
    expect(resultadoHistorico({ ...lic, estado_award, gano: false }, true, ahora)).toBe('pendiente_resultado');
  });
  it.each([null, '', 'fecha inválida'])('sin fecha de cierre verificable (%s) no se infiere pérdida', (fecha_cierre) => {
    expect(resultadoHistorico({ ...lic, fecha_cierre, gano: false }, true, ahora)).toBe('pendiente_resultado');
  });
  it('una adjudicación a otro ganador con participación real sí es pérdida', () => {
    expect(resultadoHistorico({ ...lic, gano: false }, true, ahora)).toBe('perdida');
  });
  it('gano nulo o sin ganador ajeno no demuestra pérdida', () => {
    expect(resultadoHistorico({ ...lic, gano: null }, true, ahora)).toBe('pendiente_resultado');
    expect(resultadoHistorico({ ...lic, gano: false, ganador_nombre: '' }, true, ahora)).toBe('pendiente_resultado');
  });
  it('ganadora adjudicada y cerrada conserva su resultado', () => {
    expect(resultadoHistorico({ ...lic, gano: true }, true, ahora)).toBe('ganada');
  });
  it('OC propia ganada conserva resultado sin award de licitación', () => {
    expect(resultadoHistorico({ tipo: 'convenio_marco', gano: true, fecha_cierre: lic.fecha_cierre }, true, ahora)).toBe('ganada');
  });
  it('abierta sin registro no afirma que no postuló', () => {
    expect(resultadoHistorico({ ...lic, fecha_cierre: '2026-10-04T12:00:00Z' }, false, ahora)).toBe('abierta');
  });
  it('no participación en licitación solo definitiva con cierre y ganador confirmados', () => {
    expect(resultadoHistorico(lic, false, ahora)).toBe('sin_tomar');
    expect(resultadoHistorico({ ...lic, estado_award: null }, false, ahora)).toBe('sin_registro');
  });
  it('compra ágil nunca acredita ausencia de postulación a partir de un match', () => {
    expect(resultadoHistorico({ ...lic, tipo: 'compra_agil' }, false, ahora)).toBe('sin_registro');
  });
  it('el cierre cambia estado abierto a desconocido, sin inventar pérdida', () => {
    const row = { ...lic, estado_award: null, fecha_cierre: '2026-10-03T12:00:00Z' };
    expect(resultadoHistorico(row, false, ahora - 1)).toBe('abierta');
    expect(resultadoHistorico(row, false, ahora)).toBe('sin_registro');
  });
  it.each(['en_curso', 'pendiente_resultado', 'abierta', 'sin_registro'] as const)('%s no habilita post-mortem de IA', (resultado) => {
    expect(admiteAnalisisHistorico(resultado)).toBe(false);
  });
});
