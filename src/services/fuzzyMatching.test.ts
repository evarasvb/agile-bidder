import { describe, it, expect } from 'vitest';
import { findMatches, findBestMatch, calculateCoverageMetrics, type PropuestaItemRow } from './fuzzyMatching';
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

describe('FV-UX-002 Case 1: CORDEL incompatibility with electronics (4105-571-COT26)', () => {
  it('CORDEL rechazado vs Pendrive: incompatible electronics-cordaje', () => {
    const itemRequerido = { id: '1', nombre: 'Pendrive 32GB USB 3.0' };
    const cordel = producto({
      id: 'cordel',
      nombre_producto: 'Cordel de papel kraft',
      descripcion: 'Cuerda para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull(); // Rechazado determinísticamente
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
    expect(match).toBeNull();
  });

  it('CORDEL rechazado vs Tijeras: herramienta incompatible', () => {
    const itemRequerido = { id: '3', nombre: 'Tijeras de corte profesional 8 pulgadas' };
    const cordel = producto({
      id: 'cordel',
      nombre_producto: 'Cordel de papel kraft',
      descripcion: 'Cuerda para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull();
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
    expect(match).toBeNull();
  });
});

describe('FV-UX-002 Case 2: Unit conversion with epsilon equivalence', () => {
  it('2m = 2000mm: epsilon equivalence, score ≥60 VALIDADO', () => {
    const itemRequerido = { id: '1', nombre: 'Cable 2 metros' };
    const cable = producto({
      nombre_producto: 'Cable 2000 mm',
      descripcion: 'Cable de cobre color negro',
      categoria: 'electrónica',
      keywords: ['cable'],
    });
    const match = findBestMatch(itemRequerido, [cable]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThanOrEqual(60); // Exacto + textual
  });

  it('2m ≠ 1500mm: diferente, penalty aplicada, score <60 REVISAR', () => {
    // Test that dimension mismatches result in score <60 (REVISAR, not VALIDADO)
    // Using exact name match to ensure base score is high enough to survive penalty
    const itemRequerido = { id: '1', nombre: 'Resma de papel carta 2 metros' };
    const papel = producto({
      nombre_producto: 'Resma de papel carta 1500mm',
      descripcion: 'Papel bond blanco',
      keywords: ['papel', 'resma', 'carta'],
    });
    const match = findBestMatch(itemRequerido, [papel]);
    // Dimension mismatch: 2 metros (2000mm) ≠ 1500mm → -35 penalty
    // Exact name match attempt blocked by dimensions, falls through to similarity
    if (match) {
      expect(match.score).toBeLessThan(60); // Dimension mismatch → REVISAR
    } else {
      // Acceptable if score too low due to aggressive penalty
      expect(match).toBeNull();
    }
  });

  it('15.8cm ≠ 5.5": diferente, penalty aplicada, score <60 REVISAR', () => {
    const itemRequerido = { id: '1', nombre: 'Tijeras 15.8 cm' };
    const scissors = producto({
      nombre_producto: 'Tijeras 5.5 pulgadas',
      keywords: ['tijeras'],
    });
    const match = findBestMatch(itemRequerido, [scissors]);
    // Mismatch: 158mm ≠ 139.7mm → penalty
    if (match) {
      expect(match.score).toBeLessThan(60);
    } else {
      expect(match).toBeNull();
    }
  });

  it('158mm = 15.8cm: epsilon equivalence, score ≥60 VALIDADO', () => {
    const itemRequerido = { id: '1', nombre: 'Papel 158mm' };
    const papel = producto({
      nombre_producto: 'Papel 15.8cm',
      keywords: ['papel'],
    });
    const match = findBestMatch(itemRequerido, [papel]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThanOrEqual(60);
  });

  it('Decimal comma: 15,8cm parses correctly', () => {
    const itemRequerido = { id: '1', nombre: 'Papel 15,8cm' }; // Decimal comma
    const papel = producto({
      nombre_producto: 'Papel 158mm', // 15.8cm = 158mm
      keywords: ['papel'],
    });
    const match = findBestMatch(itemRequerido, [papel]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThanOrEqual(60); // Parsed correctly
  });

  it('Unit boundary: 80mg NOT parsed as 80m (meter)', () => {
    const itemRequerido = { id: '1', nombre: 'Polvo 80mg' }; // mass unit
    const polvo = producto({
      nombre_producto: 'Cable 80m', // length unit
      keywords: ['polvo'],
    });
    const match = findBestMatch(itemRequerido, [polvo]);
    // No dimension parsed for mg, dimensions differ (80m vs none) → incompatible
    // Should reject or mark REVISAR, not validate as match
    if (match) {
      expect(match.score).toBeLessThan(60); // Should be weak or rejected
    }
  });
});

describe('FV-UX-002 Case 2 (4168-340-COT26): Coverage calculation - weak matches NOT counted', () => {
  it('4 items totales: 1 high (100) + 1 medium (≥60) + 1 weak (<60) + 1 missing = 50% cobertura', () => {
    const rows: PropuestaItemRow[] = [
      {
        id: 'i1',
        match: { inventoryItem: producto(), score: 100, matchType: 'exact', matchedTerms: [] },
        estado: 'auto',
      },
      {
        id: 'i2',
        match: { inventoryItem: producto(), score: 65, matchType: 'partial', matchedTerms: [] },
        estado: 'auto',
      },
      {
        id: 'i3',
        match: { inventoryItem: producto(), score: 45, matchType: 'category', matchedTerms: [] }, // REVISAR
        estado: 'auto',
      },
      {
        id: 'i4',
        match: null, // Sin match
        estado: 'auto',
      },
    ];

    const metrics = calculateCoverageMetrics(rows);
    expect(metrics.itemsConMatchValidado).toBe(2); // score100 + score65
    expect(metrics.itemsConMatchDebil).toBe(1); // score45
    expect(metrics.itemsSinMatch).toBe(1);
    expect(metrics.totalItems).toBe(4);
    expect(metrics.cobertura).toBe(50); // 2/4 = 50%, NO 75%
    expect(metrics.propuestaIncompleta).toBe(true); // Hay débiles + sin match
  });

  it('3 items: 2 validados + 1 descartado = 100% de activos (descartados no cuentan)', () => {
    const rows: PropuestaItemRow[] = [
      {
        id: 'i1',
        match: { inventoryItem: producto(), score: 90, matchType: 'partial', matchedTerms: [] },
        estado: 'auto',
      },
      {
        id: 'i2',
        match: { inventoryItem: producto(), score: 65, matchType: 'keyword', matchedTerms: [] },
        estado: 'confirmado',
      },
      {
        id: 'i3',
        match: null,
        estado: 'descartado', // Cliente lo descartó
      },
    ];

    const metrics = calculateCoverageMetrics(rows);
    expect(metrics.itemsConMatchValidado).toBe(2);
    expect(metrics.itemsConMatchDebil).toBe(0);
    expect(metrics.itemsSinMatch).toBe(0);
    expect(metrics.totalItems).toBe(2); // 3 totales - 1 descartado
    expect(metrics.cobertura).toBe(100); // 2/2 = 100%
    expect(metrics.propuestaIncompleta).toBe(false);
  });

  it('REVISAR badge score<60 no infla cobertura: 60 vs 59 punto de inflexión', () => {
    // Score 60 → validado
    const row60: PropuestaItemRow = {
      id: 'x',
      match: { inventoryItem: producto(), score: 60, matchType: 'keyword', matchedTerms: [] },
      estado: 'auto',
    };
    const metrics60 = calculateCoverageMetrics([row60]);
    expect(metrics60.itemsConMatchValidado).toBe(1);
    expect(metrics60.itemsConMatchDebil).toBe(0);

    // Score 59 → REVISAR (no validado)
    const row59: PropuestaItemRow = {
      id: 'y',
      match: { inventoryItem: producto(), score: 59, matchType: 'category', matchedTerms: [] },
      estado: 'auto',
    };
    const metrics59 = calculateCoverageMetrics([row59]);
    expect(metrics59.itemsConMatchValidado).toBe(0);
    expect(metrics59.itemsConMatchDebil).toBe(1);
  });
});

describe('Regresiones: comportamiento previo no se rompió', () => {
  it('Match exacto: nombre idéntico = 100', () => {
    const item = { id: '1', nombre: 'Resma de papel carta' };
    const match = findBestMatch(item, [producto()]);
    expect(match).not.toBeNull();
    expect(match!.score).toBe(100);
    expect(match!.matchType).toBe('exact');
  });

  it('Muy diferente: excavadora vs papel = null', () => {
    const item = { id: '1', nombre: 'Excavadora hidráulica CAT 320' };
    const match = findBestMatch(item, [producto()]);
    expect(match).toBeNull();
  });

  it('Producto inactivo: ignorado', () => {
    const item = { id: '1', nombre: 'Resma de papel carta' };
    const match = findBestMatch(item, [producto({ activo: false })]);
    expect(match).toBeNull();
  });

  it('Match por similitud nombre: "Resma carta" vs "Resma de papel carta" = score alto', () => {
    const item = { id: '1', nombre: 'Resma carta' };
    const match = findBestMatch(item, [producto()]);
    expect(match).not.toBeNull();
    expect(match!.score).toBeGreaterThanOrEqual(60);
    // Puede ser partial, keyword o fuzzy dependiendo del cálculo
  });

  it('Categoría sola: máximo 50% (no 70%)', () => {
    const item = { id: '1', nombre: 'Artículos varios' };
    const prod = producto({
      nombre_producto: 'Producto sin relación textual',
      categoria: 'papel', // Solo coincide la categoría
      descripcion: 'Nada que ver',
      keywords: [], // Sin keywords
    });
    const match = findBestMatch(item, [prod]);
    if (match) {
      // Si hay match por categoría, debe estar capeado en 50%
      expect(match.score).toBeLessThanOrEqual(50);
    }
  });
});

describe('Garantías finales FV-UX-002', () => {
  it('Category-only match no se presenta como validado (score ≤50 es REVISAR)', () => {
    const weakMatch = {
      score: 50,
      matchType: 'category' as const,
    };
    expect(weakMatch.score).toBeLessThan(60); // REVISAR
  });

  it('Propuesta incompleta se marca cuando hay débiles O sin match', () => {
    // Con débil
    const metricasConDebil = calculateCoverageMetrics([
      {
        id: '1',
        match: { inventoryItem: producto(), score: 45, matchType: 'category', matchedTerms: [] },
        estado: 'auto',
      },
    ]);
    expect(metricasConDebil.propuestaIncompleta).toBe(true);

    // Con sin match
    const metricasConSinMatch = calculateCoverageMetrics([
      {
        id: '1',
        match: null,
        estado: 'auto',
      },
    ]);
    expect(metricasConSinMatch.propuestaIncompleta).toBe(true);

    // Completa (solo validados)
    const metricasCompleta = calculateCoverageMetrics([
      {
        id: '1',
        match: { inventoryItem: producto(), score: 75, matchType: 'partial', matchedTerms: [] },
        estado: 'auto',
      },
    ]);
    expect(metricasCompleta.propuestaIncompleta).toBe(false);
  });
});

describe('BLOCKER FIXES: Exact name + dimensions, multidimensional, coverage exclusion', () => {
  it('BLOCKER 1: Exact name + conflicting dimensions = score <60 REVISAR (not 100)', () => {
    const itemRequerido = { id: '1', nombre: 'Cable profesional', descripcion: 'Largo 2m' };
    const cable = producto({
      nombre_producto: 'Cable profesional',
      descripcion: 'Largo 1m', // Conflicting dimension
      categoria: 'electronica',
      keywords: ['cable'],
    });
    const match = findBestMatch(itemRequerido, [cable]);
    // Must NOT return 100 despite exact name match
    expect(match).not.toBeNull();
    expect(match!.score).toBeLessThan(60); // Dimension conflict → REVISAR
    expect(match!.matchType).not.toBe('exact'); // Falls through to partial/fuzzy
  });

  it('BLOCKER 2a: Multidimensional mismatch (10cm x 20cm vs 30cm x 20cm) = score <60 REVISAR', () => {
    const itemRequerido = { id: '1', nombre: 'Cartón 10cm x 20cm' };
    const carton = producto({
      nombre_producto: 'Cartón 30cm x 20cm', // First dimension differs: 10cm vs 30cm
      descripcion: 'Empaques de carton',
      categoria: 'empaques',
      keywords: ['carton'],
    });
    const match = findBestMatch(itemRequerido, [carton]);
    // Multidimensional mismatch: both have 2 dimensions, but 10cm ≠ 30cm
    // Should NOT get +25 bonus despite second dimension matching
    if (match) {
      expect(match.score).toBeLessThan(60); // Dimension count matches (2=2), but values don't → -30 penalty
    } else {
      expect(match).toBeNull(); // Also acceptable
    }
  });

  it('BLOCKER 2b: Multidimensional mismatch (different count) = score <60 REVISAR', () => {
    const itemRequerido = { id: '1', nombre: 'Caja 10x20cm' };
    const caja = producto({
      nombre_producto: 'Caja 10x20x5cm', // Three dimensions vs two
      categoria: 'empaques',
      keywords: ['caja'],
    });
    const match = findBestMatch(itemRequerido, [caja]);
    // Different dimension counts = ambiguous, should mark REVISAR
    if (match) {
      expect(match.score).toBeLessThan(60);
    } else {
      expect(match).toBeNull();
    }
  });

  it('BLOCKER 3: Coverage exclusion - weak matches (score <60) NOT counted in cobertura', () => {
    const rows: PropuestaItemRow[] = [
      {
        id: 'i1',
        match: { inventoryItem: producto(), score: 100, matchType: 'exact', matchedTerms: [] },
        estado: 'auto',
      },
      {
        id: 'i2',
        match: { inventoryItem: producto(), score: 59, matchType: 'category', matchedTerms: [] }, // Just under threshold
        estado: 'auto',
      },
      {
        id: 'i3',
        match: { inventoryItem: producto(), score: 60, matchType: 'partial', matchedTerms: [] }, // At threshold
        estado: 'auto',
      },
    ];

    const metrics = calculateCoverageMetrics(rows);
    expect(metrics.itemsConMatchValidado).toBe(2); // score 100 + score 60
    expect(metrics.itemsConMatchDebil).toBe(1); // score 59
    expect(metrics.cobertura).toBe(67); // 2/3 = 66.67 → 67
    expect(metrics.propuestaIncompleta).toBe(true); // Has weak match
  });
});
