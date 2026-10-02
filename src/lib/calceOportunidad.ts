/**
 * Cobertura y calidad del calce son DOS COSAS DISTINTAS.
 *
 *   cobertura = ítems con candidato / ítems pedidos
 *   calidad   = promedio de los scores de esos candidatos
 *
 * El panel mostraba solo la cobertura, rotulada "% match". Medido el 2 de
 * octubre de 2026 sobre las 819 compras ágiles abiertas con match de un
 * cliente real: 598 daban cobertura 100% y de esas 548 (92%) tenían calidad
 * media bajo 60; 359 bajo 50. El caso que lo retrata: una compra de un solo
 * ítem ("Cinturones de seguridad") cuyo único candidato era "TINTA PARA TAMPON
 * COLOR NEGRO" con score 46,9 aparecía como "100% match", arriba de la lista.
 *
 * Estas funciones viven acá, puras y con test, para que el criterio no vuelva
 * a quedar escondido dentro de un `map` de 40 líneas.
 */

/** Piso bajo el cual un candidato es ruido y no se cuenta como calce. */
export const PISO_CALCE = 40;

/**
 * Promedio de los scores de los ítems que calzaron, redondeado.
 * Devuelve null si no hay ninguno: "no sé" es distinto de "cero".
 */
export function calidadCalce(scores: readonly number[]): number | null {
  const validos = scores.filter((s) => Number.isFinite(s));
  if (validos.length === 0) return null;
  return Math.round(validos.reduce((a, b) => a + b, 0) / validos.length);
}

/** Cobertura en porcentaje, o null si no se puede calcular. */
export function coberturaCalce(itemsMatched: number, itemsCount: number): number | null {
  if (!Number.isFinite(itemsCount) || itemsCount <= 0) return null;
  if (!Number.isFinite(itemsMatched) || itemsMatched <= 0) return null;
  return Math.round((itemsMatched / itemsCount) * 100);
}

export interface EtiquetaCalce {
  /** Texto de la insignia. Nunca dice "% match" a secas. */
  texto: string;
  /** Con qué número colorear: la calidad, no la cobertura. */
  tono: number | null;
  /** true cuando hay calidad medida y está sobre el piso. */
  confiable: boolean;
}

/**
 * Qué decir en la tarjeta. Cuando hay calidad medida manda la calidad y la
 * cobertura va como contexto ("47% calce · 1/1 ítems"). Cuando no hay calidad
 * se informa solo la cobertura, dicha con sus palabras ("3/3 ítems con
 * candidato"), sin disfrazarla de porcentaje de match.
 */
export function etiquetaCalce(args: {
  calidad: number | null;
  itemsMatched: number;
  itemsCount: number;
}): EtiquetaCalce | null {
  const { calidad, itemsMatched, itemsCount } = args;
  const cobertura = coberturaCalce(itemsMatched, itemsCount);
  const detalle = cobertura !== null ? ` · ${itemsMatched}/${itemsCount} ítems` : '';

  if (calidad !== null && calidad >= PISO_CALCE) {
    return { texto: `${calidad}% calce${detalle}`, tono: calidad, confiable: true };
  }
  if (cobertura !== null) {
    return {
      texto: `${itemsMatched}/${itemsCount} ítems con candidato`,
      tono: calidad,
      confiable: false,
    };
  }
  return null;
}
