/**
 * Hook para matching de productos de licitación con inventario
 * Usa fuzzy matching inteligente con marcas y categorías
 * Usa cliente_inventario como fuente de datos
 */

import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import type { InventoryItem } from './useInventory';

export interface ProductMatch {
  inventoryItem: InventoryItem;
  licitacionItem: LicitacionItemBasic;
  score: number;
  matchedTerms: string[];
}

export interface LicitacionItemBasic {
  id: number;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

export interface LicitacionMatchResult {
  licitacionId: string;
  totalItems: number;
  matchedItems: number;
  matches: ProductMatch[];
}

// Marcas conocidas para matching
const KNOWN_BRANDS = [
  'hp', 'canon', 'epson', 'brother', 'samsung', 'lenovo', 'dell', 'asus', 
  'logitech', 'microsoft', 'apple', 'acer', 'toshiba', 'xerox', 'lexmark',
  'bic', 'pilot', 'faber-castell', 'stabilo', 'pentel', 'sharpie'
];

// Tipos de producto para matching
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
 * Extrae palabras clave de un texto
 */
function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length > 2);
  
  // Filtrar stopwords
  const stopwords = new Set(['para', 'con', 'sin', 'por', 'del', 'las', 'los', 'una', 'uno', 'que', 'the', 'and']);
  return words.filter(w => !stopwords.has(w));
}

/**
 * Calcula score de similitud entre dos textos
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let matchCount = 0;
  
  words1.forEach(word => {
    if (words2.has(word)) {
      matchCount++;
    }
  });
  
  // Jaccard similarity
  const union = new Set([...words1, ...words2]);
  return (matchCount / union.size) * 100;
}

/**
 * Busca coincidencias de marca
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
 * Busca coincidencias de tipo de producto
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
 * Helper to get current user's cliente_id
 */
async function getClienteId(): Promise<string | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

/**
 * Map database row to InventoryItem
 */
function mapRowToInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    sku: row.sku,
    nombre_producto: row.nombre,
    descripcion: row.descripcion,
    categoria: row.categoria,
    keywords: row.palabras_clave,
    precio_unitario: row.precio_unitario,
    margen_minimo: row.margen_minimo,
    margen_objetivo: row.margen_minimo, // Use same value as fallback
    stock_disponible: row.stock,
    unidad_medida: 'unidad', // Default
    tiempo_entrega_dias: row.tiempo_entrega_dias,
    proveedor: null, // Not in table
    activo: row.activo,
    imagen_url: row.imagen_url,
    cliente_id: row.cliente_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Calcula el score de match entre un item de licitación y un producto del inventario
 */
