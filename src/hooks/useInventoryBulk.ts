import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InventoryInput } from './useInventory';

export interface BulkProductRow {
  sku: string;           // Codigo
  nombre: string;        // Mapped from descripcion
  descripcion?: string;
  categoria?: string;
  precio_unitario?: number; // Precio Neto
  unidad_medida?: string;   // Unidad
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

export interface ImportProgress {
  current: number;
  total: number;
  phase: 'validating' | 'inserting' | 'updating' | 'complete';
  message: string;
}

export function useInventoryBulk(onProgress?: (progress: ImportProgress) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (products: BulkProductRow[]): Promise<BulkImportResult> => {
      const errors: ValidationError[] = [];
      const toInsert: InventoryInput[] = [];
      const toUpdate: { id: string; data: Partial<InventoryInput> }[] = [];

      onProgress?.({ current: 0, total: products.length, phase: 'validating', message: 'Obteniendo usuario autenticado...' });

      // Get current authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Debes iniciar sesión para importar productos');
      }

      const userId = user.id;
      console.log('Importing products for user:', userId);

      onProgress?.({ current: 0, total: products.length, phase: 'validating', message: 'Validando productos...' });

      // Fetch existing products by SKU for this user
      const { data: existingProducts, error: fetchError } = await supabase
        .from('inventory')
        .select('id, sku')
        .eq('user_id', userId);

      if (fetchError) {
        throw new Error(`Error al verificar productos existentes: ${fetchError.message}`);
      }

      const existingSkuMap = new Map(
        (existingProducts || []).map(p => [p.sku.toLowerCase(), p.id])
      );

      // Validate and categorize products - New required fields: codigo (sku), descripcion (nombre), precio neto, unidad
      for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed

        // Validate required fields - codigo (SKU)
        if (!row.sku || row.sku.trim() === '') {
          errors.push({ row: rowNum, field: 'Código', message: 'Código es obligatorio' });
          continue;
        }

        // Validate required fields - descripcion (nombre)
        if (!row.nombre || row.nombre.trim() === '') {
          errors.push({ row: rowNum, field: 'Descripción', message: 'Descripción es obligatoria' });
          continue;
        }

        // Validate required fields - precio neto
        if (row.precio_unitario === undefined || row.precio_unitario === null || isNaN(Number(row.precio_unitario))) {
          errors.push({ row: rowNum, field: 'Precio Neto', message: 'Precio Neto es obligatorio' });
          continue;
        }

        // Validate required fields - unidad
        if (!row.unidad_medida || row.unidad_medida.trim() === '') {
          errors.push({ row: rowNum, field: 'Unidad', message: 'Unidad es obligatoria' });
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
          precio_unitario: Number(row.precio_unitario),
          unidad_medida: row.unidad_medida.trim(),
          keywords,
          imagen_url: row.imagen_url?.trim() || null,
          stock_disponible: row.stock !== undefined ? Number(row.stock) : 0,
          margen_minimo: row.margen_minimo !== undefined ? Number(row.margen_minimo) : 10,
          margen_objetivo: row.margen_objetivo !== undefined ? Number(row.margen_objetivo) : 15,
          tiempo_entrega_dias: row.tiempo_entrega_dias !== undefined ? Number(row.tiempo_entrega_dias) : 5,
          proveedor: row.proveedor?.trim() || null,
          activo: true,
          user_id: userId, // CRITICAL: Include user_id for RLS
        };

        // Check if SKU already exists
        const existingId = existingSkuMap.get(row.sku.trim().toLowerCase());
        if (existingId) {
          toUpdate.push({ id: existingId, data: productData });
        } else {
          toInsert.push(productData);
        }

        // Report validation progress every 100 items
        if (i % 100 === 0) {
          onProgress?.({ 
            current: i, 
            total: products.length, 
            phase: 'validating', 
            message: `Validando ${i + 1} de ${products.length}...` 
          });
        }
      }

