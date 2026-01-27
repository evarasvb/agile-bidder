import { supabase } from '@/integrations/supabase/client';

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

interface AutoBidConfig {
  id: string;
  codigo_producto: string;
  precio_base: number;
  margen_minimo: number;
  tope_descuento: number;
  prioridad: number;
}

export async function processMatchesForAutoBids(matches: Match[]) {
  // 1. Obtener configuraciones activas de auto-bids
  const { data: autoBids, error: configError } = await supabase
    .from('auto_bids')
    .select('*')
    .eq('activo', true)
    .order('prioridad', { ascending: false });

  if (configError || !autoBids) {
    console.error('Error fetching auto-bid configs:', configError);
    return;
  }

  const autoBidMap = new Map<string, AutoBidConfig>();
  autoBids.forEach(bid => {
    autoBidMap.set(bid.codigo_producto, bid);
  });

  // 2. Procesar cada match
  const opportunities = [];
  
  for (const match of matches) {
    const autoBidConfig = autoBidMap.get(match.codigo_producto);
    
    if (!autoBidConfig) continue; // Skip si no está configurado para auto-bid

    // 3. Calcular precio competitivo
    const precioCalculado = calculateCompetitivePrice(
      autoBidConfig.precio_base,
      autoBidConfig.margen_minimo,
      autoBidConfig.tope_descuento,
      match.monto_estimado,
      match.cantidad
    );

    // 4. Calcular margen real
    const margen = ((precioCalculado - autoBidConfig.precio_base) / autoBidConfig.precio_base) * 100;

    // 5. Crear oportunidad
    opportunities.push({
      auto_bid_id: autoBidConfig.id,
      licitacion_id: match.licitacion_id,
      licitacion_nombre: match.nombre,
      institucion: match.institucion,
      monto_estimado: match.monto_estimado,
      cantidad_solicitada: match.cantidad,
      precio_sugerido: precioCalculado,
      margen_calculado: margen,
      estado: margen >= autoBidConfig.margen_minimo ? 'pendiente' : 'descartada',
      fecha_cierre: match.fecha_cierre,
      match_score: match.match_score,
      metadata: {
        precio_mercado: match.monto_estimado / match.cantidad,
        competitividad: calculateCompetitiveness(precioCalculado, match.monto_estimado / match.cantidad),
      },
    });
  }

  // 6. Insertar oportunidades en batch
  if (opportunities.length > 0) {
    const { error: insertError } = await supabase
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

function calculateCompetitivePrice(
  precioBase: number,
  margenMinimo: number,
  topeDescuento: number,
  montoEstimado: number,
  cantidad: number
): number {
  const precioMercado = montoEstimado / cantidad;
  
  // Precio mínimo aceptable (con margen mínimo)
  const precioMinimo = precioBase * (1 + margenMinimo / 100);
  
  // Precio con descuento máximo
  const precioConDescuentoMax = precioBase * (1 - topeDescuento / 100);
  
  // Estrategia: Ofrecer 2-5% por debajo del precio de mercado
  const descuentoCompetitivo = 0.03; // 3%
  const precioObjetivo = precioMercado * (1 - descuentoCompetitivo);
  
  // Asegurar que cumple restricciones
  const precioFinal = Math.max(
    precioMinimo,
    Math.min(precioObjetivo, precioBase * (1 + 0.5)) // Cap al 50% de margen máximo
  );
  
  return Math.round(precioFinal);
}

function calculateCompetitiveness(precioNuestro: number, precioMercado: number): number {
  const diferencia = ((precioMercado - precioNuestro) / precioMercado) * 100;
  return Math.round(Math.max(0, Math.min(100, 50 + diferencia * 2)));
}