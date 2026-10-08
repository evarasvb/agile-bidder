/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. Software propietario. */
import { describe, expect, it } from 'vitest';
import { admisibilidadResuelta, estadoAdmisibilidad, evaluarEntrada, evaluarPuntaje, numeroMatriz, ponderacionMatriz, revisarRequisito, type Requirement } from './matrizValidation';

describe('matrix numeric evidence', () => {
  it.each([0, '0', '0.001', '0,001', '-0.001', '12.25', '12,25', '1.000,25', '1,000.25', '1.000.000'])('parses explicit numeric value %s', value => {
    const expected = { '0': 0, '0.001': .001, '0,001': .001, '-0.001': -.001, '12.25': 12.25, '12,25': 12.25, '1.000,25': 1000.25, '1,000.25': 1000.25, '1.000.000': 1000000 };
    expect(numeroMatriz(value)).toBe(expected[String(value) as keyof typeof expected]);
  });
  it.each([null, undefined, '', ' ', false, 'no informado', '1.000', '1,000', '2 a 4', '>=5', '3 días', '10%', '1.2.3', Infinity])('keeps missing/ambiguous value %s unknown', value => expect(numeroMatriz(value)).toBeNull());
  it('does not silently promote a small decimal to the minimum', () => {
    expect(evaluarEntrada({ entrada: '0.001', chequeo: { tipo: 'minimo', umbral: 1 } })).toBe('no_cumple');
  });
  it('distinguishes zero from missing input and missing threshold', () => {
    expect(evaluarEntrada({ entrada: 0, chequeo: { tipo: 'minimo', umbral: 0 } })).toBe('cumple');
    expect(evaluarEntrada({ entrada: '', chequeo: { tipo: 'minimo', umbral: 0 } })).toBe('pendiente');
    expect(evaluarEntrada({ entrada: 0, chequeo: { tipo: 'minimo' } })).toBe('revisar');
    expect(evaluarEntrada({ entrada: 'no informado', chequeo: { tipo: 'maximo', umbral: 1 } })).toBe('revisar');
  });
  it('requires documented yes/no expectations and accepts normalized SI/SÍ', () => {
    for (const value of [' SI ', 'sí', 'SÍ']) expect(evaluarEntrada({ entrada: value, chequeo: { tipo: 'si_no', esperado: ' SÍ ' } })).toBe('cumple');
    expect(evaluarEntrada({ entrada: 'SÍ', chequeo: { tipo: 'si_no' } })).toBe('revisar');
    expect(evaluarEntrada({ entrada: 'NO', chequeo: { tipo: 'si_no', esperado: 'SÍ' } })).toBe('no_cumple');
    expect(evaluarEntrada({ entrada: 'quizás', chequeo: { tipo: 'si_no', esperado: 'SÍ' } })).toBe('revisar');
  });
  it('requires a valid ordered range and never auto-accepts text/unknown checks', () => {
    expect(evaluarEntrada({ entrada: 3, chequeo: { tipo: 'rango', umbral: 2, umbral2: 4 } })).toBe('cumple');
    expect(evaluarEntrada({ entrada: 3, chequeo: { tipo: 'rango', umbral: 4, umbral2: 2 } })).toBe('revisar');
    for (const chequeo of [undefined, { tipo: 'texto' }, { tipo: 'unknown' }]) expect(evaluarEntrada({ entrada: 'Entregado', chequeo })).toBe('revisar');
  });
});

describe('explicit manual review', () => {
  const textual: Requirement = { requisito: 'Documento de prueba', entrada: 'Revisado por la empresa', fuente: 'Bases de prueba, página 3', chequeo: { tipo: 'texto' }, estado: 'cumple' };
  it('keeps legacy automatic text compliance under review', () => expect(estadoAdmisibilidad(textual)).toBe('revisar'));
  it.each(['cumple', 'ok', 'no_aplica', 'solo_si_adjudica'])('accepts explicit documented manual disposition %s', state => {
    const reviewed = revisarRequisito(textual, state);
    expect(estadoAdmisibilidad(reviewed)).toBe(state);
    expect(admisibilidadResuelta(reviewed)).toBe(true);
    for (const key of ['entrada', 'regla', 'fuente', 'nota']) expect(admisibilidadResuelta({ ...reviewed, [key]: 'Changed' })).toBe(false);
  });
  it('does not approve absent evidence or unknown/verificar states', () => {
    expect(admisibilidadResuelta(revisarRequisito({ ...textual, fuente: '' }, 'cumple'))).toBe(false);
    for (const estado of [undefined, 'verificar', 'unknown', 'no_aplica']) expect(admisibilidadResuelta({ ...textual, estado })).toBe(false);
  });
});

describe('complete weighted scores', () => {
  const criterion = { criterio: 'Prueba', fuente: 'Bases, página 4', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: 0 };
  it('distinguishes one percent and a fractional full weight', () => {
    expect(ponderacionMatriz({ ponderacion: '1%' })).toBe(.01);
    expect(ponderacionMatriz({ ponderacion_num: 1 })).toBe(1);
  });
  it('accepts a complete score of zero', () => expect(evaluarPuntaje([criterion])).toEqual({ complete: true, total: 0 }));
  it('hides the aggregate for missing or invalid evidence', () => {
    expect(evaluarPuntaje([]).total).toBeNull();
    for (const changes of [{ fuente: '' }, { puntaje_estimado: '' }, { puntaje_estimado: 'no informado' }, { puntaje_estimado: 101 }, { puntaje_max: undefined }, { ponderacion: '50%' }]) expect(evaluarPuntaje([{ ...criterion, ...changes }]).total).toBeNull();
  });
});
