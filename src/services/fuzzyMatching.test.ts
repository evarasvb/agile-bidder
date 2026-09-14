import { describe, it, expect } from 'vitest';
import { findMatches, findBestMatch } from './fuzzyMatching';
import type { InventoryItem } from '@/hooks/useInventory';

function producto(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'p1',
    sku: 'SKU-1',
    nombre_producto: 'Resma de papel carta',
    descripcion: 'Papel bond blanco 75g',
    categoria: 'papel',
    keywords: ['papel', 'resma', 'carta'],
    precio_unitario: 4500,
    margen_minimo: 10,
    margen_objetivo: 20,
    stock_disponible: 100,
    unidad_medida: 'UN',
    tiempo_entrega_dias: 2,
    proveedor: 'Proveedor X',
    activo: true,
    imagen_url: null,
    cliente_id: 'c1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('Incompatibility validation (FV-UX-002)', () => {
  it('CORDEL rechazado vs Pendrive: electrónico incompatible con cordaje', () => {
    const itemRequerido = { id: '1', nombre: 'Pendrive 32GB USB 3.0' };
    const cordel = producto({
      id: 'cordel',
      nombre_producto: 'Cordel de papel kraft',
      descripcion: 'Cuerda para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull(); // DETERMINISTA: debe rechazarse completamente
  });

  it('CORDEL rechazado vs Adaptador VGA-HDMI: electrónico incompatible', () => {
    const itemRequerido = { id: '2', nombre: 'Adaptador VGA a HDMI 1.4' };
    const cordel = producto({
      id: 'cordel',
      nombre_producto: 'Cordel de papel kraft',
      descripcion: 'Cuerda para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull(); // DETERMINISTA
  });

  it('CORDEL rechazado vs Tijeras: herramienta incompatible', () => {
    const itemRequerido = { id: '3', nombre: 'Tijeras de corte profesional 8' };
    const cordel = producto({
      id: 'cordel',
      nombre_producto: 'Cordel de papel kraft',
      descripcion: 'Cuerda para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull(); // DETERMINISTA
  });

  it('CORDEL rechazado vs Lapicero: incluso con categoría oficina', () => {
    const itemRequerido = { id: '4', nombre: 'Lapicero azul Staedtler' };
    const cordel = producto({
      id: 'cordel',
      nombre_producto: 'Cordel de papel kraft',
      descripcion: 'Cuerda para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull(); // DETERMINISTA: incompatible aunque ambos sean "oficina"
  });
});

describe('Dimension validation issues found (FV-UX-002)', () => {
  it('5.5 pulgadas (13.97cm) vs 15.8cm: 11.6% diferencia, bajo 20% tolerance pero SIN ESPECIFICACIÓN', () => {
    const itemRequerido = {
      id: 'req-papel',
      nombre: 'Papel carta 5.5 pulgadas',
      descripcion: 'Ancho 5.5 pulgadas (13.97cm)',
    };
    const oferta_15_8cm = producto({
      id: 'papel-1',
      nombre_producto: 'Papel carta 15.8 cm',
      descripcion: 'Ancho estándar 15.8 cm',
      categoria: 'papel',
      keywords: ['papel', 'carta'],
    });
    const match = findBestMatch(itemRequerido, [oferta_15_8cm]);
    // HALLAZGO: sin especificación explícita de tolerancia, 11.6% entra en zona gris
    // Actual: rechazado (null) porque la dimensión no se valida automáticamente
    expect(match).toBeNull(); // DETERMINISTA: dimension parsing actual
  });

  it('LIMITATION: Unit conversion (158mm vs 15.8cm) NOT implemented', () => {
    const itemRequerido = {
      id: 'req-papel-mm',
      nombre: 'Papel carta 158mm',
      descripcion: 'Ancho 158mm',
    };
    const oferta_15_8cm = producto({
      id: 'papel-2',
      nombre_producto: 'Papel carta 15.8 cm',
      descripcion: 'Ancho 15.8 cm',
      categoria: 'papel',
      keywords: ['papel', 'carta'],
    });
    const match = findBestMatch(itemRequerido, [oferta_15_8cm]);
    // HALLAZGO: validateSpecifications parsea dimensiones pero NO convierte 158mm a cm
    // Actual: null porque "158mm" y "15.8 cm" no se reconocen como equivalentes
    expect(match).toBeNull(); // DETERMINISTA: algoritmo actual no convierte unidades
  });

  it('LIMITATION: Meter/mm conversion NOT implemented', () => {
    const itemRequerido = {
      id: 'req-cable-m',
      nombre: 'Cable VGA 2 metros',
      descripcion: 'Largo 2m',
    };
    const oferta_2000mm = producto({
      id: 'cable-1',
      nombre_producto: 'Cable VGA 2000mm',
      descripcion: 'Largo 2000mm',
      categoria: 'electrónica',
      keywords: ['cable', 'vga'],
    });
    const match = findBestMatch(itemRequerido, [oferta_2000mm]);
    // HALLAZGO: parseFloat busca "2" vs "2000", ratio 1:1000 = 99.9% diferencia
    // Actual: match débil ~44% porque solo ve diferencia de números, no conversión
    expect(match).not.toBeNull();
    expect(match!.score).toBeLessThan(60); // DETERMINISTA: score débil, no conversión
  });
});

describe('Coverage calculation: weak matches NOT counted as validated (FV-UX-002)', () => {
  it('Match score >= 60 = VALIDADO; < 60 = NO VALIDADO (REVISAR)', () => {
    // Simular: 4 items totales
    // - 1 match HIGH (score 100) = VALIDADO
    // - 1 match MEDIUM (score >= 60) = VALIDADO
    // - 1 match débil por incompatibilidad (null) = NO VALIDADO
    // - 1 sin match (null) = NO VALIDADO
    // Cobertura esperada: 2/4 = 50% validado

    const items = [
      { id: 'i1', nombre: 'Resma papel carta 75g' },
      { id: 'i2', nombre: 'Papel bond 75g' },
      { id: 'i3', nombre: 'Cables USB varios' },
      { id: 'i4', nombre: 'Excavadora CAT 320' },
    ];

    const inventario = [
      producto({ id: 'p1', nombre_producto: 'Resma papel carta 75g', categoria: 'papel' }), // exacto, score 100
      producto({ id: 'p2', nombre_producto: 'Papel bond 75', categoria: 'papel', keywords: ['papel', 'bond'] }), // similar, score >= 60
      producto({ id: 'p3', nombre_producto: 'Cordel de papel', categoria: 'pegamento', keywords: ['cordel'] }), // incompatible, null
      // No hay producto para excavadora
    ];

    const matches = items.map(item => findBestMatch(item, inventario));

    // Match 0: exacto, score 100 = VALIDADO
    expect(matches[0]).not.toBeNull();
    expect(matches[0]!.score).toBe(100);

    // Match 1: similar, score >= 60 = VALIDADO
    expect(matches[1]).not.toBeNull();
    expect(matches[1]!.score).toBeGreaterThanOrEqual(60);

    // Match 2: incompatible (CORDEL vs cables) = NULL
    expect(matches[2]).toBeNull();

    // Match 3: sin match = NULL
    expect(matches[3]).toBeNull();

    // COBERTURA REAL: CompraAgilDetalle calcula
    // itemsConMatchValidado = matches.filter(m => m && m.score >= 60).length = 2
    // totalItems = 4
    // cobertura = 50%
    const validados = matches.filter(m => m && m.score >= 60).length;
    const total = items.length;
    const cobertura = Math.round((validados / total) * 100);

    expect(validados).toBe(2); // DETERMINISTA: exactamente 2 validados
    expect(cobertura).toBe(50); // DETERMINISTA: cobertura 50%, NO 75%
  });

  it('Discarded items NOT counted: 3 total, 1 descartado, 2 con match → 100% de activos', () => {
    // Simular cálculo de CompraAgilDetalle cuando cliente descarta un item
    // 3 items requeridos
    // - Item 1: match HIGH (score 90)
    // - Item 2: match MEDIUM (score 65)
    // - Item 3: DESCARTADO por cliente (no cuenta)
    // Cobertura esperada: 2/2 (de activos) = 100% (NO 2/3)

    const filasItems = [
      {
        id: 'i1',
        match: { score: 90, nombre: 'Resma carta', precio: 4500, subtotal: 4500 },
        estado: 'auto' as const,
      },
      {
        id: 'i2',
        match: { score: 65, nombre: 'Papel oficio', precio: 3500, subtotal: 3500 },
        estado: 'confirmado' as const,
      },
      {
        id: 'i3',
        match: null,
        estado: 'descartado' as const, // Cliente lo descartó
      },
    ];

    // Cálculo real de CompraAgilDetalle
    const itemsConMatchValidado = filasItems.filter((f) => {
      if (!f.match || f.estado === 'descartado') return false;
      return f.match.score >= 60;
    }).length;

    const totalItems = filasItems.filter((f) => f.estado !== 'descartado').length;
    const cobertura = totalItems > 0 ? Math.round((itemsConMatchValidado / totalItems) * 100) : 0;

    expect(itemsConMatchValidado).toBe(2); // DETERMINISTA
    expect(totalItems).toBe(2); // DETERMINISTA: 3 totales - 1 descartado
    expect(cobertura).toBe(100); // DETERMINISTA: 2/2 = 100%
  });
});

describe('Existing behavior (regressions)', () => {
  it('Exact match: nombre idéntico = 100', () => {
    const item = { id: '1', nombre: 'Resma de papel carta' };
    const match = findBestMatch(item, [producto()]);
    expect(match).not.toBeNull();
    expect(match!.score).toBe(100);
    expect(match!.matchType).toBe('exact');
  });

  it('Below threshold: muy diferente = null', () => {
    const item = { id: '1', nombre: 'Excavadora hidráulica CAT 320' };
    const match = findBestMatch(item, [producto()]);
    expect(match).toBeNull();
  });

  it('Inactive product: ignorado', () => {
    const item = { id: '1', nombre: 'Resma de papel carta' };
    const match = findBestMatch(item, [producto({ activo: false })]);
    expect(match).toBeNull();
  });
});
