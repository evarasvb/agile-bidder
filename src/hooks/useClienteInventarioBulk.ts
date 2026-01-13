import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from './useCliente';
import { toast } from 'sonner';

export interface BulkProductRow {
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  precio_unitario?: number;
  unidad_medida?: string;
  keywords?: string;
  imagen_url?: string;
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

export function useClienteInventarioBulk() {
  const queryClient = useQueryClient();
  const { data: cliente } = useCliente();

  return useMutation({
    mutationFn: async (products: BulkProductRow[]): Promise<BulkImportResult> => {
      if (!cliente?.id) {
        throw new Error('No hay cliente autenticado');
      }

      const errors: ValidationError[] = [];
      const toInsert: any[] = [];
      const toUpdate: { id: string; data: any }[] = [];

      // Fetch existing products by SKU
      const { data: existingProducts } = await supabase
        .from('cliente_inventario')
        .select('id, sku')
        .eq('cliente_id', cliente.id);

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
        const palabras_clave = row.keywords 
          ? row.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
          : null;

        const productData = {
          cliente_id: cliente.id,
          sku: row.sku.trim(),
          nombre: row.nombre.trim(),
          descripcion: row.descripcion?.trim() || null,
          categoria: row.categoria?.trim() || null,
          precio_unitario: row.precio_unitario ? Number(row.precio_unitario) : 0,
          palabras_clave,
          imagen_url: row.imagen_url?.trim() || null,
          activo: true,
          stock: 0,
          margen_minimo: 10,
          tiempo_entrega_dias: 5,
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
            .from('cliente_inventario')
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
          .from('cliente_inventario')
          .update(item.data)
          .eq('id', item.id);
        
        if (error) {
          errors.push({
            row: 0,
            field: item.data.sku,
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
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      queryClient.invalidateQueries({ queryKey: ['todo-inventario'] });
      
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

// Generate template data
export function generateTemplateData() {
  return [
    {
      'SKU': 'PROD-001',
      'Nombre del Producto': 'Resma Papel Carta 500 hojas',
      'Descripción': 'Resma de papel carta blanco 75g/m2, 500 hojas',
      'Categoría': 'Insumos de Oficina',
      'Precio Unitario': 4500,
      'Unidad de Medida': 'UN',
      'Keywords para Matching': 'papel, resma, carta, hojas, impresión',
      'URL Imagen': 'https://ejemplo.com/images/resma-papel.jpg'
    },
    {
      'SKU': 'PROD-002',
      'Nombre del Producto': 'Tóner HP 85A Compatible',
      'Descripción': 'Tóner compatible para impresoras HP LaserJet P1102',
      'Categoría': 'Tecnología',
      'Precio Unitario': 18500,
      'Unidad de Medida': 'UN',
      'Keywords para Matching': 'toner, hp, impresora, cartucho, laser',
      'URL Imagen': 'https://ejemplo.com/images/toner-hp.jpg'
    },
    {
      'SKU': 'PROD-003',
      'Nombre del Producto': 'Alcohol Gel 1 Litro',
      'Descripción': 'Alcohol gel sanitizante 70%, envase 1 litro',
      'Categoría': 'Limpieza e Higiene',
      'Precio Unitario': 3200,
      'Unidad de Medida': 'LT',
      'Keywords para Matching': 'alcohol, gel, sanitizante, higiene, desinfectante',
      'URL Imagen': ''
    },
    {
      'SKU': 'PROD-004',
      'Nombre del Producto': 'Caja Archivadora Plástica',
      'Descripción': 'Caja archivadora plástica tamaño oficio, color negro',
      'Categoría': 'Insumos de Oficina',
      'Precio Unitario': 2800,
      'Unidad de Medida': 'UN',
      'Keywords para Matching': 'caja, archivo, plástico, oficina, organización',
      'URL Imagen': 'https://ejemplo.com/images/caja-archivo.jpg'
    },
    {
      'SKU': 'PROD-005',
      'Nombre del Producto': 'Mouse Inalámbrico Logitech',
      'Descripción': 'Mouse inalámbrico USB 2.4GHz, ergonómico',
      'Categoría': 'Tecnología',
      'Precio Unitario': 12990,
      'Unidad de Medida': 'UN',
      'Keywords para Matching': 'mouse, ratón, inalámbrico, computador, periférico',
      'URL Imagen': 'https://ejemplo.com/images/mouse-logitech.jpg'
    }
  ];
}

export function generateInstructionsData() {
  return [
    { 'Instrucciones para Carga Masiva de Productos': '' },
    { 'Instrucciones para Carga Masiva de Productos': '1. CAMPOS OBLIGATORIOS:' },
    { 'Instrucciones para Carga Masiva de Productos': '   - SKU: Código único del producto (no puede repetirse)' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Nombre del Producto: Nombre descriptivo del producto' },
    { 'Instrucciones para Carga Masiva de Productos': '' },
    { 'Instrucciones para Carga Masiva de Productos': '2. CAMPOS OPCIONALES:' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Descripción: Detalle adicional del producto' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Categoría: Categoría del producto (ej: Tecnología, Limpieza, etc.)' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Precio Unitario: Precio en pesos chilenos (solo números)' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Unidad de Medida: UN (unidad), KG, LT, MT, etc.' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Keywords para Matching: Palabras clave separadas por comas' },
    { 'Instrucciones para Carga Masiva de Productos': '   - URL Imagen: Enlace directo a la imagen del producto (debe ser URL pública)' },
    { 'Instrucciones para Carga Masiva de Productos': '' },
    { 'Instrucciones para Carga Masiva de Productos': '3. NOTAS IMPORTANTES:' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Si el SKU ya existe, el producto será ACTUALIZADO' },
    { 'Instrucciones para Carga Masiva de Productos': '   - No modifique los encabezados de las columnas' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Puede cargar hasta 10,000 productos por archivo' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Las keywords mejoran el matching con licitaciones' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Las imágenes deben ser URLs públicas accesibles (https://)' },
    { 'Instrucciones para Carga Masiva de Productos': '' },
    { 'Instrucciones para Carga Masiva de Productos': '4. FORMATOS ACEPTADOS:' },
    { 'Instrucciones para Carga Masiva de Productos': '   - Excel (.xlsx, .xls)' },
    { 'Instrucciones para Carga Masiva de Productos': '   - CSV (.csv)' },
  ];
}
