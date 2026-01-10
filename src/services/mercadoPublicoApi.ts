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
 */
export async function prepararOfertaParaMP(
  ofertaId: string
): Promise<OfertaMPFormat> {
  // Obtener oferta completa
  const { data: oferta, error: ofertaError } = await supabase
    .from('ofertas')
    .select('*')
    .eq('id', ofertaId)
    .single();
  
  if (ofertaError || !oferta) {
    throw new Error('Oferta no encontrada');
  }
  
  // Obtener datos de la licitación
  const { data: licitacion, error: licError } = await supabase
    .from('licitaciones')
    .select('*')
    .eq('id_licitacion', oferta.licitacion_id)
    .single();
  
  if (licError || !licitacion) {
    throw new Error('Licitación no encontrada');
  }
  
  const productos = (oferta.productos_ofertados || []) as unknown as ProductoOfertado[];
  
  // Convertir productos al formato de MercadoPúblico
  const items: ItemMPFormat[] = productos.map((prod, index) => ({
    numero_linea: index + 1,
    descripcion: `${prod.nombre_producto} (SKU: ${prod.sku})`,
    cantidad: prod.cantidad,
    unidad: prod.unidad_medida,
    precio_unitario: Math.round(prod.precio_unitario),
    precio_total: Math.round(prod.precio_total)
  }));
  
  // Calcular plazo de entrega (tomar el máximo de los productos)
  const tiempoEntrega = await calcularPlazoEntrega(productos);
  
  return {
    codigo_licitacion: licitacion.id_licitacion,
    items,
    valor_total: Math.round(oferta.valor_total_oferta),
    plazo_entrega: `${tiempoEntrega} días hábiles`,
    observaciones: generarObservaciones(productos, oferta),
    metadata: {
      oferta_id: oferta.id,
      match_score: oferta.match_score || 0,
      margen_total: oferta.margen_total || 0,
      generado_en: new Date().toISOString()
    }
  };
}

/**
 * Calcula el plazo de entrega basado en los productos
 */
async function calcularPlazoEntrega(
  productos: ProductoOfertado[]
): Promise<number> {
  let maxDias = 7; // Mínimo 7 días
  
  for (const prod of productos) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('tiempo_entrega_dias')
      .eq('id', prod.inventory_id)
      .single();
    
    if (inv && inv.tiempo_entrega_dias > maxDias) {
      maxDias = inv.tiempo_entrega_dias;
    }
  }
  
  // Agregar buffer de 3 días para logística
  return maxDias + 3;
}

/**
 * Genera observaciones automáticas para la oferta
 */
function generarObservaciones(
  productos: ProductoOfertado[], 
  oferta: any
): string {
  const observaciones = [
    `Oferta generada automáticamente por Sistema de Matching`,
    `Total de productos: ${productos.length}`,
    `Valor total: $${Math.round(oferta.valor_total_oferta).toLocaleString('es-CL')} CLP`,
  ];
  
  // Agregar notas internas relevantes (sin info confidencial)
  if (oferta.notas_internas) {
    const notaPublica = oferta.notas_internas
      .split('\n')[0]
      .replace(/margen|ganancia|costo/gi, '')
      .trim();
    
    if (notaPublica.length > 10) {
      observaciones.push(`Nota: ${notaPublica.slice(0, 100)}`);
    }
  }
  
  return observaciones.join('\n');
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
 */
export async function copiarOfertaAlPortapapeles(
  ofertaId: string
): Promise<void> {
  const payload = await generarPayloadExtension(ofertaId);
  
  await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
}

/**
 * Exporta oferta como CSV para import manual
 */
export async function exportarOfertaCSV(
  ofertaId: string
): Promise<string> {
  const ofertaMP = await prepararOfertaParaMP(ofertaId);
  
  const headers = [
    'Línea',
    'Descripción',
    'Cantidad',
    'Unidad',
    'Precio Unitario',
    'Precio Total'
  ].join(',');
  
  const rows = ofertaMP.items.map(item => [
    item.numero_linea,
    `"${item.descripcion.replace(/"/g, '""')}"`,
    item.cantidad,
    item.unidad,
    item.precio_unitario,
    item.precio_total
  ].join(','));
  
  const footer = [
    '',
    '',
    '',
    '',
    'TOTAL:',
    ofertaMP.valor_total
  ].join(',');
  
  return [headers, ...rows, footer].join('\n');
}

/**
 * Registra respuesta de MercadoPúblico (desde extensión)
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
  const nuevoEstado = respuesta.success ? 'enviada' : 'rechazada';
  
  const { error } = await supabase
    .from('ofertas')
    .update({
      estado: nuevoEstado,
      fecha_envio: respuesta.success ? new Date().toISOString() : null,
      respuesta_mp: respuesta
    })
    .eq('id', ofertaId);
  
  if (error) throw error;
  
  // Log del evento
  await supabase
    .from('system_logs')
    .insert({
      tipo: 'oferta_enviada',
      severidad: respuesta.success ? 'success' : 'error',
      mensaje: respuesta.success 
        ? `Oferta enviada exitosamente a MP: ${respuesta.numero_oferta}`
        : `Error al enviar oferta: ${respuesta.mensaje}`,
      oferta_id: ofertaId,
      detalles: respuesta
    });
}
