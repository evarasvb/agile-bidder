import { describe, it, expect } from 'vitest';
import { calidadCalce, coberturaCalce, etiquetaCalce, PISO_CALCE } from './calceOportunidad';

describe('calidadCalce', () => {
  it('promedia y redondea', () => {
    expect(calidadCalce([80, 90])).toBe(85);
    expect(calidadCalce([46.9])).toBe(47);
  });

  it('devuelve null sin datos, que no es lo mismo que cero', () => {
    expect(calidadCalce([])).toBeNull();
    expect(calidadCalce([Number.NaN])).toBeNull();
  });
});

describe('coberturaCalce', () => {
  it('calcula el porcentaje de ítems con candidato', () => {
    expect(coberturaCalce(19, 20)).toBe(95);
    expect(coberturaCalce(32, 32)).toBe(100);
  });

  it('devuelve null cuando no hay con qué dividir', () => {
    expect(coberturaCalce(0, 10)).toBeNull();
    expect(coberturaCalce(3, 0)).toBeNull();
  });
});

describe('etiquetaCalce', () => {
  // El caso real que motivó el cambio: "Adquisición Cinturones Táctico Color
  // Negro", 1 ítem pedido, 1 candidato ("TINTA PARA TAMPON NEGRO") con score
  // 46,9. El panel lo mostraba como "100% match".
  it('no anuncia 100% cuando la calidad es mediocre', () => {
    const e = etiquetaCalce({ calidad: 47, itemsMatched: 1, itemsCount: 1 });
    expect(e?.texto).toBe('47% calce · 1/1 ítems');
    expect(e?.texto).not.toContain('100');
    expect(e?.tono).toBe(47);
  });

  it('un calce bueno y amplio se ve bueno y amplio', () => {
    const e = etiquetaCalce({ calidad: 92, itemsMatched: 12, itemsCount: 13 });
    expect(e?.texto).toBe('92% calce · 12/13 ítems');
    expect(e?.confiable).toBe(true);
  });

  it('sin calidad medida informa cobertura sin disfrazarla de match', () => {
    const e = etiquetaCalce({ calidad: null, itemsMatched: 3, itemsCount: 3 });
    expect(e?.texto).toBe('3/3 ítems con candidato');
    expect(e?.confiable).toBe(false);
  });

  it('calidad bajo el piso no se presenta como calce confiable', () => {
    const e = etiquetaCalce({ calidad: PISO_CALCE - 1, itemsMatched: 2, itemsCount: 4 });
    expect(e?.confiable).toBe(false);
    expect(e?.texto).toBe('2/4 ítems con candidato');
  });

  it('sin ítems no inventa una insignia', () => {
    expect(etiquetaCalce({ calidad: null, itemsMatched: 0, itemsCount: 0 })).toBeNull();
  });

  // La cobertura sola nunca debe producir un número grande con "%" pegado:
  // ese era exactamente el engaño.
  it('la cobertura nunca se muestra como porcentaje de calce', () => {
    const e = etiquetaCalce({ calidad: null, itemsMatched: 1, itemsCount: 1 });
    expect(e?.texto).not.toMatch(/100%/);
  });
});
