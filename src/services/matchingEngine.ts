/**
 * MATCHING ENGINE - Sistema de análisis inteligente de licitaciones
 * 
 * Algoritmo de scoring ponderado:
 * - 40% Coincidencia de keywords (Levenshtein + stemming básico)
 * - 25% Categoría del producto vs título licitación
 * - 20% Presupuesto vs capacidad de oferta
 * - 10% Stock disponible
 * - 5% Tiempo de entrega
 */

import { supabase } from '@/integrations/supabase/client';
import { handleSupabaseError } from '@/lib/supabaseErrorHandler';
import type {
  InventoryItem,
  Licitacion,
  LicitacionItem,
  ProductMatch,
  MatchResult,
} from '@/services/types';

// Re-export types for backward compatibility
export type {
  InventoryItem,
  Licitacion,
  LicitacionItem,
  ProductMatch,
  MatchResult,
};

// ============ UTILIDADES NLP ============

// Cache para keywords extraídas (mejora performance)
const keywordsCache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 1000;

/**
 * Calcula la distancia de Levenshtein entre dos strings (optimizado)
 * Usa early exit para strings muy diferentes
 */
function levenshteinDistance(str1: string, str2: string, maxDistance?: number): number {
  const m = str1.length;
  const n = str2.length;
  
  // Early exit si la diferencia de longitud es muy grande
  if (maxDistance !== undefined && Math.abs(m - n) > maxDistance) {
    return maxDistance + 1;
  }
  
  // Si uno es muy largo, usar algoritmo simplificado
  if (m > 100 || n > 100) {
    // Para strings largos, usar comparación más rápida
    if (str1.toLowerCase().includes(str2.toLowerCase()) || str2.toLowerCase().includes(str1.toLowerCase())) {
      return Math.abs(m - n);
    }
    // Aproximación rápida
    return Math.max(m, n) * 0.5;
  }
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    let minRow = dp[i][0];
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
      minRow = Math.min(minRow, dp[i][j]);
    }
    // Early exit si toda la fila excede maxDistance
    if (maxDistance !== undefined && minRow > maxDistance) {
      return maxDistance + 1;
    }
  }

  return dp[m][n];
}

/**
 * Calcula similitud entre dos strings (0-1)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check for substring match
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85;
  }
  
  const maxLength = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Stemming básico para español - elimina sufijos comunes
 */
function stemWord(word: string): string {
  const w = word.toLowerCase().trim();
  
  // Sufijos comunes en español
  const suffixes = [
    'aciones', 'amiento', 'imiento', 'adores', 
    'acion', 'mente', 'idad', 'ador', 'edor', 'idor',
    'ando', 'endo', 'iendo', 'adas', 'idas', 'ados', 'idos',
    'ante', 'ente', 'ista', 'ismo', 'able', 'ible',
    'cion', 'sion', 'oso', 'osa', 'ivo', 'iva',
    'es', 'as', 'os', 'is', 'us'
  ];
  
  for (const suffix of suffixes) {
    if (w.endsWith(suffix) && w.length > suffix.length + 2) {
      return w.slice(0, -suffix.length);
    }
  }
  
  return w;
}

/**
 * Extrae palabras clave de un texto (con cache)
 */
function extractKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // Verificar cache
  const cacheKey = text.toLowerCase().trim();
  if (keywordsCache.has(cacheKey)) {
    return keywordsCache.get(cacheKey)!;
  }
  
  // Limpiar cache si es muy grande
  if (keywordsCache.size > MAX_CACHE_SIZE) {
    const firstKey = keywordsCache.keys().next().value;
    keywordsCache.delete(firstKey);
  }
  
  // Palabras vacías en español
  const stopWords = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'al', 'a', 'en', 'por', 'para', 'con', 'sin',
    'sobre', 'entre', 'tras', 'durante', 'mediante',
    'y', 'o', 'u', 'ni', 'que', 'se', 'su', 'sus',
    'es', 'son', 'ser', 'está', 'están', 'este', 'esta',
    'como', 'más', 'muy', 'ya', 'hay', 'ha', 'he', 'sido',
    'otros', 'otras', 'todo', 'toda', 'todos', 'todas',
    'cada', 'según', 'tipo', 'tipos', 'así', 'además',
    'n°', 'nro', 'n', 'c/u', 'und', 'pza', 'pzs'
  ]);
  
  // Limpiar y tokenizar
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  
  // Aplicar stemming y deduplicar
  const stemmed = [...new Set(words.map(stemWord))];
  
  // Guardar en cache
  keywordsCache.set(cacheKey, stemmed);
  
  return stemmed;
}

// ============ ALGORITMO DE MATCHING ============

