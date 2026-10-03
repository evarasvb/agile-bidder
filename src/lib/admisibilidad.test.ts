import { describe, expect, it } from 'vitest';
import { actualizarEntradaAdmisibilidad, confirmarEstadoAdmisibilidad, estadoAdmisibilidad, evaluarEntrada, formulaAdmisibilidad, numeroAdmisibilidad } from './admisibilidad';

describe('admisibilidad requiere verificación explícita', () => {
  it.each(['Certificado pendiente de obtener', 'Tengo certificado', 'NO', 'SÍ', '<b>cumple</b>'])('texto libre %s nunca acredita cumplimiento', (entrada) => {
    expect(evaluarEntrada({ entrada })).toBe('revisar');
    expect(estadoAdmisibilidad({ entrada, estado: 'cumple' })).toBe('revisar');
  });
  it('ausencia de dato sigue pendiente', () => expect(evaluarEntrada({ entrada: '' })).toBe('pendiente'));
  it.each(['texto', 'nuevo_tipo', undefined])('tipo %s no concede cumplimiento', (tipo) => {
    expect(evaluarEntrada({ entrada: '5', chequeo: { tipo, umbral: 1 } })).toBe('revisar');
  });
  it('si/no necesita valor esperado explícito', () => {
    expect(evaluarEntrada({ entrada: 'SÍ', chequeo: { tipo: 'si_no' } })).toBe('revisar');
    expect(evaluarEntrada({ entrada: 'SÍ', chequeo: { tipo: 'si_no', esperado: 'SÍ' } })).toBe('cumple');
    expect(evaluarEntrada({ entrada: 'NO', chequeo: { tipo: 'si_no', esperado: 'SÍ' } })).toBe('no_cumple');
  });
  it('mínimo, máximo y rango válidos pueden cumplir o incumplir', () => {
    expect(evaluarEntrada({ entrada: '4', chequeo: { tipo: 'minimo', umbral: 5 } })).toBe('no_cumple');
    expect(evaluarEntrada({ entrada: '5', chequeo: { tipo: 'minimo', umbral: 5 } })).toBe('cumple');
    expect(evaluarEntrada({ entrada: '5', chequeo: { tipo: 'maximo', umbral: 4 } })).toBe('no_cumple');
    expect(evaluarEntrada({ entrada: '5', chequeo: { tipo: 'rango', umbral: 4, umbral2: 6 } })).toBe('cumple');
    expect(evaluarEntrada({ entrada: '5', chequeo: { tipo: 'rango', umbral: 6, umbral2: 4 } })).toBe('revisar');
  });
  it.each(['pendiente', '3 años', 'sin certificado', 'NaN', 'Infinity', ''])('no extrae número de %s', (entrada) => {
    expect(numeroAdmisibilidad(entrada)).toBeNull();
    expect(evaluarEntrada({ entrada, chequeo: { tipo: 'maximo', umbral: 5 } })).not.toBe('cumple');
  });
  it('acepta números de formato chileno', () => {
    expect(numeroAdmisibilidad('1.234,5')).toBe(1234.5);
    expect(numeroAdmisibilidad('1,5')).toBe(1.5);
    expect(numeroAdmisibilidad(0)).toBe(0);
  });
  it('decisión humana se conserva para la entrada revisada y se invalida al cambiarla', () => {
    const row = confirmarEstadoAdmisibilidad({ entrada: 'Certificado verificado', estado: 'revisar' }, 'cumple');
    expect(estadoAdmisibilidad(row)).toBe('cumple');
    expect(estadoAdmisibilidad(actualizarEntradaAdmisibilidad(row, 'Certificado pendiente'))).toBe('revisar');
    expect(estadoAdmisibilidad(actualizarEntradaAdmisibilidad(row, ' Certificado verificado '))).toBe('cumple');
  });
  it('confirmación de cumple sin dato no suma admisibilidad', () => {
    expect(estadoAdmisibilidad(confirmarEstadoAdmisibilidad({ entrada: '' }, 'cumple'))).toBe('pendiente');
  });
  it.each(['no_cumple', 'no_aplica', 'verificar', 'estado_desconocido'])('conserva decisión previa %s', (estado) => {
    expect(estadoAdmisibilidad({ entrada: 'dato', estado })).toBe(estado);
  });
  it('Excel no convierte texto libre en cumplimiento', () => {
    expect(formulaAdmisibilidad({ entrada: 'Certificado pendiente' }, 'C5')).toBe('IF(C5="","PENDIENTE","REVISAR")');
  });
  it('Excel preserva revisión humana ligada al dato y escapa comillas', () => {
    const row = confirmarEstadoAdmisibilidad({ entrada: 'Certificado "v1"' }, 'cumple');
    expect(formulaAdmisibilidad(row, 'C5')).toContain('="Certificado ""v1""","CUMPLE"');
    expect(formulaAdmisibilidad(row, 'C5')).toContain('"REVISAR"');
  });
  it('Excel usa guardas numéricas y no acepta chequeo incompleto', () => {
    expect(formulaAdmisibilidad({ chequeo: { tipo: 'minimo', umbral: 5 } }, 'C5')).toContain('ISNUMBER(C5)');
    expect(formulaAdmisibilidad({ chequeo: { tipo: 'minimo' } }, 'C5')).not.toContain('"CUMPLE"');
  });
  it.each([['no_cumple', 'NO CUMPLE'], ['no_aplica', 'NO APLICA']])('Excel no pierde decisión %s al normalizar número chileno', (estado, label) => {
    const row = confirmarEstadoAdmisibilidad({ entrada: '1.234,5', chequeo: { tipo: 'minimo', umbral: 10 } }, estado);
    expect(formulaAdmisibilidad(row, 'C5')).toContain(`IF(AND(ISNUMBER(C5),C5=1234.5),"${label}"`);
    expect(formulaAdmisibilidad(row, 'C5')).not.toContain('"1.234,5"');
  });
});
