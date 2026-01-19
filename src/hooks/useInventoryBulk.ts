import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';
import { InventoryInput } from './useInventory';

export interface BulkProductRow {
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  precio_unitario: number;
  unidad_medida: string;
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
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      onProgress?.({ current: 0, total: products.length, phase: 'validating', message: 'Obteniendo usuario autenticado...' });

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('Debes iniciar sesión para importar productos');
      }

      const clienteId = user.id;

      onProgress?.({ current: 0, total: products.length, phase: 'validating', message: 'Validando productos...' });

      // Fetch existing products from cliente_inventario
      const allExisting: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('id, sku')
          .eq('cliente_id', clienteId)
          .range(from, to);

        if (error) {
          throw new Error(`Error al verificar productos existentes: ${error.message}`);
        }

        if (data && data.length > 0) {
          allExisting.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      const existingSkuMap = new Map(
        allExisting.map(p => [p.sku.toLowerCase(), p.id])
      );

      for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const rowNum = i + 2;

        if (!row.sku || row.sku.trim() === '') {
          errors.push({ row: rowNum, field: 'Código', message: 'Código es obligatorio' });
          continue;
        }

        if (!row.nombre || row.nombre.trim() === '') {
          errors.push({ row: rowNum, field: 'Descripción', message: 'Descripción es obligatoria' });
          continue;
        }

        if (row.precio_unitario === undefined || row.precio_unitario === null || isNaN(Number(row.precio_unitario)) || Number(row.precio_unitario) <= 0) {
          errors.push({ row: rowNum, field: 'Precio', message: 'Precio es obligatorio y debe ser > 0' });
          continue;
        }

        if (!row.unidad_medida || row.unidad_medida.trim() === '') {
          errors.push({ row: rowNum, field: 'Unidad', message: 'Unidad es obligatoria' });
          continue;
        }

        const keywords = row.keywords 
          ? row.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
          : null;

        // Map to cliente_inventario schema
        const productData = {
          cliente_id: clienteId,
          sku: row.sku.trim(),
          nombre: row.nombre.trim(),
          descripcion: row.descripcion?.trim() || null,
          categoria: row.categoria?.trim() || 'General',
          precio_unitario: Number(row.precio_unitario),
          palabras_clave: keywords,
          imagen_url: row.imagen_url?.trim() || null,
          stock: row.stock !== undefined ? Number(row.stock) : 0,
          margen_minimo: row.margen_minimo !== undefined ? Number(row.margen_minimo) : (row.margen_objetivo !== undefined ? Number(row.margen_objetivo) : 10),
          tiempo_entrega_dias: row.tiempo_entrega_dias !== undefined ? Number(row.tiempo_entrega_dias) : 5,
          activo: true,
        };

        const existingId = existingSkuMap.get(row.sku.trim().toLowerCase());
        if (existingId) {
          toUpdate.push({ id: existingId, data: productData });
        } else {
          toInsert.push(productData);
        }

        if (i % 100 === 0) {
          onProgress?.({ 
            current: i, 
            total: products.length, 
            phase: 'validating', 
            message: `Validando ${i + 1} de ${products.length}...` 
          });
        }
      }

      let insertedCount = 0;
      if (toInsert.length > 0) {
        const batchSize = 500;
        
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
            .from('cliente_inventario')
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
            .from('cliente_inventario')
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

export function generateInventoryTemplateData() {
  return [
    {
      'Código': 'PROD-001',
      'Descripción': 'Resma Papel Carta 500 hojas',
      'Precio Unitario': 4500,
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
      'Precio Unitario': 18500,
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
  ];
}

export function generateInventoryInstructions() {
  return [
    { 'Instrucciones': '' },
    { 'Instrucciones': '=== INSTRUCCIONES PARA CARGA MASIVA DE PRODUCTOS ===' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '1. CAMPOS OBLIGATORIOS:' },
    { 'Instrucciones': '   • Código: Código único del producto (SKU)' },
    { 'Instrucciones': '   • Descripción: Nombre descriptivo del producto' },
    { 'Instrucciones': '   • Precio Unitario: Precio en pesos chilenos (solo números, > 0)' },
    { 'Instrucciones': '   • Unidad: UN (unidad), KG, LT, MT, etc.' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '2. CAMPOS OPCIONALES:' },
    { 'Instrucciones': '   • Categoría: Categoría del producto' },
    { 'Instrucciones': '   • Stock: Cantidad disponible (por defecto: 0)' },
    { 'Instrucciones': '   • Margen Mínimo (%): Margen mínimo aceptable (por defecto: 10)' },
    { 'Instrucciones': '   • Margen Objetivo (%): Margen deseado (por defecto: 15)' },
    { 'Instrucciones': '   • Tiempo Entrega (días): Días para entregar (por defecto: 5)' },
    { 'Instrucciones': '   • Proveedor: Nombre del proveedor' },
    { 'Instrucciones': '   • Keywords: Palabras clave separadas por comas' },
    { 'Instrucciones': '   • URL Imagen: URL de imagen del producto' },
    { 'Instrucciones': '' },
    { 'Instrucciones': '3. NOTAS:' },
    { 'Instrucciones': '   • Si el Código ya existe, el producto será ACTUALIZADO' },
    { 'Instrucciones': '   • No modifique los encabezados de las columnas' },
    { 'Instrucciones': '' },
  ];
}
