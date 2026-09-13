import { describe, expect, it } from 'vitest';
import { evaluarCompletitudExpediente, extraerDecisionLegacy } from './expertoDecision';

describe('evaluarCompletitudExpediente', () => {
  it('impide un veredicto definitivo si faltan las bases de una licitación', () => {
    const r = evaluarCompletitudExpediente({
      tipoProceso: 'licitacion',
      ficha: 'completa',
      items: 'completa',
      bases: 'faltante',
      anexos: 'pendiente',
    });
    expect(r.nivel).toBe('insuficiente');
    expect(r.puedeEmitirVeredictoDefinitivo).toBe(false);
    expect(r.faltantesCriticos).toContain('bases vigentes faltantes');
  });

  it('hace visible un bloqueo de anexos', () => {
    const r = evaluarCompletitudExpediente({
      tipoProceso: 'licitacion',
      ficha: 'completa',
      items: 'completa',
      bases: 'completa',
      anexos: 'bloqueada',
    });
    expect(r.puedeEmitirVeredictoDefinitivo).toBe(false);
    expect(r.faltantesCriticos).toContain('anexos bloqueados');
  });

  it('puede verificar un expediente completo', () => {
    const r = evaluarCompletitudExpediente({
      tipoProceso: 'licitacion',
      ficha: 'completa',
      items: 'completa',
      bases: 'completa',
      anexos: 'completa',
      aclaraciones: 'completa',
      modificaciones: 'completa',
      historial: 'completa',
      noticias: 'completa',
    });
    expect(r.porcentaje).toBe(100);
    expect(r.nivel).toBe('verificado');
    expect(r.puedeEmitirVeredictoDefinitivo).toBe(true);
  });

  it('no exige bases a una Compra Ágil', () => {
    const r = evaluarCompletitudExpediente({
      tipoProceso: 'compra_agil',
      ficha: 'completa',
      items: 'completa',
      historial: 'completa',
      noticias: 'completa',
    });
    expect(r.faltantesCriticos).not.toContain('bases vigentes faltantes');
    expect(r.puedeEmitirVeredictoDefinitivo).toBe(true);
    expect(r.porcentaje).toBe(100);
  });
});

describe('extraerDecisionLegacy', () => {
  it('mantiene compatibilidad con un informe positivo', () => {
    expect(extraerDecisionLegacy('Veredicto: Sí, vale la pena postular.').decision).toBe('participar');
  });

  it('prioriza las reservas antes de una coincidencia positiva', () => {
    expect(extraerDecisionLegacy('Veredicto: Sí, pero con reservas.').decision).toBe('participar_con_reservas');
  });

  it('no inventa una decisión cuando no existe veredicto', () => {
    expect(extraerDecisionLegacy('Resumen de antecedentes disponibles.').decision).toBeNull();
  });
});
