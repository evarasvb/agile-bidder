/**
 * Utilidades para clasificar procesos de compra según monto
 * 
 * REGLA DE NEGOCIO:
 * - LICITACIONES: Monto > 100 UTM
 * - COMPRAS ÁGILES: Monto <= 100 UTM
 */

// Valores UTM (actualizar mensualmente según Banco Central)
// Fuente: https://si3.bcentral.cl/bdemovil/BDE/Series/MOV_SC_PR12
export const UTM_2025_DIC = 69542; // CLP - Diciembre 2025
export const UTM_2026_ENE = 69751; // CLP - Enero 2026

// Valor actual (usar el del mes correspondiente)
export const UTM_ACTUAL = UTM_2026_ENE;

// Umbral: 100 UTM
// REGLA DE NEGOCIO: > 100 UTM = LICITACIÓN, <= 100 UTM = COMPRA ÁGIL
export const UMBRAL_LICITACION_UTM = 100;
export const UMBRAL_LICITACION_CLP = UMBRAL_LICITACION_UTM * UTM_ACTUAL; // $6.975.100 CLP

/**
 * Determina si un proceso es una LICITACIÓN o COMPRA ÁGIL basado en el monto
 * 
 * @param monto Monto en CLP (pesos chilenos)
 * @returns 'licitacion' si monto > 100 UTM, 'compra_agil' si monto <= 100 UTM
 */
export function clasificarProceso(monto: number | null | undefined): 'licitacion' | 'compra_agil' {
  if (!monto || monto === 0) {
    // Si no hay monto, por defecto es compra ágil (más común)
    return 'compra_agil';
  }
  
  return monto > UMBRAL_LICITACION_CLP ? 'licitacion' : 'compra_agil';
}

/**
 * Obtiene el tipo de proceso como string legible
 */
export function getTipoProceso(monto: number | null | undefined): string {
  return clasificarProceso(monto) === 'licitacion' ? 'Licitación' : 'Compra Ágil';
}

/**
 * Calcula el monto en UTM
 */
export function montoEnUTM(montoCLP: number | null | undefined): number | null {
  if (!montoCLP || montoCLP === 0) return null;
  return montoCLP / UTM_ACTUAL;
}

/**
 * Verifica si un monto supera el umbral de licitación
 */
export function esLicitacion(monto: number | null | undefined): boolean {
  return clasificarProceso(monto) === 'licitacion';
}

/**
 * Verifica si un monto es compra ágil
 */
export function esCompraAgil(monto: number | null | undefined): boolean {
  return clasificarProceso(monto) === 'compra_agil';
}
