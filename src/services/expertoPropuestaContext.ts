/**
 * Contexto de propuesta enviado al Experto para auditoría
 * Proporciona datos completos: requisitos, candidatos, precios, discrepancias
 */

export interface MatchContext {
  item_id: string;
  item_nombre: string;
  item_descripcion?: string;
  item_cantidad: number;
  item_unidad: string;

  // Candidato asignado
  candidato_nombre?: string;
  candidato_sku?: string;
  candidato_precio?: number;
  candidato_score?: number;
  candidato_fuente?: 'cliente' | 'firmavb';

  // Validación y anomalías
  tiene_match: boolean;
  es_manual: boolean;
  estado: 'cumplido' | 'parcial' | 'sin_match' | 'descartado' | 'anómalo';
  anomalias?: string[]; // ["precio_cero", "unit_mismatch_15.8cm_vs_5.5", "incompatible_categoria"]
}

export interface PropuestaContextoCompleto {
  codigo: string;
  organismo: string;
  presupuesto?: number;

  // Requisitos y cobertura
  items_requeridos: MatchContext[];
  total_items: number;
  items_con_match: number;
  items_sin_match: number;
  cobertura_porcentaje: number;

  // Totales
  subtotal_oferta: number;
  dentro_presupuesto?: boolean;

  // Discrepancias detectadas
  discrepancias: {
    precio_cero: string[]; // Candidatos con precio=$0
    unidad_incompatible: string[]; // Items con mismatch de unidades
    categoria_incompatible: string[]; // Items con asignación por categoría sola
    precio_anomalo: string[]; // Precios que exceden mucho el presupuesto
  };

  // Datos que FALTA proporcionar
  datos_ausentes: string[]; // ["bases", "documentos", "anexos_obligatorios"]
}

/**
 * Compila el contexto completo de una propuesta para auditoría por Experto
 */
export function compilarContextoPropuesta(params: {
  codigo: string;
  organismo: string;
  presupuesto?: number;
  items: Array<{
    id: string;
    nombre: string;
    descripcion?: string;
    cantidad: number;
    unidad: string;
    estado: 'cumplido' | 'parcial' | 'sin_match' | 'descartado' | 'anómalo';
    match?: {
      nombre: string;
      sku?: string;
      precio?: number;
      score?: number;
      fuente?: 'cliente' | 'firmavb';
    };
    anomalias?: string[];
  }>;
  datosAusentes?: string[];
}): PropuestaContextoCompleto {
  const itemsConMatch = params.items.filter(i => i.match && i.estado !== 'descartado').length;
  const itemsSinMatch = params.items.filter(i => !i.match && i.estado !== 'descartado').length;
  const totalItems = params.items.filter(i => i.estado !== 'descartado').length;
  const cobertura = totalItems > 0 ? (itemsConMatch / totalItems) * 100 : 0;

  const subtotal = params.items.reduce((sum, item) => sum + (item.match?.precio || 0) * item.cantidad, 0);
  const dentroPresupuesto = params.presupuesto ? subtotal <= params.presupuesto : undefined;

  // Clasificar discrepancias
  const discrepancias = {
    precio_cero: [] as string[],
    unidad_incompatible: [] as string[],
    categoria_incompatible: [] as string[],
    precio_anomalo: [] as string[],
  };

  for (const item of params.items) {
    if (!item.match) continue;

    if (item.match.precio === 0) {
      discrepancias.precio_cero.push(`${item.nombre} (${item.match.nombre})`);
    }

    if (item.anomalias) {
      for (const anom of item.anomalias) {
        if (anom.includes('unit_mismatch')) {
          discrepancias.unidad_incompatible.push(`${item.nombre}: ${anom}`);
        } else if (anom.includes('incompatible')) {
          discrepancias.categoria_incompatible.push(`${item.nombre}: ${anom}`);
        } else if (anom.includes('precio_anomalo')) {
          discrepancias.precio_anomalo.push(`${item.nombre}: ${anom}`);
        }
      }
    }

    // Si el match fue SOLO por categoría (score bajo), marcar como sospechoso
    if (item.match.score && item.match.score <= 50) {
      discrepancias.categoria_incompatible.push(
        `${item.nombre} → ${item.match.nombre}: score ${item.match.score}% (posible match débil por categoría)`
      );
    }
  }

  const contexto: MatchContext[] = params.items.map((item) => ({
    item_id: item.id,
    item_nombre: item.nombre,
    item_descripcion: item.descripcion,
    item_cantidad: item.cantidad,
    item_unidad: item.unidad,
    candidato_nombre: item.match?.nombre,
    candidato_sku: item.match?.sku,
    candidato_precio: item.match?.precio,
    candidato_score: item.match?.score,
    candidato_fuente: item.match?.fuente,
    tiene_match: !!item.match,
    es_manual: false, // TODO: pasar desde componente si es agregado manualmente
    estado: item.estado,
    anomalias: item.anomalias,
  }));

  return {
    codigo: params.codigo,
    organismo: params.organismo,
    presupuesto: params.presupuesto,
    items_requeridos: contexto,
    total_items: totalItems,
    items_con_match: itemsConMatch,
    items_sin_match: itemsSinMatch,
    cobertura_porcentaje: Math.round(cobertura),
    subtotal_oferta: subtotal,
    dentro_presupuesto: dentroPresupuesto,
    discrepancias,
    datos_ausentes: params.datosAusentes || [],
  };
}

