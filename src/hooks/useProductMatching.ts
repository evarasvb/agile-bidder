/**
 * Hook para matching de productos con inventario y catálogo FirmaVB
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ItemConMatch extends ItemRequerido {
  matches: ProductMatch[];
  bestMatch: ProductMatch | null;
}

// Interface para productos de FirmaVB mapeados a formato de inventario
interface ProductoFirmaVBMapped {
  id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string | null;
  categoria: string | null;
  keywords: string[] | null;
  precio_unitario: number;
  margen_minimo: number | null;
  margen_objetivo: number | null;
  stock_disponible: number | null;
  unidad_medida: string | null;
  tiempo_entrega_dias: number | null;
  proveedor: string | null;
  activo: boolean;
  imagen_url: string | null;
  cliente_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  source: 'firmavb'; // Identificador de origen
}

// Hook para obtener productos de FirmaVB
function useProductosFirmaVB() {
  return useQuery({
    queryKey: ['productos-firmavb-para-matching'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('*')
        .eq('activo', true);
      
      if (error) {
        console.error('[useProductosFirmaVB] Error:', error);
        throw error;
      }

      // Mapear al formato de InventoryItem para compatibilidad con fuzzyMatching
      const mapped: ProductoFirmaVBMapped[] = (data || []).map((item: any) => {
        // Parsear precios (vienen como texto con formato "$1.234")
        const parsePrecio = (val: string | null): number => {
          if (!val) return 0;
          const clean = val.replace(/[$.,]/g, '').trim();
          return parseInt(clean, 10) || 0;
        };
        
        // Parsear margen (viene como "20%")
        const parseMargen = (val: string | null): number | null => {
          if (!val) return null;
          const clean = val.replace('%', '').trim();
          return parseFloat(clean) || null;
        };

        return {
          id: `firmavb-${item.id}`,
          sku: item.CODIGO || item.codigo || `FVB-${item.id}`,
          nombre_producto: item.DESCRIPCION || item.descripcion || '',
          descripcion: item.DESCRIPCION || item.descripcion || null,
          categoria: item.CATEGORIA || item.categoria || null,
          keywords: null,
          precio_unitario: parsePrecio(item['Precio de venta neto'] || item.precio_venta_neto),
          margen_minimo: parseMargen(item['Mg Comercial'] || item.margen_comercial),
          margen_objetivo: parseMargen(item['Mg Comercial'] || item.margen_comercial),
          stock_disponible: null,
          unidad_medida: item['Unidad'] || item.unidad || 'UN',
          tiempo_entrega_dias: null,
          proveedor: item.PROVEEDOR || item.proveedor || 'FirmaVB',
          activo: item.activo ?? true,
          imagen_url: null,
          cliente_id: null,
          created_at: item.created_at,
          updated_at: null,
          source: 'firmavb' as const,
        };
      });

      console.log('[useProductosFirmaVB] Loaded', mapped.length, 'products from FirmaVB');
      return mapped;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

export function useProductMatching() {
  const { data: inventario, isLoading: isLoadingInventario } = useInventoryActivo();
  const { data: productosFirmaVB, isLoading: isLoadingFirmaVB } = useProductosFirmaVB();
  
  const isLoading = isLoadingInventario || isLoadingFirmaVB;
  
  // Combinar inventario del cliente con catálogo FirmaVB
  const inventarioCombinado = useMemo(() => {
    const clienteItems = inventario || [];
    const firmaVBItems = productosFirmaVB || [];
    
    // Marcar items del cliente para diferenciarlos
    const clienteItemsMarcados = clienteItems.map(item => ({
      ...item,
      source: 'cliente' as const,
    }));
    
    // Combinar ambas fuentes
    return [...clienteItemsMarcados, ...firmaVBItems];
  }, [inventario, productosFirmaVB]);
  
  /**
   * Busca matches para un item específico en ambas fuentes
   */
  const buscarMatches = useCallback((item: ItemRequerido): ProductMatch[] => {
    if (!inventarioCombinado || inventarioCombinado.length === 0) return [];
    return findMatches(item, inventarioCombinado as InventoryItem[], 10);
  }, [inventarioCombinado]);
  
  /**
   * Encuentra el mejor match para un item
   */
  const buscarMejorMatch = useCallback((item: ItemRequerido): ProductMatch | null => {
    if (!inventarioCombinado || inventarioCombinado.length === 0) return null;
    return findBestMatch(item, inventarioCombinado as InventoryItem[]);
  }, [inventarioCombinado]);
  
  /**
   * Procesa todos los items de una compra y encuentra matches
   */
  const procesarCompra = useCallback((items: ItemRequerido[]): ItemConMatch[] => {
    if (!inventarioCombinado || inventarioCombinado.length === 0) {
      return items.map(item => ({
        ...item,
        matches: [],
        bestMatch: null
      }));
    }
    
    return items.map(item => {
      const matches = findMatches(item, inventarioCombinado as InventoryItem[], 10);
      return {
        ...item,
        matches,
        bestMatch: matches.length > 0 ? matches[0] : null
      };
    });
  }, [inventarioCombinado]);
  
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
    inventario: inventarioCombinado,
    inventarioCliente: inventario,
    inventarioFirmaVB: productosFirmaVB,
    isLoading,
    buscarMatches,
    buscarMejorMatch,
    procesarCompra,
    procesarDescripcion,
    procesarCompraAgil,
    calcularScorePromedio
  };
}
