/**
 * Hook para matching de productos de licitación con inventario
 * Usa fuzzy matching inteligente con marcas y categorías
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  const matchedTerms: string[] = [];
  
  words1.forEach(word => {
    if (words2.has(word)) {
      matchCount++;
      matchedTerms.push(word);
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
 */
export function useLicitacionProductMatch(licitacionId: string | null, licitacionTitulo?: string) {
  return useQuery({
    queryKey: ['licitacion-product-match', licitacionId],
    queryFn: async (): Promise<LicitacionMatchResult | null> => {
      if (!licitacionId) return null;
      
      // Obtener inventario activo de Lovable Cloud
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('activo', true);
      
      if (invError) throw invError;
      if (!inventory || inventory.length === 0) {
        return {
          licitacionId,
          totalItems: 1, // Contamos el título como 1 item
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
      for (const invItem of inventory) {
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
            inventoryItem: invItem as InventoryItem,
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
 * Hook para obtener conteo rápido de matches para múltiples licitaciones
 * SIEMPRE hace matching directo por título/descripción de la licitación contra inventario
 * ya que los datos de items no están disponibles en la tabla licitacion_items
 */
export function useLicitacionMatchCounts(licitaciones: LicitacionBasic[]) {
  return useQuery({
    queryKey: ['licitacion-match-counts', licitaciones.map(l => l.id)],
    queryFn: async (): Promise<Map<string, number>> => {
      if (licitaciones.length === 0) return new Map();
      
      // Obtener inventario activo de Lovable Cloud
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('id, nombre_producto, descripcion, keywords, activo')
        .eq('activo', true);
      
      if (invError) {
        console.error('Error fetching inventory:', invError);
        throw invError;
      }
      
      const matchCounts = new Map<string, number>();
      
      if (!inventory || inventory.length === 0) {
        // Sin inventario, todos los conteos son 0
        licitaciones.forEach(l => matchCounts.set(l.id, 0));
        return matchCounts;
      }
      
      console.log(`Matching ${licitaciones.length} licitaciones contra ${inventory.length} productos del inventario`);
      
      // Calcular matches para cada licitación por título/descripción
      for (const licitacion of licitaciones) {
        const licitacionText = `${licitacion.titulo} ${licitacion.descripcion || ''}`;
        let matchCount = 0;
        
        for (const invItem of inventory) {
          const inventoryText = `${invItem.nombre_producto} ${invItem.descripcion || ''} ${(invItem.keywords || []).join(' ')}`;
          
          // Match de marca (peso alto)
          const brandMatch = findBrandMatch(licitacionText, inventoryText);
          
          // Match de tipo de producto (peso alto)
          const typeMatch = findProductTypeMatch(licitacionText, inventoryText);
          
          // Similitud general de texto
          const similarity = calculateSimilarity(licitacionText, inventoryText);
          
          // Si hay match de marca O tipo O similitud alta, contar este producto
          if (brandMatch || typeMatch || similarity > 20) {
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
