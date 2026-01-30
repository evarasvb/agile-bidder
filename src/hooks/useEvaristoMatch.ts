/**
 * useEvaristoMatch - Sistema de matching inteligente item por item
 * Evaristo compara cada item de licitación contra el inventario del cliente
 * Similar al sistema de Lici: genera ofertas automáticas con precios del inventario
 */

import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import type { InventoryItem } from './useInventory';

// Tipos
export interface LicitacionItem {
  id: string;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
  codigo_producto: string | null;
}

export interface ItemMatch {
  licitacionItem: LicitacionItem;
  inventoryItem: InventoryItem | null;
  score: number;
  matchedTerms: string[];
  precioUnitario: number | null;
  precioTotal: number | null;
}

export interface EvaristoMatchResult {
  licitacionId: string;
  codigo: string;
  titulo: string;
  totalItems: number;
  itemsMatcheados: number;
  porcentajeMatch: number;
  matches: ItemMatch[];
  totalNeto: number;
  totalIVA: number;
  totalFinal: number;
}

// Marcas conocidas
const KNOWN_BRANDS = [
  'hp', 'canon', 'epson', 'brother', 'samsung', 'lenovo', 'dell', 'asus',
  'logitech', 'microsoft', 'apple', 'acer', 'toshiba', 'xerox', 'lexmark',
  'bic', 'pilot', 'faber-castell', 'stabilo', 'pentel', 'sharpie'
];

// Tipos de producto
const PRODUCT_TYPES = [
  'toner', 'tóner', 'cartucho', 'tinta', 'ink',
  'papel', 'resma', 'hoja',
  'notebook', 'laptop', 'computador', 'pc',
  'monitor', 'pantalla', 'display',
  'teclado', 'keyboard', 'mouse', 'ratón',
  'impresora', 'printer', 'scanner', 'escáner',
  'silla', 'escritorio', 'mesa', 'mueble',
  'archivador', 'carpeta', 'folder',
  'lápiz', 'bolígrafo', 'pluma', 'marcador'
];

/**
 * Normaliza texto para comparación
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae palabras clave
 */
function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length > 2);
  const stopwords = new Set(['para', 'con', 'sin', 'por', 'del', 'las', 'los', 'una', 'uno', 'que', 'the', 'and']);
  return words.filter(w => !stopwords.has(w));
}

/**
 * Calcula similitud entre dos textos (Jaccard similarity)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let matchCount = 0;
  words1.forEach(word => {
    if (words2.has(word)) matchCount++;
  });
  
  const union = new Set([...words1, ...words2]);
  return (matchCount / union.size) * 100;
}

/**
 * Encuentra match de marca
 */
function findBrandMatch(text1: string, text2: string): string | null {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  for (const brand of KNOWN_BRANDS) {
    if (norm1.includes(brand) && norm2.includes(brand)) {
      return brand;
    }
  }
  return null;
}

/**
 * Encuentra match de tipo de producto
 */
function findProductTypeMatch(text1: string, text2: string): string | null {
  const norm1 = normalizeText(text1);
  const norm2 = normalizeText(text2);
  
  for (const type of PRODUCT_TYPES) {
    if (norm1.includes(type) && norm2.includes(type)) {
      return type;
    }
  }
  return null;
}

/**
 * Calcula score de match entre item de licitación y producto del inventario
 */
function calculateMatchScore(
  licitacionItem: LicitacionItem,
  inventoryItem: InventoryItem
): { score: number; matchedTerms: string[] } {
  const matchedTerms: string[] = [];
  let score = 0;
  
  const licitacionText = `${licitacionItem.nombre_producto} ${licitacionItem.descripcion || ''}`;
  const inventoryText = `${inventoryItem.nombre_producto} ${inventoryItem.descripcion || ''} ${(inventoryItem.keywords || []).join(' ')}`;
  
  // 1. Match de marca (peso alto: +40)
  const brandMatch = findBrandMatch(licitacionText, inventoryText);
  if (brandMatch) {
    score += 40;
    matchedTerms.push(`Marca: ${brandMatch}`);
  }
  
  // 2. Match de tipo de producto (peso alto: +35)
  const typeMatch = findProductTypeMatch(licitacionText, inventoryText);
  if (typeMatch) {
    score += 35;
    matchedTerms.push(`Tipo: ${typeMatch}`);
  }
  
  // 3. Similitud general (peso: hasta +25)
  const similarity = calculateSimilarity(licitacionText, inventoryText);
  if (similarity > 10) {
    const similarityScore = Math.min(similarity * 0.5, 25);
    score += similarityScore;
    if (similarity > 20) {
      matchedTerms.push(`Similitud: ${Math.round(similarity)}%`);
    }
  }
  
  // 4. Match de keywords (+bonus)
  const keywords = inventoryItem.keywords || [];
  const licitacionNorm = normalizeText(licitacionText);
  
  for (const keyword of keywords) {
    if (licitacionNorm.includes(normalizeText(keyword))) {
      score += 5;
      if (!matchedTerms.some(t => t.includes(keyword))) {
        matchedTerms.push(`Keyword: ${keyword}`);
      }
    }
  }
  
  return { score: Math.min(score, 100), matchedTerms };
}

