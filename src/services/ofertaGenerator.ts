/**
 * GENERADOR DE OFERTAS
 * 
 * Convierte resultados de matching en ofertas formales
 * para ser enviadas a MercadoPúblico
 */

import { supabase } from '@/integrations/supabase/client';
import type { MatchResult, ProductMatch } from './matchingEngine';
import type { Json } from '@/integrations/supabase/types';

// ============ INTERFACES ============

export interface ProductoOfertado {
  inventory_id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  precio_total: number;
  margen_aplicado: number;
}

export interface Oferta {
  id: string;
  licitacion_id: string;
  estado: 'borrador' | 'revision' | 'aprobada' | 'enviada' | 'rechazada' | 'ganada' | 'perdida';
  match_score: number;
  productos_ofertados: ProductoOfertado[];
  valor_total_oferta: number;
  margen_total: number;
  notas_internas: string | null;
  documento_oferta_url: string | null;
  fecha_envio: string | null;
  respuesta_mp: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface OfertaInput {
  licitacion_id: string;
  match_score: number;
  productos_ofertados: ProductoOfertado[];
  valor_total_oferta: number;
  margen_total: number;
  notas_internas?: string;
}

// ============ FUNCIONES ============

/**
 * Convierte productos matcheados a formato de oferta
 */
function convertMatchToProductosOfertados(
  matches: ProductMatch[]
): ProductoOfertado[] {
  return matches.map(match => ({
    inventory_id: match.inventory_id,
    sku: match.sku,
    nombre_producto: match.nombre,
    descripcion: `Keywords: ${match.keywords_matched.join(', ')}`,
    cantidad: match.cantidad_requerida,
    unidad_medida: 'unidad',
    precio_unitario: match.precio_oferta,
    precio_total: match.subtotal,
    margen_aplicado: match.margen_aplicado
  }));
}

/**
 * Genera una oferta a partir de un resultado de matching
 */
export async function generarOferta(matchResult: MatchResult): Promise<Oferta> {
  // Validaciones
  if (matchResult.productos_matcheados.length === 0) {
    throw new Error('No hay productos para generar oferta');
  }
  
  if (matchResult.match_score < 20) {
    throw new Error('Score de match muy bajo para generar oferta');
  }
  
  // Convertir productos matcheados a formato de oferta
  const productosOfertados = convertMatchToProductosOfertados(
    matchResult.productos_matcheados
  );
  
  // Calcular valor total con precisión
  const valorTotal = productosOfertados.reduce(
    (sum, p) => sum + p.precio_total, 
    0
  );
  
  // Crear registro en base de datos
  const { data: oferta, error } = await supabase
    .from('ofertas')
    .insert({
      licitacion_id: matchResult.licitacion_id,
      estado: 'borrador',
      match_score: matchResult.match_score,
      productos_ofertados: productosOfertados as unknown as Json,
      valor_total_oferta: valorTotal,
      margen_total: matchResult.margen_estimado,
      notas_internas: `Generada automáticamente. Confianza: ${matchResult.confidence_level}. ` +
        `Razones: ${matchResult.razones_match.join('; ')}`
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Log de creación
  await logOfertaEvent('oferta_generada', oferta.id, matchResult.licitacion_id, {
    match_score: matchResult.match_score,
    productos_count: productosOfertados.length,
    valor_total: valorTotal
  });
  
  return {
    ...oferta,
    productos_ofertados: productosOfertados
  } as Oferta;
}

/**
 * Actualiza el estado de una oferta
 */
export async function actualizarEstadoOferta(
  ofertaId: string, 
  nuevoEstado: Oferta['estado'],
  notas?: string
): Promise<void> {
  const updateData: Record<string, any> = { estado: nuevoEstado };
  
  if (notas) {
    const { data: current } = await supabase
      .from('ofertas')
      .select('notas_internas')
      .eq('id', ofertaId)
      .single();
    
    updateData.notas_internas = current?.notas_internas 
      ? `${current.notas_internas}\n---\n${new Date().toLocaleString()}: ${notas}`
      : notas;
  }
  
  if (nuevoEstado === 'enviada') {
    updateData.fecha_envio = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('ofertas')
    .update(updateData)
    .eq('id', ofertaId);
  
  if (error) throw error;
  
  // Log del cambio
  await logOfertaEvent('info', ofertaId, null, { 
    accion: 'cambio_estado',
    nuevo_estado: nuevoEstado 
  });
}

/**
 * Actualiza productos de una oferta
 */
export async function actualizarProductosOferta(
  ofertaId: string,
  productos: ProductoOfertado[]
): Promise<void> {
  const valorTotal = productos.reduce((sum, p) => sum + p.precio_total, 0);
  const costoTotal = productos.reduce(
    (sum, p) => sum + (p.precio_unitario / (1 + p.margen_aplicado / 100)) * p.cantidad, 
    0
  );
  const margenTotal = costoTotal > 0 
    ? Math.round(((valorTotal - costoTotal) / costoTotal) * 100) 
    : 0;
  
  const { error } = await supabase
    .from('ofertas')
    .update({
      productos_ofertados: productos as unknown as Json,
      valor_total_oferta: valorTotal,
      margen_total: margenTotal
    })
    .eq('id', ofertaId);
  
  if (error) throw error;
}

/**
 * Valida una oferta antes de enviar
 */
export async function validarOferta(ofertaId: string): Promise<{
  valid: boolean;
  errores: string[];
  advertencias: string[];
}> {
  const errores: string[] = [];
  const advertencias: string[] = [];
  
  // Obtener oferta
  const { data: oferta, error } = await supabase
    .from('ofertas')
    .select('*')
    .eq('id', ofertaId)
    .single();
  
  if (error || !oferta) {
    return { valid: false, errores: ['Oferta no encontrada'], advertencias: [] };
  }
  
  const productos = oferta.productos_ofertados as ProductoOfertado[];
  
  // Validar que hay productos
  if (!productos || productos.length === 0) {
    errores.push('La oferta no tiene productos');
  }
  
  // Validar stock de cada producto
  for (const prod of (productos as ProductoOfertado[])) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('stock_disponible, margen_minimo, nombre_producto')
      .eq('id', prod.inventory_id)
      .single();
    
    if (inv) {
      if (inv.stock_disponible < prod.cantidad) {
        errores.push(
          `Stock insuficiente de "${inv.nombre_producto}": ` +
          `disponible ${inv.stock_disponible}, requerido ${prod.cantidad}`
        );
      }
      
      if (prod.margen_aplicado < inv.margen_minimo) {
        advertencias.push(
          `"${inv.nombre_producto}" tiene margen (${prod.margen_aplicado}%) ` +
          `menor al mínimo (${inv.margen_minimo}%)`
        );
      }
    }
  }
  
  // Validar valor total
  if (oferta.valor_total_oferta <= 0) {
    errores.push('El valor total de la oferta debe ser mayor a cero');
  }
  
  // Obtener licitación para validar presupuesto
  const { data: licitacion } = await supabase
    .from('licitaciones')
    .select('presupuesto, fecha_cierre')
    .eq('id_licitacion', oferta.licitacion_id)
    .single();
  
  if (licitacion) {
    if (licitacion.presupuesto && oferta.valor_total_oferta > licitacion.presupuesto) {
      errores.push(
        `Valor de oferta ($${oferta.valor_total_oferta.toLocaleString()}) ` +
        `excede presupuesto ($${licitacion.presupuesto.toLocaleString()})`
      );
    }
    
    if (licitacion.fecha_cierre) {
      const cierre = new Date(licitacion.fecha_cierre);
      if (cierre < new Date()) {
        errores.push('La licitación ya ha cerrado');
      }
    }
  }
  
  return {
    valid: errores.length === 0,
    errores,
    advertencias
  };
}

/**
 * Elimina una oferta en estado borrador
 */
export async function eliminarOferta(ofertaId: string): Promise<void> {
  const { data: oferta } = await supabase
    .from('ofertas')
    .select('estado')
    .eq('id', ofertaId)
    .single();
  
  if (oferta?.estado !== 'borrador') {
    throw new Error('Solo se pueden eliminar ofertas en estado borrador');
  }
  
  const { error } = await supabase
    .from('ofertas')
    .delete()
    .eq('id', ofertaId);
  
  if (error) throw error;
}

/**
 * Registra evento en el log del sistema
 */
async function logOfertaEvent(
  tipo: 'oferta_generada' | 'oferta_enviada' | 'error' | 'info',
  ofertaId: string | null,
  licitacionId: string | null,
  detalles: Record<string, any>
): Promise<void> {
  try {
    await supabase
      .from('system_logs')
      .insert({
        tipo,
        severidad: tipo === 'error' ? 'error' : 'success',
        mensaje: `Evento de oferta: ${tipo}`,
        licitacion_id: licitacionId,
        oferta_id: ofertaId,
        detalles
      });
  } catch (e) {
    console.error('Error logging event:', e);
  }
}
