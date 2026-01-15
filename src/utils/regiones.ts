/**
 * Utilidades para manejo de regiones y recargos
 */

import type { RegionConfig } from '@/hooks/useUserSettings';

/**
 * Aplica recargo por región al precio neto
 * @param precioNeto Precio neto del producto
 * @param regionNombre Nombre de la región
 * @param regionesConfig Configuración de regiones con recargos
 * @returns Precio con recargo aplicado
 */
export function aplicarRecargoPorRegion(
  precioNeto: number,
  regionNombre: string | null,
  regionesConfig: RegionConfig[] = []
): number {
  if (!regionNombre || !precioNeto || precioNeto <= 0) return precioNeto;
  
  const regionConfig = regionesConfig.find(r => r.nombre === regionNombre && r.activa);
  if (!regionConfig || regionConfig.recargo_porcentaje <= 0) return precioNeto;
  
  return precioNeto * (1 + regionConfig.recargo_porcentaje / 100);
}

/**
 * Obtiene el recargo porcentual para una región
 */
export function obtenerRecargoRegion(
  regionNombre: string | null,
  regionesConfig: RegionConfig[] = []
): number {
  if (!regionNombre) return 0;
  
  const regionConfig = regionesConfig.find(r => r.nombre === regionNombre && r.activa);
  return regionConfig?.recargo_porcentaje || 0;
}

/**
 * Verifica si una región está activa en la configuración
 */
export function esRegionActiva(
  regionNombre: string | null,
  regionesConfig: RegionConfig[] = [],
  regions: string[] = []
): boolean {
  if (!regionNombre) return false;
  
  // Primero verificar en regiones_config
  const regionConfig = regionesConfig.find(r => r.nombre === regionNombre);
  if (regionConfig) return regionConfig.activa;
  
  // Fallback a regions (compatibilidad)
  return regions.includes(regionNombre);
}
