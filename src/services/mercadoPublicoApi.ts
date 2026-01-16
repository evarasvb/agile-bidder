/**
 * API DE MERCADOPÚBLICO - PREPARACIÓN DE OFERTAS
 * 
 * IMPORTANTE: MercadoPúblico no tiene API pública para envío de ofertas.
 * Este módulo prepara los datos en el formato correcto para ser usados
 * por una extensión de Chrome que hará el submit real.
 */

import { supabase } from '@/integrations/supabase/client';
import type { ProductoOfertado } from './ofertaGenerator';

// ============ INTERFACES ============

export interface ItemMPFormat {
  numero_linea: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  precio_total: number;
}

export interface OfertaMPFormat {
  codigo_licitacion: string;
  items: ItemMPFormat[];
  valor_total: number;
  plazo_entrega: string;
  observaciones: string;
  // Metadata adicional para la extensión
  metadata: {
    oferta_id: string;
    match_score: number;
    margen_total: number;
    generado_en: string;
  };
}

export interface ChromeExtensionPayload {
  action: 'submit_offer';
  data: OfertaMPFormat;
  callback_url?: string;
}

// ============ FUNCIONES ============

/**
 * Prepara una oferta en el formato requerido por MercadoPúblico
 * Con validaciones y manejo de errores mejorado
 */