/**
 * Encuentra el mejor match del inventario para un item de licitación
 */
function findBestMatch(
  licitacionItem: LicitacionItem,
  inventory: InventoryItem[],
  threshold: number = 25
): { inventoryItem: InventoryItem | null; score: number; matchedTerms: string[] } {
  let bestMatch: InventoryItem | null = null;
  let bestScore = 0;
  let bestTerms: string[] = [];
  
  for (const invItem of inventory) {
    const { score, matchedTerms } = calculateMatchScore(licitacionItem, invItem);
    
    if (score >= threshold && score > bestScore) {
      bestMatch = invItem;
      bestScore = score;
      bestTerms = matchedTerms;
    }
  }
  
  return { inventoryItem: bestMatch, score: bestScore, matchedTerms: bestTerms };
}

/**
 * Hook principal: Evaristo Match - Matching item por item
 * @param licitacionId ID de la licitación
 * @param threshold Score mínimo para considerar un match (default: 25)
 */
export function useEvaristoMatch(licitacionId: string | null, threshold: number = 25) {
  return useQuery({
    queryKey: ['evaristo-match', licitacionId, threshold],
    queryFn: async (): Promise<EvaristoMatchResult | null> => {
      if (!licitacionId) return null;
      
      // 1. Obtener info de la licitación
      const { data: licitacion, error: licitacionError } = await supabase
        .from('licitaciones')
              .select('*')
              .eq('id', licitacionId)        
                    .single();
      
      if (licitacionError || !licitacion) {
        console.error('[useEvaristoMatch] Error obteniendo licitación:', licitacionError);
        return null;
      }
      
      // 2. Obtener items de la licitación
      const { data: items, error: itemsError } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_id', licitacionId);
      
      if (itemsError) {
        console.error('[useEvaristoMatch] Error obteniendo items:', itemsError);
        return null;
      }
      
      const licitacionItems = items || [];
      
      // 3. Obtener cliente_id del usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          licitacionId,
          codigo: licitacion.codigo,
          titulo: licitacion.nombre,
          totalItems: licitacionItems.length,
          itemsMatcheados: 0,
          porcentajeMatch: 0,
          matches: [],
          totalNeto: 0,
          totalIVA: 0,
          totalFinal: 0
        };
      }
      
      // 4. Obtener inventario del cliente
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('cliente_id', user.id)
        .eq('activo', true);
      
      if (inventoryError) {
        console.error('[useEvaristoMatch] Error obteniendo inventario:', inventoryError);
        return null;
      }
      
      // Mapear inventario a InventoryItem
      const inventory: InventoryItem[] = (inventoryData || []).map(row => ({
        id: row.id,
        sku: row.sku,
        nombre_producto: row.nombre,
        descripcion: row.descripcion,
        categoria: row.categoria,
        keywords: row.palabras_clave,
        precio_unitario: row.precio_unitario,
        margen_minimo: row.margen_minimo,
        margen_objetivo: row.margen_minimo,
        stock_disponible: row.stock,
        unidad_medida: 'unidad',
        tiempo_entrega_dias: row.tiempo_entrega_dias,
        proveedor: null,
        activo: row.activo,
        imagen_url: row.imagen_url,
        cliente_id: row.cliente_id,
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
      
      // 5. Hacer matching item por item
      const matches: ItemMatch[] = [];
      let totalNeto = 0;
      let itemsMatcheados = 0;
      
      for (const licitacionItem of licitacionItems) {
        const { inventoryItem, score, matchedTerms } = findBestMatch(
          licitacionItem as LicitacionItem,
          inventory,
          threshold
        );
        
        const cantidad = licitacionItem.cantidad || 1;
        const precioUnitario = inventoryItem?.precio_unitario || null;
        const precioTotal = precioUnitario ? precioUnitario * cantidad : null;
        
        if (precioTotal) {
          totalNeto += precioTotal;
        }
        
        if (inventoryItem) {
          itemsMatcheados++;
        }
        
        matches.push({
          licitacionItem: licitacionItem as LicitacionItem,
          inventoryItem,
          score,
          matchedTerms,
          precioUnitario,
          precioTotal
        });
      }
      
      // 6. Calcular totales
      const totalIVA = totalNeto * 0.19;
      const totalFinal = totalNeto + totalIVA;
      const porcentajeMatch = licitacionItems.length > 0
        ? Math.round((itemsMatcheados / licitacionItems.length) * 100)
        : 0;
      
      return {
        licitacionId,
        codigo: licitacion.codigo,
        titulo: licitacion.nombre,
        totalItems: licitacionItems.length,
        itemsMatcheados,
        porcentajeMatch,
        matches,
        totalNeto,
        totalIVA,
        totalFinal
      };
    },
    enabled: !!licitacionId,
    staleTime: 60000 // Cache por 1 minuto
  });
}
