export interface InventoryImportTextFields {
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  unidad_medida: string;
  marca?: string;
  proveedor?: string;
  keywords?: string;
  imagen_url?: string;
}

export const INVENTORY_IMPORT_TEXT_LIMITS = {
  sku: 120,
  nombre: 500,
  descripcion: 5_000,
  categoria: 200,
  unidad_medida: 200,
  marca: 200,
  proveedor: 200,
  keywords: 2_000,
  imagen_url: 2_048,
} as const;

const FIELD_LABELS: Record<keyof typeof INVENTORY_IMPORT_TEXT_LIMITS, string> = {
  sku: 'Código',
  nombre: 'Nombre',
  descripcion: 'Descripción',
  categoria: 'Categoría',
  unidad_medida: 'Unidad',
  marca: 'Marca',
  proveedor: 'Proveedor',
  keywords: 'Keywords',
  imagen_url: 'URL de imagen',
};

export interface InventoryImportLengthError {
  field: string;
  message: string;
}

export function validateInventoryImportTextLengths(
  row: InventoryImportTextFields,
): InventoryImportLengthError[] {
  return (Object.keys(INVENTORY_IMPORT_TEXT_LIMITS) as Array<keyof typeof INVENTORY_IMPORT_TEXT_LIMITS>)
    .flatMap((field) => {
      const value = row[field];
      const limit = INVENTORY_IMPORT_TEXT_LIMITS[field];
      return typeof value === 'string' && value.length > limit
        ? [{
            field: FIELD_LABELS[field],
            message: `${FIELD_LABELS[field]} supera el máximo de ${limit.toLocaleString('es-CL')} caracteres`,
          }]
        : [];
    });
}