/**
 * Calcula el score de match entre keywords de inventario y licitación
 * Peso: 40%
 * Optimizado con early exit y mejor manejo de edge cases
 */
function calculateKeywordScore(
  inventoryKeywords: string[] | null | undefined, 
  licitacionKeywords: string[] | null | undefined
): { score: number; matchedKeywords: string[] } {
  // Validación de inputs
  if (!inventoryKeywords || !licitacionKeywords || 
      inventoryKeywords.length === 0 || licitacionKeywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }
  
  const matchedKeywords: string[] = [];
  let totalSimilarity = 0;
  
  // Crear Set para búsqueda más rápida (O(1) vs O(n))
  const licitacionSet = new Set(licitacionKeywords);
  
  // Para cada keyword del inventario, buscar mejor match en licitación
  for (const invKw of inventoryKeywords) {
    if (!invKw || typeof invKw !== 'string') continue;
    
    let bestSimilarity = 0;
    let bestMatch = '';
    
    // Primero verificar match exacto (más rápido)
    const stemmedInv = stemWord(invKw);
    if (licitacionSet.has(invKw) || licitacionSet.has(stemmedInv)) {
      bestSimilarity = 1.0;
      bestMatch = invKw;
    } else {
      // Si no hay match exacto, buscar por similitud
      for (const licKw of licitacionKeywords) {
        if (!licKw || typeof licKw !== 'string') continue;
        
        const sim = calculateStringSimilarity(stemmedInv, stemWord(licKw));
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestMatch = licKw;
          // Early exit si encontramos match perfecto
          if (sim >= 0.95) break;
        }
      }
    }
    
    if (bestSimilarity >= 0.7) {
      matchedKeywords.push(invKw);
      totalSimilarity += bestSimilarity;
    }
  }
  
  // Score basado en proporción de keywords matcheados
  const coverageScore = matchedKeywords.length / inventoryKeywords.length;
  const qualityScore = matchedKeywords.length > 0 
    ? totalSimilarity / matchedKeywords.length 
    : 0;
  
  return {
    score: Math.round((coverageScore * 0.6 + qualityScore * 0.4) * 100),
    matchedKeywords
  };
}

/**
 * Calcula el score de categoría vs título de licitación
 * Peso: 25%
 */
function calculateCategoryScore(
  categoria: string, 
  tituloLicitacion: string
): number {
  const catKeywords = extractKeywords(categoria);
  const titleKeywords = extractKeywords(tituloLicitacion);
  
  let matches = 0;
  for (const catKw of catKeywords) {
    for (const titleKw of titleKeywords) {
      if (calculateStringSimilarity(catKw, titleKw) >= 0.75) {
        matches++;
        break;
      }
    }
  }
  
  return catKeywords.length > 0 
    ? Math.round((matches / catKeywords.length) * 100) 
    : 0;
}

/**
 * Calcula el score de presupuesto
 * Peso: 20%
 */
function calculateBudgetScore(
  presupuesto: number | null, 
  valorOferta: number
): number {
  if (!presupuesto || presupuesto === 0) return 50; // Neutro si no hay presupuesto
  if (valorOferta === 0) return 0;
  
  const ratio = valorOferta / presupuesto;
  
  // Ideal: oferta entre 60% y 90% del presupuesto
  if (ratio >= 0.6 && ratio <= 0.9) return 100;
  if (ratio < 0.4) return 30; // Muy por debajo, podría ser sospechoso
  if (ratio > 1) return 0; // Excede presupuesto
  if (ratio > 0.9) return Math.round((1 - (ratio - 0.9) * 10) * 100);
  
  return Math.round(ratio * 100);
}

/**
 * Calcula el score de stock
 * Peso: 10%
 */
function calculateStockScore(
  stockDisponible: number, 
  cantidadRequerida: number
): number {
  if (cantidadRequerida === 0) return 100;
  if (stockDisponible === 0) return 0;
  
  const ratio = stockDisponible / cantidadRequerida;
  
  if (ratio >= 2) return 100; // Stock abundante
  if (ratio >= 1) return 80 + (ratio - 1) * 20;
  
  return Math.round(ratio * 80); // Menos de lo requerido
}

/**
 * Calcula el score de tiempo de entrega
 * Peso: 5%
 */
