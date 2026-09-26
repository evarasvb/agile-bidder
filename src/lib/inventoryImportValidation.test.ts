import { describe, expect, it } from 'vitest';
import {
  INVENTORY_IMPORT_TEXT_LIMITS,
  validateInventoryImportTextLengths,
} from './inventoryImportValidation';

const validRow = {
  sku: 'SKU-1',
  nombre: 'Lápiz',
  descripcion: 'Grafito',
  categoria: 'Oficina',
  unidad_medida: 'Unidad',
  marca: 'Tenute',
  proveedor: 'Proveedor',
  keywords: 'lápiz,grafito',
  imagen_url: 'https://example.com/lapiz.jpg',
};

describe('validateInventoryImportTextLengths', () => {
  it('acepta los límites de negocio exactos', () => {
    expect(validateInventoryImportTextLengths({
      ...validRow,
      sku: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.sku),
      descripcion: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.descripcion),
      imagen_url: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.imagen_url),
    })).toEqual([]);
  });

  it('rechaza cada campo que excede su límite antes de Supabase', () => {
    const errors = validateInventoryImportTextLengths({
      ...validRow,
      sku: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.sku + 1),
      nombre: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.nombre + 1),
      descripcion: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.descripcion + 1),
      keywords: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.keywords + 1),
      imagen_url: 'A'.repeat(INVENTORY_IMPORT_TEXT_LIMITS.imagen_url + 1),
    });
    expect(errors.map((error) => error.field)).toEqual([
      'Código',
      'Nombre',
      'Descripción',
      'Keywords',
      'URL de imagen',
    ]);
  });
});
