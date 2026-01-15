/**
 * Utilidades para clasificar procesos de compra según monto
 * 
 * REGLA DE NEGOCIO (MercadoPúblico):
 * - COMPRAS ÁGILES: Monto <= 100 UTM (L1 - Licitación Pública Menor)
 * - LICITACIONES: Monto > 100 UTM
 *   - LE: 100 a 1.000 UTM (Intermedia)
 *   - LP: 1.000 a 5.000 UTM (Mayor)
 *   - LR: > 5.000 UTM (Gran Compra)
 * 
 * Fuente: Ley N° 19.886 y modificaciones 2024-2025
 */

// Valores UTM (actualizar mensualmente según Banco Central)
// Fuente: https://si3.bcentral.cl/bdemovil/BDE/Series/MOV_SC_PR12
export const UTM_2025_DIC = 69542; // CLP - Diciembre 2025
export const UTM_2026_ENE = 69751; // CLP - Enero 2026

// Valor actual (usar el del mes correspondiente)
export const UTM_ACTUAL = UTM_2026_ENE;

// Umbrales según categorías de MercadoPúblico
export const UMBRAL_COMPRA_AGIL_UTM = 100; // L1: < 100 UTM
export const UMBRAL_LE_UTM = 1000; // LE: 100 a 1.000 UTM
export const UMBRAL_LP_UTM = 5000; // LP: 1.000 a 5.000 UTM
// LR: > 5.000 UTM

export const UMBRAL_COMPRA_AGIL_CLP = UMBRAL_COMPRA_AGIL_UTM * UTM_ACTUAL; // $6.975.100 CLP
export const UMBRAL_LE_CLP = UMBRAL_LE_UTM * UTM_ACTUAL; // $69.751.000 CLP
export const UMBRAL_LP_CLP = UMBRAL_LP_UTM * UTM_ACTUAL; // $348.755.000 CLP

export type TipoProceso = 'compra_agil' | 'licitacion';
export type CategoriaLicitacion = 'L1' | 'LE' | 'LP' | 'LR';

export interface ClasificacionProceso {
  tipo: TipoProceso;
  categoria: CategoriaLicitacion;
  montoUTM: number | null;
  requiereFEA: boolean; // Firma Electrónica Avanzada
  requiereGarantia: boolean;
  plazoMinimoDias: number;
}

/**
 * Clasifica un proceso según su monto según las reglas de MercadoPúblico
 * 
 * @param monto Monto en CLP (pesos chilenos)
 * @returns Clasificación completa del proceso
 */
export function clasificarProceso(monto: number | null | undefined): ClasificacionProceso {
  if (!monto || monto === 0) {
    // Sin monto = compra ágil por defecto (más común)
    return {
      tipo: 'compra_agil',
      categoria: 'L1',
      montoUTM: null,
      requiereFEA: false,
      requiereGarantia: false,
      plazoMinimoDias: 5
    };
  }
  
  const montoUTM = monto / UTM_ACTUAL;
  
  // L1: < 100 UTM = COMPRA ÁGIL
  if (montoUTM < UMBRAL_COMPRA_AGIL_UTM) {
    return {
      tipo: 'compra_agil',
      categoria: 'L1',
      montoUTM,
      requiereFEA: false,
      requiereGarantia: false,
      plazoMinimoDias: 5
    };
  }
  
  // LE: 100 a 1.000 UTM = LICITACIÓN INTERMEDIA
  if (montoUTM < UMBRAL_LE_UTM) {
    return {
      tipo: 'licitacion',
      categoria: 'LE',
      montoUTM,
      requiereFEA: false, // Discrecional
      requiereGarantia: false, // Discrecional
      plazoMinimoDias: 10
    };
  }
  
  // LP: 1.000 a 5.000 UTM = LICITACIÓN MAYOR
  if (montoUTM < UMBRAL_LP_UTM) {
    return {
      tipo: 'licitacion',
      categoria: 'LP',
      montoUTM,
      requiereFEA: true, // A menudo obligatoria
      requiereGarantia: true, // 5% del contrato
      plazoMinimoDias: 20
    };
  }
  
  // LR: > 5.000 UTM = LICITACIÓN DE GRAN COMPRA
  return {
    tipo: 'licitacion',
    categoria: 'LR',
    montoUTM,
    requiereFEA: true,
    requiereGarantia: true,
    plazoMinimoDias: 30
  };
}

/**
 * Determina si un proceso es una LICITACIÓN o COMPRA ÁGIL (simplificado)
 */
export function esLicitacion(monto: number | null | undefined): boolean {
  return clasificarProceso(monto).tipo === 'licitacion';
}

/**
 * Determina si un proceso es COMPRA ÁGIL (simplificado)
 */
export function esCompraAgil(monto: number | null | undefined): boolean {
  return clasificarProceso(monto).tipo === 'compra_agil';
}

/**
 * Obtiene el tipo de proceso como string legible
 */
export function getTipoProceso(monto: number | null | undefined): string {
  const clasificacion = clasificarProceso(monto);
  return clasificacion.tipo === 'licitacion' 
    ? `Licitación ${clasificacion.categoria}` 
    : 'Compra Ágil';
}

/**
 * Calcula el monto en UTM
 */
export function montoEnUTM(montoCLP: number | null | undefined): number | null {
  if (!montoCLP || montoCLP === 0) return null;
  return montoCLP / UTM_ACTUAL;
}

/**
 * Obtiene la categoría de licitación (L1, LE, LP, LR)
 */
export function getCategoria(monto: number | null | undefined): CategoriaLicitacion {
  return clasificarProceso(monto).categoria;
}