      // Perform bulk insert with progress - increased batch size to 500
      let insertedCount = 0;
      if (toInsert.length > 0) {
        const batchSize = 500;
        const totalBatches = Math.ceil(toInsert.length / batchSize);
        
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const batchNum = Math.floor(i / batchSize) + 1;
          const batch = toInsert.slice(i, i + batchSize);
          
          onProgress?.({ 
            current: insertedCount, 
            total: toInsert.length, 
            phase: 'inserting', 
            message: `Insertando ${insertedCount + 1}-${Math.min(insertedCount + batch.length, toInsert.length)} de ${toInsert.length} productos...` 
          });
          
          const { error } = await supabase
            .from('inventory')
            .insert(batch);
          
          if (error) {
            errors.push({ 
              row: 0, 
              field: 'Batch', 
              message: `Error al insertar lote ${batchNum}: ${error.message}` 
            });
          } else {
            insertedCount += batch.length;
          }
        }
      }

      // Perform updates with progress - improved progress messages
      let updatedCount = 0;
      if (toUpdate.length > 0) {
        const batchSize = 100;
        
        for (let i = 0; i < toUpdate.length; i++) {
          const item = toUpdate[i];
          
          if (i % batchSize === 0 || i === 0) {
            onProgress?.({ 
              current: updatedCount, 
              total: toUpdate.length, 
              phase: 'updating', 
              message: `Actualizando ${updatedCount + 1} de ${toUpdate.length} productos existentes...` 
            });
          }
          
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
      }

      onProgress?.({ 
        current: insertedCount + updatedCount, 
        total: insertedCount + updatedCount, 
        phase: 'complete', 
        message: 'Importación completada' 
      });

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

// Generate template data for inventory table - Updated required fields
export function generateInventoryTemplateData() {
  return [
    {
      'Código': 'PROD-001',
      'Descripción': 'Resma Papel Carta 500 hojas',
      'Precio Neto': 4500,
      'Unidad': 'UN',
      'Categoría': 'Insumos de Oficina',
      'Stock': 100,
      'Margen Mínimo (%)': 10,
      'Margen Objetivo (%)': 15,
      'Tiempo Entrega (días)': 3,
      'Proveedor': 'Papelera Nacional',
      'Keywords': 'papel, resma, carta, hojas, impresión',
      'URL Imagen': 'https://ejemplo.com/imagen-producto.jpg',
    },
    {
      'Código': 'PROD-002',
      'Descripción': 'Tóner HP 85A Compatible',
      'Precio Neto': 18500,
      'Unidad': 'UN',
      'Categoría': 'Tecnología',
      'Stock': 50,
      'Margen Mínimo (%)': 12,
      'Margen Objetivo (%)': 20,
      'Tiempo Entrega (días)': 2,
      'Proveedor': 'TechSupply',
      'Keywords': 'toner, hp, impresora, cartucho, laser',
      'URL Imagen': '',
    },
    {
      'Código': 'PROD-003',
      'Descripción': 'Alcohol Gel 1 Litro',
      'Precio Neto': 3200,
      'Unidad': 'LT',
      'Categoría': 'Limpieza e Higiene',
      'Stock': 200,
      'Margen Mínimo (%)': 8,
      'Margen Objetivo (%)': 12,
      'Tiempo Entrega (días)': 1,
      'Proveedor': 'Higiene Total',
      'Keywords': 'alcohol, gel, sanitizante, higiene, desinfectante',
      'URL Imagen': '',
    },
  ];
}

export function generateInventoryInstructions() {
  return [
    { 'Instrucciones': '' },
    { 'Instrucciones': '=== INSTRUCCIONES PARA CARGA MASIVA DE PRODUCTOS ===' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '1. CAMPOS OBLIGATORIOS:' },
    { 'Instrucciones': '   • Código: Código único del producto (SKU, no puede repetirse)' },
    { 'Instrucciones': '   • Descripción: Nombre descriptivo del producto' },
    { 'Instrucciones': '   • Precio Neto: Precio unitario en pesos chilenos (solo números)' },
    { 'Instrucciones': '   • Unidad: UN (unidad), KG, LT, MT, etc.' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '2. CAMPOS OPCIONALES:' },
    { 'Instrucciones': '   • Categoría: Categoría del producto (ej: Tecnología, Limpieza)' },
    { 'Instrucciones': '   • Stock: Cantidad disponible (por defecto: 0)' },
    { 'Instrucciones': '   • Margen Mínimo (%): Margen mínimo aceptable (por defecto: 10)' },
    { 'Instrucciones': '   • Margen Objetivo (%): Margen deseado (por defecto: 15)' },
    { 'Instrucciones': '   • Tiempo Entrega (días): Días para entregar (por defecto: 5)' },
    { 'Instrucciones': '   • Proveedor: Nombre del proveedor' },
    { 'Instrucciones': '   • Keywords: Palabras clave separadas por comas para matching' },
    { 'Instrucciones': '   • URL Imagen: URL de imagen del producto (debe comenzar con https://)' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '3. NOTAS IMPORTANTES:' },
    { 'Instrucciones': '   • Si el Código ya existe, el producto será ACTUALIZADO' },
    { 'Instrucciones': '   • No modifique los encabezados de las columnas' },
    { 'Instrucciones': '   • Puede cargar hasta 10,000 productos por archivo' },
    { 'Instrucciones': '   • Las keywords mejoran el matching con licitaciones' },
    { 'Instrucciones': '   • Las imágenes deben ser URLs válidas (https://)' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '4. FORMATOS ACEPTADOS: Excel (.xlsx, .xls), CSV (.csv)' },
  ];
}
