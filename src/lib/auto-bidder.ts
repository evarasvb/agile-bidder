import { supabase } from '@/integrations/supabase/client';

// Interfaz para matches de licitaciones
interface Match {
  licitacion_id: string;
  nombre: string;
  institucion: string;
  monto_estimado: number;
  cantidad: number;
  codigo_producto: string;
  match_score: number;
  fecha_cierre: string;
}

// Interfaz que coincide con la estructura real de auto_bids en Supabase
interface AutoBidRecord {
  id: string;
  tipo_proceso: string | null;
  codigo_proceso: string | null;
  titulo: string | null;
  organismo: string | null;
  estado: string | null;
  fecha_cierre: string | null;
  presupuesto_total: number | null;
}

// Interfaz para configuración de auto-bid por producto (usando auto_bid_items)
interface AutoBidItemConfig {
  id: string;
  producto_codigo: string;
  precio_base: number;
  margen_minimo: number;
  descuento_maximo: number;
  activo: boolean;
}

/**
 * Procesa los matches de licitaciones y genera oportunidades de auto-bid
 * Usa la tabla auto_bid_items para configuración por producto
 */
export async function processMatchesForAutoBids(matches: Match[]) {
  // 1. Obtener configuraciones activas de auto-bid items
  const { data: autoBidItems, error: configError } = await (supabase as any)
    .from('auto_bid_items')
    .select('*')
    .eq('activo', true);

  if (configError) {
    console.error('Error fetching auto-bid configs:', configError);
    return [];
  }

  if (!autoBidItems || autoBidItems.length === 0) {
    console.log('No hay configuraciones de auto-bid activas');
    return [];
  }

  // 2. Crear mapa de configuraciones por código de producto
  const configMap = new Map<string, AutoBidItemConfig>();
  autoBidItems.forEach((item: any) => {
    if (item.producto_codigo) {
      configMap.set(item.producto_codigo, {
        id: item.id,
        producto_codigo: item.producto_codigo,
        precio_base: item.precio_base || 0,
        margen_minimo: item.margen_minimo || 5,
        descuento_maximo: item.descuento_maximo || 15,
        activo: item.activo ?? true,
      });
    }
  });

  // 3. Procesar cada match
  const opportunities: any[] = [];

  for (const match of matches) {
    const config = configMap.get(match.codigo_producto);
    if (!config) continue;

    // 4. Calcular precio competitivo
    const precioCalculado = calculateCompetitivePrice(
      config.precio_base,
      config.margen_minimo,
      config.descuento_maximo,
      match.monto_estimado,
      match.cantidad
    );

    // 5. Calcular margen real
    const margen = config.precio_base > 0 
      ? ((precioCalculado - config.precio_base) / config.precio_base) * 100 
      : 0;

    // 6. Crear oportunidad
    opportunities.push({
      auto_bid_item_id: config.id,
      licitacion_id: match.licitacion_id,
      licitacion_nombre: match.nombre,
      institucion: match.institucion,
      monto_estimado: match.monto_estimado,
      cantidad_solicitada: match.cantidad,
      precio_sugerido: precioCalculado,
      margen_calculado: margen,
      estado: margen >= config.margen_minimo ? 'pendiente' : 'descartada',
      fecha_cierre: match.fecha_cierre,
      match_score: match.match_score,
      metadata: {
        precio_mercado: match.cantidad > 0 ? match.monto_estimado / match.cantidad : 0,
        competitividad: calculateCompetitiveness(
          precioCalculado, 
          match.cantidad > 0 ? match.monto_estimado / match.cantidad : 0
        ),
      },
    });
  }

  // 7. Insertar oportunidades en batch
  if (opportunities.length > 0) {
    const { error: insertError } = await (supabase as any)
      .from('auto_bid_opportunities')
      .insert(opportunities);

    if (insertError) {
      console.error('Error inserting opportunities:', insertError);
    } else {
      console.log(`✅ Created ${opportunities.length} auto-bid opportunities`);
    }
  }

  return opportunities;
}

/**
 * Calcula un precio competitivo basado en parámetros de configuración
 */
function calculateCompetitivePrice(
  precioBase: number,
  margenMinimo: number,
  descuentoMaximo: number,
  montoEstimado: number,
  cantidad: number
): number {
  if (cantidad <= 0 || precioBase <= 0) return precioBase;

  const precioMercado = montoEstimado / cantidad;

  // Precio mínimo aceptable (con margen mínimo)
  const precioMinimo = precioBase * (1 + margenMinimo / 100);

  // Precio con descuento máximo
  const precioConDescuentoMax = precioBase * (1 - descuentoMaximo / 100);

  // Estrategia: Ofrecer 3% por debajo del precio de mercado
  const descuentoCompetitivo = 0.03;
  const precioObjetivo = precioMercado * (1 - descuentoCompetitivo);

  // Asegurar que cumple restricciones
  const precioFinal = Math.max(
    precioMinimo,
    Math.min(precioObjetivo, precioBase * 1.5) // Cap al 50% de margen máximo
  );

  return Math.round(precioFinal);
}

/**
 * Calcula un índice de competitividad (0-100)
 */
function calculateCompetitiveness(precioNuestro: number, precioMercado: number): number {
  if (precioMercado <= 0) return 50;
  const diferencia = ((precioMercado - precioNuestro) / precioMercado) * 100;
  return Math.round(Math.max(0, Math.min(100, 50 + diferencia * 2)));
}