function calculateDeliveryScore(
  tiempoEntregaDias: number, 
  fechaCierre: string | null
): number {
  if (!fechaCierre) return 70; // Neutro
  
  const cierre = new Date(fechaCierre);
  const hoy = new Date();
  const diasHastaCierre = Math.ceil((cierre.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  
  // Si ya pasó el cierre
  if (diasHastaCierre < 0) return 0;
  
  // Tiempo de entrega debe ser menor al tiempo hasta cierre + margen de 30 días
  const margenEntrega = diasHastaCierre + 30;
  
  if (tiempoEntregaDias <= diasHastaCierre) return 100;
  if (tiempoEntregaDias <= margenEntrega) return 70;
  
  return 40;
}

/**
 * Analiza match entre una licitación y el inventario
 * Optimizado con validaciones y mejor manejo de errores
 */
export async function analyzeMatch(
  licitacion: Licitacion,
  licitacionItems?: LicitacionItem[] | null
): Promise<MatchResult> {
  // Validación de inputs
  if (!licitacion || !licitacion.id_licitacion) {
    throw new Error('Licitación inválida: falta id_licitacion');
  }
  
  if (!licitacion.titulo || typeof licitacion.titulo !== 'string') {
    return createEmptyResult(licitacion.id_licitacion, licitacion.presupuesto, [
      'Licitación sin título válido'
    ]);
  }
  
  // Obtener inventario activo
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .eq('activo', true);
  
  if (invError) {
    console.error('Error obteniendo inventario:', invError);
    throw handleSupabaseError(invError, 'analyzeMatch: obtener inventario');
  }
  
  if (!inventory || inventory.length === 0) {
    return createEmptyResult(licitacion.id_licitacion, licitacion.presupuesto, [
      'No hay productos activos en el inventario'
    ]);
  }
  
  // Extraer keywords de la licitación
  const licitacionKeywords = extractKeywords(licitacion.titulo || '');
  
  // También incluir keywords de items si existen
  if (licitacionItems && Array.isArray(licitacionItems) && licitacionItems.length > 0) {
    for (const item of licitacionItems) {
      if (item && item.nombre_producto) {
        licitacionKeywords.push(...extractKeywords(item.nombre_producto));
      }
      if (item && item.descripcion && typeof item.descripcion === 'string') {
        licitacionKeywords.push(...extractKeywords(item.descripcion));
      }
    }
  }
  
  const uniqueLicitacionKeywords = [...new Set(licitacionKeywords)];
  
  // Si no hay keywords, retornar resultado vacío
  if (uniqueLicitacionKeywords.length === 0) {
    return createEmptyResult(licitacion.id_licitacion, licitacion.presupuesto, [
      'No se pudieron extraer keywords de la licitación'
    ]);
  }
  
  // Analizar cada producto del inventario
  const productMatches: ProductMatch[] = [];
  const razones: string[] = [];
  const alertas: string[] = [];
  
  for (const item of inventory as InventoryItem[]) {
    // Validar item
    if (!item || !item.id || !item.nombre_producto) continue;
    
    // Validar valores numéricos
    const precioUnitario = Number(item.precio_unitario) || 0;
    const margenObjetivo = Number(item.margen_objetivo) || 0;
    const stockDisponible = Number(item.stock_disponible) || 0;
    const tiempoEntrega = Number(item.tiempo_entrega_dias) || 0;
    
    if (precioUnitario <= 0) continue; // Saltar productos sin precio
    
    const { score: kwScore, matchedKeywords } = calculateKeywordScore(
      Array.isArray(item.keywords) ? item.keywords : [], 
      uniqueLicitacionKeywords
    );
    
    const categoryScore = calculateCategoryScore(
      item.categoria || '', 
      licitacion.titulo || ''
    );
    
    // Solo considerar productos con score de keywords >= 30 o categoría >= 50
    if (kwScore >= 30 || categoryScore >= 50) {
      // Buscar cantidad estimada en items de licitación
      let cantidadEstimada = 1;
      if (licitacionItems && Array.isArray(licitacionItems) && licitacionItems.length > 0) {
        const matchingItem = licitacionItems.find(li => {
          if (!li || !li.nombre_producto) return false;
          const itemKws = extractKeywords(li.nombre_producto);
          return itemKws.some(kw => 
            matchedKeywords.some(mk => calculateStringSimilarity(kw, mk) >= 0.7)
          );
        });
        cantidadEstimada = matchingItem?.cantidad 
          ? Math.max(1, Number(matchingItem.cantidad) || 1)
          : 1;
      }
      
      const stockScore = calculateStockScore(stockDisponible, cantidadEstimada);
      const deliveryScore = calculateDeliveryScore(tiempoEntrega, licitacion.fecha_cierre);
      
      // Calcular precio con margen objetivo (validar que sea positivo)
      const precioConMargen = precioUnitario * (1 + Math.max(0, margenObjetivo) / 100);
      
      // Score ponderado del producto
      const productScore = Math.round(
        kwScore * 0.40 +
        categoryScore * 0.25 +
        stockScore * 0.25 +
        deliveryScore * 0.10
      );
      
      if (productScore >= 35) {
        productMatches.push({
          inventory_id: item.id,
          sku: item.sku || 'N/A',
          nombre: item.nombre_producto,
          keywords_matched: matchedKeywords,
          similarity_score: productScore,
          cantidad_requerida: cantidadEstimada,
          precio_unitario: precioUnitario,
          precio_oferta: precioConMargen,
          margen_aplicado: margenObjetivo,
          subtotal: precioConMargen * cantidadEstimada
        });
        
        if (stockDisponible < cantidadEstimada) {
          alertas.push(`Stock insuficiente de ${item.sku || 'N/A'}: ${stockDisponible} disponible, ${cantidadEstimada} requerido`);
        }
        
        razones.push(
          `${item.nombre_producto} coincide con keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        );
      }
    }
  }
  
  // Ordenar por score de similitud
  productMatches.sort((a, b) => b.similarity_score - a.similarity_score);
  
  // Calcular valor total y margen (con validación)
  const valorTotal = productMatches.reduce((sum, p) => {
    const subtotal = Number(p.subtotal) || 0;
    return sum + subtotal;
  }, 0);
  
  const costoTotal = productMatches.reduce((sum, p) => {
    const costo = (Number(p.precio_unitario) || 0) * (Number(p.cantidad_requerida) || 0);
    return sum + costo;
  }, 0);
  
  const margenTotal = costoTotal > 0 
    ? Math.round(((valorTotal - costoTotal) / costoTotal) * 100) 
    : 0;
  
  // Score de presupuesto
  const budgetScore = calculateBudgetScore(licitacion.presupuesto, valorTotal);
  
  // Cobertura de items (con validación)
  const itemsCubiertos = (licitacionItems && Array.isArray(licitacionItems) && licitacionItems.length > 0)
    ? productMatches.filter(pm => (Number(pm.cantidad_requerida) || 0) > 0).length / licitacionItems.length * 100
    : productMatches.length > 0 ? 100 : 0;
  
  // Calcular score final ponderado
  const avgProductScore = productMatches.length > 0
    ? productMatches.reduce((sum, p) => sum + p.similarity_score, 0) / productMatches.length
    : 0;
  
  const finalScore = Math.round(
    avgProductScore * 0.65 +
    budgetScore * 0.20 +
    itemsCubiertos * 0.15
  );
  
  // Determinar nivel de confianza
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (finalScore >= 70 && productMatches.length >= 2 && alertas.length === 0) {
    confidenceLevel = 'high';
  } else if (finalScore >= 50 || (finalScore >= 40 && productMatches.length >= 1)) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }
  
  // Agregar razones y alertas según score
  if (finalScore >= 70) {
    razones.unshift('Alta compatibilidad entre productos e items de licitación');
  }
  if (budgetScore >= 80) {
    razones.push('Valor de oferta dentro del rango óptimo del presupuesto');
  }
  if (budgetScore < 50 && licitacion.presupuesto) {
    alertas.push('Valor de oferta podría exceder o estar muy por debajo del presupuesto');
  }
  
  return {
    licitacion_id: licitacion.id_licitacion,
    match_score: finalScore,
    productos_matcheados: productMatches.slice(0, 10), // Top 10
    valor_total_estimado: valorTotal,
    margen_estimado: margenTotal,
    confidence_level: confidenceLevel,
    razones_match: razones.slice(0, 5),
    alertas,
    presupuesto_licitacion: licitacion.presupuesto,
    cobertura_items: Math.round(itemsCubiertos)
  };
}

function createEmptyResult(
  licitacionId: string, 
  presupuesto: number | null,
  alertas: string[]
): MatchResult {
  return {
    licitacion_id: licitacionId,
    match_score: 0,
    productos_matcheados: [],
    valor_total_estimado: 0,
    margen_estimado: 0,
    confidence_level: 'low',
    razones_match: [],
    alertas,
    presupuesto_licitacion: presupuesto,
    cobertura_items: 0
  };
}

/**
 * Procesa múltiples licitaciones para encontrar matches
 */
export async function batchAnalyzeMatches(
  licitaciones: Licitacion[]
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  
  for (const licitacion of licitaciones) {
    // Obtener items de la licitación si existen
    const { data: items } = await supabase
      .from('licitacion_items')
      .select('*')
      .eq('licitacion_id', licitacion.id_licitacion);
    
    const result = await analyzeMatch(licitacion, items as LicitacionItem[] || []);
    results.push(result);
  }
  
  return results.sort((a, b) => b.match_score - a.match_score);
}
