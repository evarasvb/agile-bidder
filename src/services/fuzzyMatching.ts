/**
 * Servicio de matching difuso para productos
 * Implementa algoritmo de similitud de Levenshtein y búsqueda por keywords
 * Incluye diccionario de sinónimos y matching por categoría
 */

import type { InventoryItem, ProductMatch, ItemRequerido } from '@/services/types';

// Re-export types for backward compatibility
export type { InventoryItem, ProductMatch, ItemRequerido };

/**
 * Diccionario de sinónimos y términos relacionados por categoría
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'oficina': [
    'escritorio', 'papeleria', 'papelería', 'utiles', 'útiles',
    'articulos oficina', 'artículos oficina', 'suministros oficina',
    'materiales oficina', 'elementos oficina'
  ],
  'papel': [
    'resma', 'hoja', 'papel carta', 'papel oficio', 'papel bond',
    'papel fotocopia', 'papel copia', 'papel blanco'
  ],
  'escritura': [
    'lapiz', 'lápiz', 'boligrafo', 'bolígrafo', 'lapicera', 'marcador',
    'pluma', 'plumón', 'resaltador', 'highlighter', 'tinta'
  ],
  'archivo': [
    'carpeta', 'archivador', 'bibliorato', 'folder', 'portafolio',
    'organizador', 'clasificador'
  ],
  'corte': [
    'tijera', 'tijeras', 'cutter', 'cortador', 'guillotina'
  ],
  'pegamento': [
    'cola', 'pegante', 'adhesivo', 'silicona', 'cinta adhesiva',
    'scotch', 'tape', 'masking'
  ]
};

/**
 * Normaliza texto para comparación
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expande un texto con sinónimos conocidos
 */
function expandWithSynonyms(text: string): string[] {
  const normalized = normalizeText(text);
  const expanded: string[] = [normalized];
  
  // Buscar categorías que coincidan
  for (const [category, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (normalized.includes(normalizeText(synonym))) {
        expanded.push(category);
        expanded.push(...synonyms.map(s => normalizeText(s)));
        break;
      }
    }
  }
  
  return [...new Set(expanded)];
}

/**
 * Calcula distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const matrix: number[][] = [];
  
  // Inicializar primera fila
  for (let i = 0; i <= n; i++) {
    matrix[0] = matrix[0] || [];
    matrix[0][i] = i;
  }
  
  // Inicializar primera columna
  for (let i = 1; i <= m; i++) {
    matrix[i] = matrix[i] || [];
    matrix[i][0] = i;
  }
  
  // Llenar matriz
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // Eliminación
        matrix[i][j - 1] + 1, // Inserción
        matrix[i - 1][j - 1] + cost // Sustitución
      );
    }
  }
  
  return matrix[m][n];
}

/**
 * Calcula similitud entre dos strings (0-1)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeText(str1);
  const s2 = normalizeText(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  
  return 1 - distance / maxLen;
}

/**
 * Extrae palabras clave significativas de un texto
 */
function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(w => w.length >= 3);
  
  // Palabras comunes a ignorar
  const stopWords = new Set([
    'para', 'con', 'sin', 'los', 'las', 'del', 'que', 'una', 'uno',
    'por', 'mas', 'etc', 'tipo', 'segun', 'uso', 'cada', 'ser'
  ]);
  
  return words.filter(w => !stopWords.has(w));
}

/**
 * Calcula match entre un item requerido y un producto del inventario
 * Versión mejorada con soporte para sinónimos y categorías
 */