function calculateMatchScore(
  licitacionItem: LicitacionItemBasic,
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
  
  // 3. Similitud general de texto (peso: hasta +25)
  const similarity = calculateSimilarity(licitacionText, inventoryText);
  if (similarity > 10) {
    const similarityScore = Math.min(similarity * 0.5, 25);
    score += similarityScore;
    if (similarity > 20) {
      matchedTerms.push(`Similitud: ${Math.round(similarity)}%`);
    }
  }
  
  // 4. Match de keywords del inventario (+bonus)
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
 * Interface para match de producto mejorado (matching directo por título)
 */
export interface DirectProductMatch {
  inventoryItem: InventoryItem;
  score: number;
  matchedTerms: string[];
}

export interface DirectMatchResult {
  licitacionId: string;
  titulo: string;
  totalMatches: number;
  matches: DirectProductMatch[];
}

/**
 * Hook para obtener matches de productos para una licitación
 * MEJORADO: Hace matching directo por título de licitación contra inventario
 * Usa cliente_inventario como fuente de datos
 */
export function useLicitacionProductMatch(licitacionId: string | null, licitacionTitulo?: string) {
  return useQuery({
    queryKey: ['licitacion-product-match', licitacionId],
    queryFn: async (): Promise<LicitacionMatchResult | null> => {
      if (!licitacionId) return null;
      
      const clienteId = await getClienteId();
      if (!clienteId) {
        console.log('[useLicitacionProductMatch] No authenticated user');
        return {
          licitacionId,
          totalItems: 1,
          matchedItems: 0,
          matches: []
        };
      }
      
      // Fetch inventory from cliente_inventario with pagination
      const allInventory: InventoryItem[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('*')
          .eq('cliente_id', clienteId)
          .eq('activo', true)
          .range(from, to);

        if (error) {
          console.error('[useLicitacionProductMatch] Error:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allInventory.push(...data.map(mapRowToInventoryItem));
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      if (allInventory.length === 0) {
        return {
          licitacionId,
          totalItems: 1,
          matchedItems: 0,
          matches: []
        };
      }
      
      const matches: ProductMatch[] = [];
      const licitacionText = licitacionTitulo || licitacionId;
      
      // Crear un "item virtual" basado en el título de la licitación
      const virtualItem: LicitacionItemBasic = {
        id: 0,
        nombre_producto: licitacionText,
        descripcion: null,
        cantidad: 1,
        unidad: 'un'
      };
      
      // Buscar matches en el inventario
      for (const invItem of allInventory) {
        const inventoryText = `${invItem.nombre_producto} ${invItem.descripcion || ''} ${(invItem.keywords || []).join(' ')}`;
        const matchedTerms: string[] = [];
        let score = 0;
        
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
        
        // 3. Similitud general de texto (peso: hasta +25)
        const similarity = calculateSimilarity(licitacionText, inventoryText);
        if (similarity > 10) {
          const similarityScore = Math.min(similarity * 0.5, 25);
          score += similarityScore;
          if (similarity > 20) {
            matchedTerms.push(`Similitud: ${Math.round(similarity)}%`);
          }
        }
        
        // 4. Match de keywords del inventario (+bonus)
        const keywords = invItem.keywords || [];
        const licitacionNorm = normalizeText(licitacionText);
        
        for (const keyword of keywords) {
          if (licitacionNorm.includes(normalizeText(keyword))) {
            score += 5;
            if (!matchedTerms.some(t => t.includes(keyword))) {
              matchedTerms.push(`Keyword: ${keyword}`);
            }
          }
        }
        
        // Umbral mínimo de 25 para considerar como match
        if (score >= 25) {
          matches.push({
            inventoryItem: invItem,
            licitacionItem: virtualItem,
            score: Math.min(score, 100),
            matchedTerms
          });
        }
      }
      
      // Ordenar por score descendente
      matches.sort((a, b) => b.score - a.score);
      
      return {
        licitacionId,
        totalItems: 1,
        matchedItems: matches.length > 0 ? 1 : 0,
        matches
      };
    },
    enabled: !!licitacionId,
    staleTime: 60000, // Cache por 1 minuto
  });
}

/**
 * Interfaz para licitación con título
 */
export interface LicitacionBasic {
  id: string;
  codigo: string;
  titulo: string;
  descripcion?: string | null;
}

/**
 * Calcula un score de match entre 0-100 basado en marca, tipo y similitud
 */
function calculateMatchScoreSimple(
  licitacionText: string,
  inventoryText: string
): number {
  let score = 0;
  
  // 1. Match de marca (peso alto: +40)
  const brandMatch = findBrandMatch(licitacionText, inventoryText);
  if (brandMatch) {
    score += 40;
  }
  
  // 2. Match de tipo de producto (peso alto: +35)
  const typeMatch = findProductTypeMatch(licitacionText, inventoryText);
  if (typeMatch) {
    score += 35;
  }
  
  // 3. Similitud general de texto (peso: hasta +25)
  const similarity = calculateSimilarity(licitacionText, inventoryText);
  if (similarity > 10) {
    score += Math.min(similarity * 0.5, 25);
  }
  
  return Math.min(score, 100);
}

/**
 * Hook para obtener conteo rápido de matches para múltiples licitaciones
 * Usa cliente_inventario como fuente de datos
 * @param licitaciones Lista de licitaciones a evaluar
 * @param threshold Umbral mínimo de score (0-100) para considerar un match. Default: 70
 */
export function useLicitacionMatchCounts(licitaciones: LicitacionBasic[], threshold: number = 70) {
  return useQuery({
    queryKey: ['licitacion-match-counts', licitaciones.map(l => l.id), threshold],
    queryFn: async (): Promise<Map<string, number>> => {
      if (licitaciones.length === 0) return new Map();
      
      const clienteId = await getClienteId();
      if (!clienteId) {
        console.log('[useLicitacionMatchCounts] No authenticated user');
        const matchCounts = new Map<string, number>();
        licitaciones.forEach(l => matchCounts.set(l.id, 0));
        return matchCounts;
      }
      
      // Fetch inventory from cliente_inventario with pagination
      const allInventory: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from('cliente_inventario')
          .select('id, nombre, descripcion, palabras_clave, activo')
          .eq('cliente_id', clienteId)
          .eq('activo', true)
          .range(from, to);

        if (error) {
          console.error('[useLicitacionMatchCounts] Error:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allInventory.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      const matchCounts = new Map<string, number>();
      
      if (allInventory.length === 0) {
        // Sin inventario, todos los conteos son 0
        licitaciones.forEach(l => matchCounts.set(l.id, 0));
        return matchCounts;
      }
      
      console.log(`Matching ${licitaciones.length} licitaciones contra ${allInventory.length} productos del inventario (threshold: ${threshold}%)`);
      
      // Calcular matches para cada licitación por título/descripción
      for (const licitacion of licitaciones) {
        const licitacionText = `${licitacion.titulo} ${licitacion.descripcion || ''}`;
        let matchCount = 0;
        
        for (const invItem of allInventory) {
          const inventoryText = `${invItem.nombre} ${invItem.descripcion || ''} ${(invItem.palabras_clave || []).join(' ')}`;
          
          // Calcular score y comparar con threshold
          const score = calculateMatchScoreSimple(licitacionText, inventoryText);
          
          if (score >= threshold) {
            matchCount++;
          }
        }
        
        matchCounts.set(licitacion.id, matchCount);
      }
      
      return matchCounts;
    },
    enabled: licitaciones.length > 0,
    staleTime: 300000, // Cache por 5 minutos (matching es intensivo)
  });
}