export async function prepararOfertaParaMP(
  ofertaId: string
): Promise<OfertaMPFormat> {
  // Validar input
  if (!ofertaId || typeof ofertaId !== 'string') {
    throw new Error('ID de oferta inválido');
  }
  
  try {
    // Obtener oferta completa
    const { data: oferta, error: ofertaError } = await supabase
      .from('ofertas')
      .select('*')
      .eq('id', ofertaId)
      .single();
    
    if (ofertaError) {
      console.error('Error obteniendo oferta:', ofertaError);
      throw new Error(`Error al obtener oferta: ${ofertaError.message}`);
    }
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }
    
    // Validar que la oferta tenga datos necesarios
    if (!oferta.licitacion_id) {
      throw new Error('La oferta no tiene licitación asociada');
    }
    
    // Intentar obtener de compras_agiles primero, luego licitaciones
    let licitacion = null;
    let codigoLicitacion = null;
    
    // Buscar en compras_agiles
    const { data: compraAgil, error: caError } = await supabase
      .from('compras_agiles')
      .select('codigo, nombre')
      .eq('codigo', oferta.licitacion_id)
      .single();
    
    if (!caError && compraAgil) {
      codigoLicitacion = compraAgil.codigo;
    } else {
      // Fallback a licitaciones
      const { data: lic, error: licError } = await supabase
        .from('licitaciones')
        .select('id_licitacion, titulo')
        .eq('id_licitacion', oferta.licitacion_id)
        .single();
      
      if (licError || !lic) {
        throw new Error(`Licitación no encontrada: ${oferta.licitacion_id}`);
      }
      
      codigoLicitacion = lic.id_licitacion;
    }
    
    if (!codigoLicitacion) {
      throw new Error('No se pudo obtener el código de la licitación');
    }
    
    // Validar y convertir productos
    const productos = (oferta.productos_ofertados || []) as unknown as ProductoOfertado[];
    
    if (!Array.isArray(productos) || productos.length === 0) {
      throw new Error('La oferta no tiene productos asociados');
    }
    
    // Convertir productos al formato de MercadoPúblico con validación
    const items: ItemMPFormat[] = productos
      .filter(prod => prod && prod.nombre_producto) // Filtrar productos inválidos
      .map((prod, index) => {
        const cantidad = Number(prod.cantidad) || 1;
        const precioUnitario = Number(prod.precio_unitario) || 0;
        const precioTotal = cantidad * precioUnitario;
        
        if (precioUnitario <= 0) {
          console.warn(`Producto ${prod.nombre_producto} tiene precio inválido: ${precioUnitario}`);
        }
        
        return {
          numero_linea: index + 1,
          descripcion: `${prod.nombre_producto || 'Producto sin nombre'}${prod.sku ? ` (SKU: ${prod.sku})` : ''}`.slice(0, 500), // Limitar longitud
          cantidad: Math.max(1, cantidad),
          unidad: (prod.unidad_medida || 'UN').toUpperCase().slice(0, 10),
          precio_unitario: Math.round(Math.max(0, precioUnitario)),
          precio_total: Math.round(Math.max(0, precioTotal))
        };
      });
    
    if (items.length === 0) {
      throw new Error('No hay productos válidos en la oferta');
    }
    
    // Calcular plazo de entrega (tomar el máximo de los productos)
    const tiempoEntrega = await calcularPlazoEntrega(productos);
    
    // Validar valor total
    const valorTotalCalculado = items.reduce((sum, item) => sum + item.precio_total, 0);
    const valorTotalOferta = Math.round(Number(oferta.valor_total_oferta) || valorTotalCalculado);
    
    // Verificar consistencia
    if (Math.abs(valorTotalCalculado - valorTotalOferta) > 100) {
      console.warn(`Diferencia entre valor total calculado (${valorTotalCalculado}) y oferta (${valorTotalOferta})`);
    }
    
    return {
      codigo_licitacion: codigoLicitacion,
      items,
      valor_total: valorTotalCalculado, // Usar valor calculado para consistencia
      plazo_entrega: `${Math.max(7, tiempoEntrega)} días hábiles`,
      observaciones: generarObservaciones(productos, oferta),
      metadata: {
        oferta_id: oferta.id,
        match_score: Number(oferta.match_score) || 0,
        margen_total: Number(oferta.margen_total) || 0,
        generado_en: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error preparando oferta para MercadoPúblico:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error desconocido al preparar oferta');
  }
}

/**
 * Calcula el plazo de entrega basado en los productos
 * Optimizado para hacer una sola query en lugar de múltiples
 */
async function calcularPlazoEntrega(
  productos: ProductoOfertado[]
): Promise<number> {
  if (!productos || productos.length === 0) {
    return 10; // Default si no hay productos
  }
  
  // Extraer IDs de inventario válidos
  const inventoryIds = productos
    .map(prod => prod.inventory_id)
    .filter((id): id is string => !!id && typeof id === 'string');
  
  if (inventoryIds.length === 0) {
    return 10; // Default si no hay IDs válidos
  }
  
  // Hacer una sola query para todos los productos
  const { data: inventarios, error } = await supabase
    .from('inventory')
    .select('id, tiempo_entrega_dias')
    .in('id', inventoryIds);
  
  if (error) {
    console.warn('Error obteniendo tiempos de entrega:', error);
    return 10; // Default en caso de error
  }
  
  // Crear mapa para búsqueda rápida
  const tiemposMap = new Map(
    (inventarios || []).map(inv => [inv.id, Number(inv.tiempo_entrega_dias) || 7])
  );
  
  // Encontrar el máximo tiempo de entrega
  let maxDias = 7; // Mínimo 7 días
  
  for (const prod of productos) {
    if (prod.inventory_id) {
      const tiempoEntrega = tiemposMap.get(prod.inventory_id) || 7;
      if (tiempoEntrega > maxDias) {
        maxDias = tiempoEntrega;
      }
    }
  }
  
  // Agregar buffer de 3 días para logística
  return Math.max(7, maxDias + 3);
}

/**
 * Genera observaciones automáticas para la oferta
 * Sanitiza información confidencial
 */
function generarObservaciones(
  productos: ProductoOfertado[], 
  oferta: any
): string {
  if (!productos || !Array.isArray(productos) || productos.length === 0) {
    return 'Oferta sin productos';
  }
  
  const valorTotal = Number(oferta.valor_total_oferta) || 0;
  
  const observaciones = [
    `Oferta generada automáticamente por Sistema FirmaVB`,
    `Total de productos: ${productos.length}`,
    `Valor total: $${Math.round(valorTotal).toLocaleString('es-CL')} CLP`,
  ];
  
  // Agregar información de garantía si aplica
  if (oferta.match_score && Number(oferta.match_score) >= 70) {
    observaciones.push('Productos con alta compatibilidad verificada');
  }
  
  // Agregar notas internas relevantes (sin info confidencial)
  if (oferta.notas_internas && typeof oferta.notas_internas === 'string') {
    // Sanitizar: remover información confidencial
    const palabrasConfidenciales = ['margen', 'ganancia', 'costo', 'precio base', 'profit'];
    let notaPublica = oferta.notas_internas
      .split('\n')[0]
      .trim();
    
    // Remover palabras confidenciales
    for (const palabra of palabrasConfidenciales) {
      notaPublica = notaPublica.replace(new RegExp(palabra, 'gi'), '');
    }
    
    notaPublica = notaPublica.trim();
    
    if (notaPublica.length > 10 && notaPublica.length < 200) {
      observaciones.push(`Nota: ${notaPublica.slice(0, 150)}`);
    }
  }
  
  return observaciones.join('\n').slice(0, 1000); // Limitar longitud total
}

/**
 * Genera payload para la extensión de Chrome
 */
export async function generarPayloadExtension(
  ofertaId: string,
  callbackUrl?: string
): Promise<ChromeExtensionPayload> {
  const ofertaMP = await prepararOfertaParaMP(ofertaId);
  
  return {
    action: 'submit_offer',
    data: ofertaMP,
    callback_url: callbackUrl
  };
}

/**
 * Copia la oferta al portapapeles en formato JSON
 * (Para uso manual con extensión)
 * Con manejo de errores mejorado
 */
export async function copiarOfertaAlPortapapeles(
  ofertaId: string
): Promise<void> {
  try {
    if (!navigator.clipboard) {
      throw new Error('El navegador no soporta acceso al portapapeles');
    }
    
    const payload = await generarPayloadExtension(ofertaId);
    const jsonString = JSON.stringify(payload, null, 2);
    
    await navigator.clipboard.writeText(jsonString);
  } catch (error) {
    console.error('Error copiando al portapapeles:', error);
    if (error instanceof Error) {
      throw new Error(`Error al copiar: ${error.message}`);
    }
    throw new Error('Error desconocido al copiar al portapapeles');
  }
}

/**
 * Exporta oferta como CSV para import manual
 * Con validación y formato mejorado
 */
export async function exportarOfertaCSV(
  ofertaId: string
): Promise<string> {
  try {
    const ofertaMP = await prepararOfertaParaMP(ofertaId);
    
    // Validar que haya items
    if (!ofertaMP.items || ofertaMP.items.length === 0) {
      throw new Error('La oferta no tiene items para exportar');
    }
    
    const headers = [
      'Línea',
      'Descripción',
      'Cantidad',
      'Unidad',
      'Precio Unitario',
      'Precio Total'
    ].join(',');
    
    // Formatear rows con escape de comillas
    const rows = ofertaMP.items.map(item => {
      const descripcion = (item.descripcion || '').replace(/"/g, '""');
      return [
        item.numero_linea,
        `"${descripcion}"`,
        item.cantidad,
        item.unidad,
        item.precio_unitario,
        item.precio_total
      ].join(',');
    });
    
    const footer = [
      '',
      '',
      '',
      '',
      'TOTAL:',
      ofertaMP.valor_total
    ].join(',');
    
    return [headers, ...rows, footer].join('\n');
  } catch (error) {
    console.error('Error exportando CSV:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error desconocido al exportar CSV');
  }
}

/**
 * Registra respuesta de MercadoPúblico (desde extensión)
 * Con validación y manejo de errores mejorado
 */
export async function registrarRespuestaMP(
  ofertaId: string,
  respuesta: {
    success: boolean;
    numero_oferta?: string;
    mensaje?: string;
    timestamp: string;
  }
): Promise<void> {
  // Validar inputs
  if (!ofertaId || typeof ofertaId !== 'string') {
    throw new Error('ID de oferta inválido');
  }
  
  if (!respuesta || typeof respuesta.success !== 'boolean') {
    throw new Error('Respuesta inválida');
  }
  
  try {
    const nuevoEstado = respuesta.success ? 'enviada' : 'rechazada';
    const fechaEnvio = respuesta.success ? new Date().toISOString() : null;
    
    // Actualizar oferta
    const { error: updateError } = await supabase
      .from('ofertas')
      .update({
        estado: nuevoEstado,
        fecha_envio: fechaEnvio,
        respuesta_mp: respuesta,
        updated_at: new Date().toISOString()
      })
      .eq('id', ofertaId);
    
    if (updateError) {
      console.error('Error actualizando oferta:', updateError);
      throw new Error(`Error al actualizar oferta: ${updateError.message}`);
    }
    
    // Log del evento (no crítico si falla)
    try {
      await supabase
        .from('system_logs')
        .insert({
          tipo: 'oferta_enviada',
          severidad: respuesta.success ? 'success' : 'error',
          mensaje: respuesta.success 
            ? `Oferta enviada exitosamente a MP: ${respuesta.numero_oferta || 'N/A'}`
            : `Error al enviar oferta: ${respuesta.mensaje || 'Error desconocido'}`,
          oferta_id: ofertaId,
          detalles: respuesta
        });
    } catch (logError) {
      // No fallar si el log falla, solo registrar
      console.warn('Error registrando log:', logError);
    }
  } catch (error) {
    console.error('Error registrando respuesta MP:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error desconocido al registrar respuesta');
  }
}
