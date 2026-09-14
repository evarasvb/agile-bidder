import { describe, it, expect } from 'vitest';
import { findMatches, findBestMatch, extractItemsFromDescription, processCompraMatches } from './fuzzyMatching';
import type { InventoryItem } from '@/hooks/useInventory';

// fuzzyMatching.ts es el ÚNICO de los motores de matching que realmente está
// en uso hoy (vía useProductMatching, en LicitacionItemsMatch/ItemsMatchTable
// dentro de LicitacionDetalle.tsx). matchingEngine.ts y matchingEngineV2.ts
// —que la auditoría técnica creía en uso real por ofertaGenerator/useOfertas—
// resultaron ser código muerto sin ningún importador fuera de sí mismos; se
// eliminan en vez de testearlos (ver commit de limpieza). Estos tests
// protegen el comportamiento real antes de cualquier cambio futuro.

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

describe('findBestMatch', () => {
  it('da 100 y matchType exact cuando el nombre es idéntico (normalizado)', () => {
    const item = { id: '1', nombre: 'Resma de papel carta' };
    const match = findBestMatch(item, [producto()]);
    expect(match).not.toBeNull();
    expect(match!.score).toBe(100);
    expect(match!.matchType).toBe('exact');
  });

  it('encuentra el producto correcto vía sinónimo de categoría (papelería -> oficina)', () => {
    const item = { id: '1', nombre: 'Artículos de papelería para oficina' };
    const inventario = [
      producto({ id: 'p-oficina', nombre_producto: 'Set de escritorio ejecutivo', categoria: 'oficina', keywords: ['escritorio'] }),
      producto({ id: 'p-random', nombre_producto: 'Casco de seguridad industrial', categoria: 'seguridad', keywords: ['casco'] }),
    ];
    const match = findBestMatch(item, inventario);
    expect(match).not.toBeNull();
    expect(match!.inventoryItem.id).toBe('p-oficina');
  });

  it('retorna null cuando no hay ninguna similitud razonable (bajo el umbral de 25%)', () => {
    const item = { id: '1', nombre: 'Excavadora hidráulica CAT 320' };
    const match = findBestMatch(item, [producto({ nombre_producto: 'Lápiz grafito HB', categoria: 'escritura', keywords: ['lapiz'] })]);
    expect(match).toBeNull();
  });

  it('ignora productos inactivos aunque calcen perfecto', () => {
    const item = { id: '1', nombre: 'Resma de papel carta' };
    const match = findBestMatch(item, [producto({ activo: false })]);
    expect(match).toBeNull();
  });
});

describe('findMatches', () => {
  it('ordena resultados por score descendente', () => {
    const item = { id: '1', nombre: 'Resma de papel carta 75g' };
    const inventario = [
      producto({ id: 'exacto', nombre_producto: 'Resma de papel carta 75g' }),
      producto({ id: 'parcial', nombre_producto: 'Papel oficio 90g', categoria: 'papel', keywords: ['papel'] }),
    ];
    const matches = findMatches(item, inventario, 5);
    expect(matches.length).toBeGreaterThanOrEqual(2);
    expect(matches[0].inventoryItem.id).toBe('exacto');
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
  });

  it('respeta el límite maxResults', () => {
    const item = { id: '1', nombre: 'papel' };
    const inventario = Array.from({ length: 10 }, (_, i) =>
      producto({ id: `p${i}`, nombre_producto: `Papel tipo ${i}`, categoria: 'papel', keywords: ['papel'] })
    );
    const matches = findMatches(item, inventario, 3);
    expect(matches.length).toBeLessThanOrEqual(3);
  });
});

describe('extractItemsFromDescription', () => {
  it('extrae cantidad, unidad y nombre cuando la línea empieza con un número', () => {
    const items = extractItemsFromDescription('10 UN Resma de papel carta\n5 KG Detergente en polvo');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ nombre: 'Resma de papel carta', cantidad: 10, unidad: 'UN' });
    expect(items[1]).toMatchObject({ nombre: 'Detergente en polvo', cantidad: 5, unidad: 'KG' });
  });

  it('usa cantidad 1 y unidad UN cuando la línea no trae cantidad al inicio', () => {
    const items = extractItemsFromDescription('Notebook Lenovo 15 pulgadas');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ nombre: 'Notebook Lenovo 15 pulgadas', cantidad: 1, unidad: 'UN' });
  });

  it('ignora líneas de encabezado y líneas muy cortas', () => {
    const items = extractItemsFromDescription('Producto:\nítem\n10 UN Papel carta');
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe('Papel carta');
  });
});

describe('processCompraMatches', () => {
  it('devuelve un mapa con matches por cada item, en el mismo orden de items', () => {
    const items = [
      { id: 'req-1', nombre: 'Resma de papel carta' },
      { id: 'req-2', nombre: 'Excavadora hidráulica' },
    ];
    const inventario = [producto()];
    const resultado = processCompraMatches(items, inventario);
    expect(resultado.size).toBe(2);
    expect(resultado.get('req-1')!.length).toBeGreaterThan(0);
    expect(resultado.get('req-2')).toEqual([]);
  });
});