function calculateMatch(itemRequerido: ItemRequerido, producto: InventoryItem): ProductMatch | null {
  const nombreRequerido = normalizeText(itemRequerido.nombre);
  const descripcionRequerida = itemRequerido.descripcion ? normalizeText(itemRequerido.descripcion) : '';
  const textoCompleto = `${nombreRequerido} ${descripcionRequerida}`;
  
  // Expandir con sinónimos
  const textosExpandidos = expandWithSynonyms(textoCompleto);
  
  const nombreProducto = normalizeText(producto.nombre_producto);
  const descripcionProducto = producto.descripcion ? normalizeText(producto.descripcion) : '';
  const categoriaProducto = producto.categoria ? normalizeText(producto.categoria) : '';
  const keywordsProducto = (producto.keywords || []).map(k => normalizeText(k));
  const textoProducto = `${nombreProducto} ${descripcionProducto} ${keywordsProducto.join(' ')}`;
  
  // También expandir el producto
  const productoExpandido = expandWithSynonyms(textoProducto);
  
  let score = 0;
  let matchType: 'exact' | 'partial' | 'keyword' | 'fuzzy' | 'category' = 'fuzzy';
  const matchedTerms: string[] = [];
  
  // 1. Match exacto por nombre (100%)
  if (nombreRequerido === nombreProducto) {
    return {
      inventory_id: producto.id,
      sku: producto.sku,
      nombre: producto.nombre_producto,
      keywords_matched: [itemRequerido.nombre],
      similarity_score: 100,
      match_type: 'exact',
      cantidad_requerida: itemRequerido.cantidad || 1,
      precio_unitario: producto.precio_unitario,
      precio_oferta: producto.precio_unitario * (1 + producto.margen_objetivo / 100),
      margen_aplicado: producto.margen_objetivo,
      subtotal: (itemRequerido.cantidad || 1) * producto.precio_unitario * (1 + producto.margen_objetivo / 100),
      inventory_item: producto,
    };
  }
  
  // 2. Similitud de nombre (hasta 80%)
  const nombreSimilarity = stringSimilarity(nombreRequerido, nombreProducto);
  if (nombreSimilarity > 0.8) {
    score = Math.max(score, nombreSimilarity * 90);
    matchType = 'partial';
    matchedTerms.push(itemRequerido.nombre);
  }
  
  // 3. Match por categoría expandida (hasta 70%)
  let categoryMatches = 0;
  for (const textoExp of textosExpandidos) {
    // Match directo con categoría del producto
    if (categoriaProducto && categoriaProducto.includes(textoExp)) {
      categoryMatches += 2;
      matchedTerms.push(textoExp);
    }
    
    // Match con textos expandidos del producto
    for (const prodExp of productoExpandido) {
      if (prodExp.includes(textoExp) || textoExp.includes(prodExp)) {
        categoryMatches++;
        matchedTerms.push(textoExp);
        break;
      }
    }
  }
  
  if (categoryMatches > 0) {
    const categoryScore = Math.min(categoryMatches * 15, 70);
    if (categoryScore > score) {
      score = categoryScore;
      matchType = 'category';
    }
  }
  
  // 4. Match por keywords del producto (hasta 75%)
  const keywordsRequerido = extractKeywords(textoCompleto);
  let keywordMatches = 0;
  
  for (const kw of keywordsRequerido) {
    // Buscar en keywords del producto
    for (const pkw of keywordsProducto) {
      if (pkw.includes(kw) || kw.includes(pkw) || stringSimilarity(kw, pkw) > 0.8) {
        keywordMatches++;
        matchedTerms.push(kw);
        break;
      }
    }
    
    // Buscar en nombre y descripción
    if (textoProducto.includes(kw)) {
      keywordMatches++;
      if (!matchedTerms.includes(kw)) matchedTerms.push(kw);
    }
  }
  
  if (keywordsRequerido.length > 0 && keywordMatches > 0) {
    const keywordScore = (keywordMatches / keywordsRequerido.length) * 75;
    if (keywordScore > score) {
      score = keywordScore;
      matchType = 'keyword';
    }
  }
  
  // 5. Similitud de texto completo (hasta 60%)
  const fullSimilarity = stringSimilarity(textoCompleto, textoProducto);
  if (fullSimilarity > 0.5) {
    const fuzzyScore = fullSimilarity * 60;
    if (fuzzyScore > score) {
      score = fuzzyScore;
      matchType = 'fuzzy';
    }
  }
  
  // Umbral mínimo de 25% (reducido para mejor cobertura)
  if (score < 25) return null;
  
  const cantidad = itemRequerido.cantidad || 1;
  const precioConMargen = producto.precio_unitario * (1 + producto.margen_objetivo / 100);
  
  return {
    inventory_id: producto.id,
    sku: producto.sku,
    nombre: producto.nombre_producto,
    keywords_matched: [...new Set(matchedTerms)],
    similarity_score: Math.round(score),
    match_type: matchType,
    cantidad_requerida: cantidad,
    precio_unitario: producto.precio_unitario,
    precio_oferta: precioConMargen,
    margen_aplicado: producto.margen_objetivo,
    subtotal: cantidad * precioConMargen,
    inventory_item: producto,
  };
}

/**
 * Busca matches para un item requerido en el inventario
 * Retorna lista ordenada por score descendente
 */
export function findMatches(
  itemRequerido: ItemRequerido, 
  inventario: InventoryItem[],
  maxResults = 5
): ProductMatch[] {
  const matches: ProductMatch[] = [];
  
  for (const producto of inventario) {
    if (!producto.activo) continue;
    
    const match = calculateMatch(itemRequerido, producto);
    if (match) {
      matches.push(match);
    }
  }
  
  // Ordenar por score descendente y limitar resultados
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

/**
 * Encuentra el mejor match para un item
 */
export function findBestMatch(
  itemRequerido: ItemRequerido, 
  inventario: InventoryItem[]
): ProductMatch | null {
  const matches = findMatches(itemRequerido, inventario, 1);
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Extrae items de un texto de descripción de compra
 * Intenta parsear formatos comunes de listas de productos
 */
export function extractItemsFromDescription(descripcion: string): ItemRequerido[] {
  const items: ItemRequerido[] = [];
  const lines = descripcion.split(/[\n;,]/).map(l => l.trim()).filter(Boolean);
  
  let itemIndex = 0;
  for (const line of lines) {
    // Ignorar líneas muy cortas o que parezcan encabezados
    if (line.length < 5) continue;
    if (/^(item|producto|descripcion|cantidad|unidad|total):?$/i.test(line)) continue;
    
    // Intentar extraer cantidad del inicio
    const cantidadMatch = line.match(/^(\d+)\s*(un|unid|pza|caja|kg|lt|ml|mt|m|cm|mm)?\.?\s+(.+)/i);
    
    if (cantidadMatch) {
      items.push({
        id: `ext-${itemIndex++}`,
        nombre: cantidadMatch[3].trim(),
        cantidad: parseInt(cantidadMatch[1]),
        unidad: cantidadMatch[2]?.toUpperCase() || 'UN'
      });
    } else {
      // Usar línea completa como nombre
      items.push({
        id: `ext-${itemIndex++}`,
        nombre: line,
        cantidad: 1,
        unidad: 'UN'
      });
    }
  }
  
  return items;
}

/**
 * Procesa una compra ágil y encuentra matches para todos sus items
 */
export function processCompraMatches(
  items: ItemRequerido[],
  inventario: InventoryItem[]
): Map<string, ProductMatch[]> {
  const resultados = new Map<string, ProductMatch[]>();
  
  for (const item of items) {
    const matches = findMatches(item, inventario, 5);
    resultados.set(item.id, matches);
  }
  
  return resultados;
}
