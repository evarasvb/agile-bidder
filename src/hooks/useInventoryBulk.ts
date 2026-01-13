import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InventoryInput } from './useInventory';

export interface BulkProductRow {
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  precio_unitario?: number;
  unidad_medida?: string;
  keywords?: string;
  imagen_url?: string;
  stock?: number;
  margen_minimo?: number;
  margen_objetivo?: number;
  tiempo_entrega_dias?: number;
  proveedor?: string;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface BulkImportResult {
  inserted: number;
  updated: number;
  errors: ValidationError[];
}

export function useInventoryBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: BulkProductRow[]): Promise<BulkImportResult> => {
      const errors: ValidationError[] = [];
      const toInsert: InventoryInput[] = [];
      const toUpdate: { id: string; data: Partial<InventoryInput> }[] = [];

      // Fetch existing products by SKU
      const { data: existingProducts, error: fetchError } = await supabase
        .from('inventory')
        .select('id, sku');

      if (fetchError) {
        throw new Error(`Error al verificar productos existentes: ${fetchError.message}`);
      }

      const existingSkuMap = new Map(
        (existingProducts || []).map(p => [p.sku.toLowerCase(), p.id])
      );

      // Validate and categorize products
      for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed

        // Validate required fields
        if (!row.sku || row.sku.trim() === '') {
          errors.push({ row: rowNum, field: 'SKU', message: 'SKU es obligatorio' });
          continue;
        }

        if (!row.nombre || row.nombre.trim() === '') {
          errors.push({ row: rowNum, field: 'Nombre', message: 'Nombre del Producto es obligatorio' });
          continue;
        }

        // Parse keywords
        const keywords = row.keywords 
          ? row.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
          : null;

        const productData: InventoryInput = {
          sku: row.sku.trim(),
          nombre_producto: row.nombre.trim(),
          descripcion: row.descripcion?.trim() || null,
          categoria: row.categoria?.trim() || 'General',
          precio_unitario: row.precio_unitario ? Number(row.precio_unitario) : 0,
          unidad_medida: row.unidad_medida?.trim() || 'UN',
          keywords,
          imagen_url: row.imagen_url?.trim() || null,
          stock_disponible: row.stock !== undefined ? Number(row.stock) : 0,
          margen_minimo: row.margen_minimo !== undefined ? Number(row.margen_minimo) : 10,
          margen_objetivo: row.margen_objetivo !== undefined ? Number(row.margen_objetivo) : 15,
          tiempo_entrega_dias: row.tiempo_entrega_dias !== undefined ? Number(row.tiempo_entrega_dias) : 5,
          proveedor: row.proveedor?.trim() || null,
          activo: true,
        };

        // Check if SKU already exists
        const existingId = existingSkuMap.get(row.sku.trim().toLowerCase());
        if (existingId) {
          toUpdate.push({ id: existingId, data: productData });
        } else {
          toInsert.push(productData);
        }
      }

      // Perform bulk insert
      let insertedCount = 0;
      if (toInsert.length > 0) {
        // Insert in batches of 100
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batch = toInsert.slice(i, i + batchSize);
          const { error } = await supabase
            .from('inventory')
            .insert(batch);
          
          if (error) {
            errors.push({ 
              row: 0, 
              field: 'Batch', 
              message: `Error al insertar lote: ${error.message}` 
            });
          } else {
            insertedCount += batch.length;
          }
        }
      }

      // Perform updates
      let updatedCount = 0;
      for (const item of toUpdate) {
        const { error } = await supabase
          .from('inventory')
          .update(item.data)
          .eq('id', item.id);
        
        if (error) {
          errors.push({
            row: 0,
            field: item.data.sku || 'Unknown',
            message: `Error al actualizar ${item.data.sku}: ${error.message}`
          });
        } else {
          updatedCount++;
        }
      }

      return {
        inserted: insertedCount,
        updated: updatedCount,
        errors
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      
      if (result.errors.length === 0) {
        toast.success(`✅ ${result.inserted} productos importados, ${result.updated} actualizados`);
      } else {
        toast.warning(`⚠️ ${result.inserted + result.updated} procesados con ${result.errors.length} errores`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Error al importar: ${error.message}`);
    },
  });
}

// Generate template data for inventory table
export function generateInventoryTemplateData() {
  return [
    {
      'SKU': 'PROD-001',
      'Nombre': 'Resma Papel Carta 500 hojas',
      'Descripción': 'Resma de papel carta blanco 75g/m2, 500 hojas',
      'Categoría': 'Insumos de Oficina',
      'Precio': 4500,
      'Unidad': 'UN',
      'Stock': 100,
      'Margen Mínimo (%)': 10,
      'Margen Objetivo (%)': 15,
      'Tiempo Entrega (días)': 3,
      'Proveedor': 'Papelera Nacional',
      'Keywords': 'papel, resma, carta, hojas, impresión',
    },
    {
      'SKU': 'PROD-002',
      'Nombre': 'Tóner HP 85A Compatible',
      'Descripción': 'Tóner compatible para impresoras HP LaserJet P1102',
      'Categoría': 'Tecnología',
      'Precio': 18500,
      'Unidad': 'UN',
      'Stock': 50,
      'Margen Mínimo (%)': 12,
      'Margen Objetivo (%)': 20,
      'Tiempo Entrega (días)': 2,
      'Proveedor': 'TechSupply',
      'Keywords': 'toner, hp, impresora, cartucho, laser',
    },
    {
      'SKU': 'PROD-003',
      'Nombre': 'Alcohol Gel 1 Litro',
      'Descripción': 'Alcohol gel sanitizante 70%, envase 1 litro',
      'Categoría': 'Limpieza e Higiene',
      'Precio': 3200,
      'Unidad': 'LT',
      'Stock': 200,
      'Margen Mínimo (%)': 8,
      'Margen Objetivo (%)': 12,
      'Tiempo Entrega (días)': 1,
      'Proveedor': 'Higiene Total',
      'Keywords': 'alcohol, gel, sanitizante, higiene, desinfectante',
    },
  ];
}

export function generateInventoryInstructions() {
  return [
    { 'Instrucciones': '' },
    { 'Instrucciones': '=== INSTRUCCIONES PARA CARGA MASIVA DE PRODUCTOS ===' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '1. CAMPOS OBLIGATORIOS:' },
    { 'Instrucciones': '   • SKU: Código único del producto (no puede repetirse)' },
    { 'Instrucciones': '   • Nombre: Nombre descriptivo del producto' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '2. CAMPOS OPCIONALES:' },
    { 'Instrucciones': '   • Descripción: Detalle adicional del producto' },
    { 'Instrucciones': '   • Categoría: Categoría del producto (ej: Tecnología, Limpieza)' },
    { 'Instrucciones': '   • Precio: Precio unitario en pesos chilenos (solo números)' },
    { 'Instrucciones': '   • Unidad: UN (unidad), KG, LT, MT, etc.' },
    { 'Instrucciones': '   • Stock: Cantidad disponible (por defecto: 0)' },
    { 'Instrucciones': '   • Margen Mínimo (%): Margen mínimo aceptable (por defecto: 10)' },
    { 'Instrucciones': '   • Margen Objetivo (%): Margen deseado (por defecto: 15)' },
    { 'Instrucciones': '   • Tiempo Entrega (días): Días para entregar (por defecto: 5)' },
    { 'Instrucciones': '   • Proveedor: Nombre del proveedor' },
    { 'Instrucciones': '   • Keywords: Palabras clave separadas por comas para matching' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '3. NOTAS IMPORTANTES:' },
    { 'Instrucciones': '   • Si el SKU ya existe, el producto será ACTUALIZADO' },
    { 'Instrucciones': '   • No modifique los encabezados de las columnas' },
    { 'Instrucciones': '   • Puede cargar hasta 10,000 productos por archivo' },
    { 'Instrucciones': '   • Las keywords mejoran el matching con licitaciones' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '4. FORMATOS ACEPTADOS: Excel (.xlsx, .xls), CSV (.csv)' },
  ];
}
