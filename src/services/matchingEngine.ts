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

// ============ INTERFACES ============

export interface InventoryItem {
  id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string | null;
  categoria: string;
  keywords: string[];
  precio_unitario: number;
  margen_minimo: number;
  margen_objetivo: number;
  stock_disponible: number;
  unidad_medida: string;
  tiempo_entrega_dias: number;
  proveedor: string | null;
  activo: boolean;
}

export interface Licitacion {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  estado: string | null;
}

export interface LicitacionItem {
  id: number;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

export interface ProductMatch {
  inventory_id: string;
  sku: string;
  nombre: string;
  keywords_matched: string[];
  similarity_score: number;
  cantidad_requerida: number;
  precio_unitario: number;
  precio_oferta: number;
  margen_aplicado: number;
  subtotal: number;
}

export interface MatchResult {
  licitacion_id: string;
  match_score: number; // 0-100
  productos_matcheados: ProductMatch[];
  valor_total_estimado: number;
  margen_estimado: number;
  confidence_level: 'high' | 'medium' | 'low';
  razones_match: string[];
  alertas: string[];
  presupuesto_licitacion: number | null;
  cobertura_items: number; // % de items de licitación cubiertos
}

// ============ UTILIDADES NLP ============

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
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
 * Extrae palabras clave de un texto
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  
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
  
  return stemmed;
}

// ============ ALGORITMO DE MATCHING ============

/**
 * Calcula el score de match entre keywords de inventario y licitación
 * Peso: 40%
 */
function calculateKeywordScore(
  inventoryKeywords: string[], 
  licitacionKeywords: string[]
): { score: number; matchedKeywords: string[] } {
  if (inventoryKeywords.length === 0 || licitacionKeywords.length === 0) {
    return { score: 0, matchedKeywords: [] };
  }
  
  const matchedKeywords: string[] = [];
  let totalSimilarity = 0;
  
  // Para cada keyword del inventario, buscar mejor match en licitación
  for (const invKw of inventoryKeywords) {
    let bestSimilarity = 0;
    let bestMatch = '';
    
    for (const licKw of licitacionKeywords) {
      const sim = calculateStringSimilarity(stemWord(invKw), stemWord(licKw));
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = licKw;
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
 */
export async function analyzeMatch(
  licitacion: Licitacion,
  licitacionItems?: LicitacionItem[]
): Promise<MatchResult> {
  // Obtener inventario activo
  const { data: inventory, error: invError } = await supabase
    .from('inventory')
    .select('*')
    .eq('activo', true);
  
  if (invError) throw invError;
  if (!inventory || inventory.length === 0) {
    return createEmptyResult(licitacion.id_licitacion, licitacion.presupuesto, [
      'No hay productos activos en el inventario'
    ]);
  }
  
  // Extraer keywords de la licitación
  const licitacionKeywords = extractKeywords(licitacion.titulo);
  
  // También incluir keywords de items si existen
  if (licitacionItems && licitacionItems.length > 0) {
    for (const item of licitacionItems) {
      licitacionKeywords.push(...extractKeywords(item.nombre_producto));
      if (item.descripcion) {
        licitacionKeywords.push(...extractKeywords(item.descripcion));
      }
    }
  }
  
  const uniqueLicitacionKeywords = [...new Set(licitacionKeywords)];
  
  // Analizar cada producto del inventario
  const productMatches: ProductMatch[] = [];
  const razones: string[] = [];
  const alertas: string[] = [];
  
  for (const item of inventory as InventoryItem[]) {
    const { score: kwScore, matchedKeywords } = calculateKeywordScore(
      item.keywords || [], 
      uniqueLicitacionKeywords
    );
    
    const categoryScore = calculateCategoryScore(item.categoria, licitacion.titulo);
    
    // Solo considerar productos con score de keywords >= 30 o categoría >= 50
    if (kwScore >= 30 || categoryScore >= 50) {
      const cantidadEstimada = licitacionItems?.find(li => {
        const itemKws = extractKeywords(li.nombre_producto);
        return itemKws.some(kw => 
          matchedKeywords.some(mk => calculateStringSimilarity(kw, mk) >= 0.7)
        );
      })?.cantidad || 1;
      
      const stockScore = calculateStockScore(item.stock_disponible, cantidadEstimada);
      const deliveryScore = calculateDeliveryScore(item.tiempo_entrega_dias, licitacion.fecha_cierre);
      
      // Calcular precio con margen objetivo
      const precioConMargen = item.precio_unitario * (1 + item.margen_objetivo / 100);
      
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
          sku: item.sku,
          nombre: item.nombre_producto,
          keywords_matched: matchedKeywords,
          similarity_score: productScore,
          cantidad_requerida: cantidadEstimada,
          precio_unitario: item.precio_unitario,
          precio_oferta: precioConMargen,
          margen_aplicado: item.margen_objetivo,
          subtotal: precioConMargen * cantidadEstimada
        });
        
        if (item.stock_disponible < cantidadEstimada) {
          alertas.push(`Stock insuficiente de ${item.sku}: ${item.stock_disponible} disponible, ${cantidadEstimada} requerido`);
        }
        
        razones.push(
          `${item.nombre_producto} coincide con keywords: ${matchedKeywords.slice(0, 3).join(', ')}`
        );
      }
    }
  }
  
  // Ordenar por score de similitud
  productMatches.sort((a, b) => b.similarity_score - a.similarity_score);
  
  // Calcular valor total y margen
  const valorTotal = productMatches.reduce((sum, p) => sum + p.subtotal, 0);
  const costoTotal = productMatches.reduce(
    (sum, p) => sum + (p.precio_unitario * p.cantidad_requerida), 
    0
  );
  const margenTotal = costoTotal > 0 
    ? Math.round(((valorTotal - costoTotal) / costoTotal) * 100) 
    : 0;
  
  // Score de presupuesto
  const budgetScore = calculateBudgetScore(licitacion.presupuesto, valorTotal);
  
  // Cobertura de items
  const itemsCubiertos = licitacionItems 
    ? productMatches.filter(pm => pm.cantidad_requerida > 0).length / (licitacionItems.length || 1) * 100
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
