/**
 * Hook para matching de productos con inventario
 */

import { useMemo, useCallback } from 'react';
import { useInventoryActivo, type InventoryItem } from './useInventory';
import { 
  findMatches, 
  findBestMatch, 
  extractItemsFromDescription,
  processCompraMatches,
  type ProductMatch,
  type ItemRequerido 
} from '@/services/fuzzyMatching';
import type { CompraAgil } from './useComprasAgiles';

export interface ItemConMatch extends ItemRequerido {
  matches: ProductMatch[];
  bestMatch: ProductMatch | null;
}

export function useProductMatching() {
  const { data: inventario, isLoading } = useInventoryActivo();
  
  /**
   * Busca matches para un item específico
   */
  const buscarMatches = useCallback((item: ItemRequerido): ProductMatch[] => {
    if (!inventario || inventario.length === 0) return [];
    return findMatches(item, inventario, 5);
  }, [inventario]);
  
  /**
   * Encuentra el mejor match para un item
   */
  const buscarMejorMatch = useCallback((item: ItemRequerido): ProductMatch | null => {
    if (!inventario || inventario.length === 0) return null;
    return findBestMatch(item, inventario);
  }, [inventario]);
  
  /**
   * Procesa todos los items de una compra y encuentra matches
   */
  const procesarCompra = useCallback((items: ItemRequerido[]): ItemConMatch[] => {
    if (!inventario || inventario.length === 0) {
      return items.map(item => ({
        ...item,
        matches: [],
        bestMatch: null
      }));
    }
    
    return items.map(item => {
      const matches = findMatches(item, inventario, 5);
      return {
        ...item,
        matches,
        bestMatch: matches.length > 0 ? matches[0] : null
      };
    });
  }, [inventario]);
  
  /**
   * Extrae items de la descripción de una compra y busca matches
   */
  const procesarDescripcion = useCallback((descripcion: string): ItemConMatch[] => {
    const items = extractItemsFromDescription(descripcion);
    return procesarCompra(items);
  }, [procesarCompra]);
  
  /**
   * Procesa una compra completa usando descripción o items JSON
   */
  const procesarCompraAgil = useCallback((compra: CompraAgil): ItemConMatch[] => {
    // Primero intentar usar items_json si existe
    const datosJson = compra.datos_json;
    if (datosJson && typeof datosJson === 'object') {
      const itemsJson = (datosJson as any).items;
      if (Array.isArray(itemsJson) && itemsJson.length > 0) {
        const items: ItemRequerido[] = itemsJson.map((item: any, idx: number) => ({
          id: item.id || `json-${idx}`,
          nombre: item.nombre || item.nombre_producto || item.descripcion || '',
          descripcion: item.descripcion || '',
          cantidad: item.cantidad || 1,
          unidad: item.unidad || 'UN'
        }));
        return procesarCompra(items);
      }
    }
    
    // Si no hay items JSON, extraer de la descripción
    if (compra.descripcion) {
      return procesarDescripcion(compra.descripcion);
    }
    
    // Si solo hay nombre, usarlo como único item
    return procesarCompra([{
      id: 'nombre-0',
      nombre: compra.nombre,
      cantidad: 1,
      unidad: 'UN'
    }]);
  }, [procesarCompra, procesarDescripcion]);
  
  /**
   * Calcula score promedio de match para una compra
   */
  const calcularScorePromedio = useCallback((itemsConMatch: ItemConMatch[]): number => {
    const itemsConBestMatch = itemsConMatch.filter(i => i.bestMatch !== null);
    if (itemsConBestMatch.length === 0) return 0;
    
    const sumaScores = itemsConBestMatch.reduce(
      (sum, item) => sum + (item.bestMatch?.score || 0), 
      0
    );
    return Math.round(sumaScores / itemsConBestMatch.length);
  }, []);
  
  return {
    inventario,
    isLoading,
    buscarMatches,
    buscarMejorMatch,
    procesarCompra,
    procesarDescripcion,
    procesarCompraAgil,
    calcularScorePromedio
  };
}