/**
 * Formatea el contexto como texto legible para el Experto
 */
export function formatearContextoParaExperto(ctx: PropuestaContextoCompleto): string {
  const lineas: string[] = [];

  lineas.push(`# Contexto de Propuesta: ${ctx.codigo}`);
  lineas.push(`Organismo: ${ctx.organismo}`);
  if (ctx.presupuesto) lineas.push(`Presupuesto: $${ctx.presupuesto.toLocaleString('es-CL')}`);
  lineas.push('');

  lineas.push(`## Cobertura`);
  lineas.push(`- Total de ítems: ${ctx.total_items}`);
  lineas.push(`- Con match: ${ctx.items_con_match} (${ctx.cobertura_porcentaje}%)`);
  lineas.push(`- Sin match: ${ctx.items_sin_match}`);
  if (!ctx.dentro_presupuesto && ctx.presupuesto) {
    lineas.push(`⚠ EXCEDE PRESUPUESTO: $${ctx.subtotal_oferta.toLocaleString('es-CL')} vs $${ctx.presupuesto.toLocaleString('es-CL')}`);
  } else if (ctx.cobertura_porcentaje < 100) {
    lineas.push(`⚠ PROPUESTA INCOMPLETA: Falta cotizar ${ctx.items_sin_match} ítems`);
  }
  lineas.push('');

  if (Object.values(ctx.discrepancias).some(arr => arr.length > 0)) {
    lineas.push(`## Discrepancias Detectadas`);
    if (ctx.discrepancias.precio_cero.length > 0) {
      lineas.push(`Precios cero: ${ctx.discrepancias.precio_cero.join('; ')}`);
    }
    if (ctx.discrepancias.unidad_incompatible.length > 0) {
      lineas.push(`Unidad incompatible: ${ctx.discrepancias.unidad_incompatible.join('; ')}`);
    }
    if (ctx.discrepancias.categoria_incompatible.length > 0) {
      lineas.push(`Categoría sospechosa: ${ctx.discrepancias.categoria_incompatible.join('; ')}`);
    }
    if (ctx.discrepancias.precio_anomalo.length > 0) {
      lineas.push(`Precio anómalo: ${ctx.discrepancias.precio_anomalo.join('; ')}`);
    }
    lineas.push('');
  }

  if (ctx.datos_ausentes.length > 0) {
    lineas.push(`## Documentación Faltante`);
    lineas.push(ctx.datos_ausentes.map(d => `- ${d}`).join('\n'));
    lineas.push('');
  }

  return lineas.join('\n');
}
