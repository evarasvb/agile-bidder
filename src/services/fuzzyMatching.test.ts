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