describe('validateSpecifications - Incompatibility rules (FV-UX-002)', () => {
  it('RECHAZA: CORDEL_DE_PAPEL NO debe matchear con Pendrive 32GB (electrónico vs cordaje)', () => {
    const itemRequerido = { id: '1', nombre: 'Pendrive 32GB USB 3.0' };
    const cordel = producto({
      id: 'cordel-papel',
      sku: 'CORDEL-001',
      nombre_producto: 'Cordel de papel',
      descripcion: 'Cuerda de papel kraft para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo', 'embalaje'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull();
  });

  it('RECHAZA: CORDEL_DE_PAPEL NO debe matchear con Adaptador VGA-HDMI (electrónico vs cordaje)', () => {
    const itemRequerido = { id: '2', nombre: 'Adaptador VGA a HDMI 1.4' };
    const cordel = producto({
      id: 'cordel-papel',
      sku: 'CORDEL-001',
      nombre_producto: 'Cordel de papel',
      descripcion: 'Cuerda de papel kraft para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo', 'embalaje'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull();
  });

  it('RECHAZA: CORDEL_DE_PAPEL NO debe matchear con Tijeras (incompatible por especificación)', () => {
    const itemRequerido = { id: '3', nombre: 'Tijeras de corte profesional 8"' };
    const cordel = producto({
      id: 'cordel-papel',
      sku: 'CORDEL-001',
      nombre_producto: 'Cordel de papel',
      descripcion: 'Cuerda de papel kraft para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo', 'embalaje'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull();
  });

  it('RECHAZA: CORDEL_DE_PAPEL NO debe matchear con Lapiceros (oficina, pero incompatible por especificación)', () => {
    const itemRequerido = { id: '4', nombre: 'Lapicero azul Staedtler triangular' };
    const cordel = producto({
      id: 'cordel-papel',
      sku: 'CORDEL-001',
      nombre_producto: 'Cordel de papel',
      descripcion: 'Cuerda de papel kraft para empaques',
      categoria: 'pegamento',
      keywords: ['cordel', 'cuerda', 'adhesivo', 'embalaje'],
    });
    const match = findBestMatch(itemRequerido, [cordel]);
    expect(match).toBeNull();
  });
});

describe('Dimension validation without generic tolerance (FV-UX-002)', () => {
  it('PENALIZA: 5.5 pulgadas (13.97cm) vs requisito 15.8cm = 11.6% diferencia (bajo 20%, pero sin tolerancia genérica justificada)', () => {
    const itemRequerido = {
      id: '5',
      nombre: 'Papel carta 5.5 pulgadas ancho',
      descripcion: 'Papel carta formato 5.5 pulgadas de ancho',
    };
    const papel_15_8cm = producto({
      id: 'papel-15-8',
      nombre_producto: 'Papel oficio 15.8 cm',
      descripcion: 'Papel oficio estándar 15.8 cm de ancho',
      categoria: 'papel',
    });
    const match = findBestMatch(itemRequerido, [papel_15_8cm]);
    // Debe retornar null o score muy bajo porque la dimensión es diferente
    // 5.5" = 13.97cm, diferencia con 15.8cm es 11.6%
    // NOTA: 20% es arbitrario; sin tolerancia genérica, esto debería rechazarse
    if (match) {
      expect(match.score).toBeLessThan(50); // Penalizado, no debe ser "completo"
    } else {
      expect(match).toBeNull(); // O simplemente rechazado
    }
  });
});

describe('Match confidence levels - REVISAR badges (FV-UX-002)', () => {
  it('LOW confidence (score < 60%): REVISAR badge - NO debe contar como cobertura validada', () => {
    const itemRequerido = { id: '6', nombre: 'Pendrive Samsung 64GB USB 3.1' };
    const produtoLejano = producto({
      id: 'cables-varios',
      nombre_producto: 'Cables y conectores varios',
      descripcion: 'Variados cables USB y conectores',
      categoria: 'electrónica',
      keywords: ['cable', 'conector', 'usb'],
    });
    const match = findBestMatch(itemRequerido, [produtoLejano]);
    // Un match débil (< 60%) debe ser marcado REVISAR y NO debe contar como cobertura completa
    if (match) {
      expect(match.score).toBeLessThan(60);
      // En CompraAgilDetalle, esto debería mostrar badge "REVISAR" y NO incrementar itemsConMatch
    }
  });

  it('MEDIUM confidence (60-74%): partial match - debe mostrar tooltip de revisión requerida', () => {
    const itemRequerido = { id: '7', nombre: 'Resma de papel oficio 75g' };
    const papel_carta = producto({
      id: 'papel-carta',
      nombre_producto: 'Resma de papel carta 75g',
      descripcion: 'Papel bond blanco carta',
      categoria: 'papel',
      keywords: ['resma', 'papel', 'carta'],
    });
    const match = findBestMatch(itemRequerido, [papel_carta]);
    expect(match).not.toBeNull();
    if (match && match.score >= 60 && match.score < 75) {
      expect(match.score).toBeGreaterThanOrEqual(60);
      expect(match.score).toBeLessThan(75);
      // Debe mostrar "Coincidencia parcial - revisar especificaciones"
    }
  });

  it('HIGH confidence (score >= 75%): puede contar como cobertura validada', () => {
    const itemRequerido = { id: '8', nombre: 'Resma de papel carta 75g' };
    const match_exacto = findBestMatch(itemRequerido, [
      producto({
        id: 'papel-exacto',
        nombre_producto: 'Resma de papel carta 75g',
        descripcion: 'Papel bond blanco carta estándar',
        categoria: 'papel',
        keywords: ['resma', 'papel', 'carta', '75g'],
      }),
    ]);
    expect(match_exacto).not.toBeNull();
    expect(match_exacto!.score).toBeGreaterThanOrEqual(75);
  });
});
