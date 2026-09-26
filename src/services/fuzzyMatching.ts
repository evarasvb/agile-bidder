/**
 * Servicio de matching difuso para productos
 * Implementa algoritmo de similitud de Levenshtein y búsqueda por keywords
 * Incluye diccionario de sinónimos y matching por categoría
 */

import type { InventoryItem } from "@/hooks/useInventory";

export interface ProductMatch {
  inventoryItem: InventoryItem;
  score: number; // 0-100
  matchType: 'exact' | 'partial' | 'keyword' | 'fuzzy' | 'category';
  matchedTerms: string[];
}

export interface ItemRequerido {
  id: string;
  nombre: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
}

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
 * Valida que especificaciones críticas no sean incompatibles
 * Retorna penalty score (0 = compatible, <0 = incompatible para rechazar)
 * CRÍTICO: Extrae TODAS las dimensiones, no solo la primera
 */
function validateSpecifications(itemRequerido: ItemRequerido, producto: InventoryItem): number {
  // Extraer dimensiones ANTES de normalizar (porque normalizeText reemplaza puntos por espacios)
  // Soporta: 15.8, 15,8 (decimal comma), excluye mass units (mg/g/kg no matched)

  const reqFullText = itemRequerido.nombre + ' ' + (itemRequerido.descripcion || '');
  const prodFullText = producto.nombre_producto + ' ' + (producto.descripcion || '');

  // Ahora normalizar para validación de incompatibilidades
  const req = normalizeText(reqFullText);
  const prod = normalizeText(prodFullText);

  // Mapeo de categorías incompatibles (si hay una de cada lado, no matchean)
  const incompatibilities: Record<string, string[]> = {
    'electronico|electronic|pendrive|usb|memoria|hard|disk|ssd|monitor|teclado|raton|mouse|adaptador|hdmi|vga|cable':
      ['papel|papel|cordon|cuerda|adhesivo|pegamiento|cinta|scotch'],
    'papel|papeleria|resma|hoja':
      ['electronico|pendrive|usb|adaptador|hdmi|monitor'],
    'tijera|cutter|cortador':
      ['papel|resma|hoja|pendrive|usb'],
  };

  for (const [category, incompatibles] of Object.entries(incompatibilities)) {
    const catWords = category.split('|');
    const incWords = incompatibles.join('|').split('|');

    const hasCategory = catWords.some(w => req.includes(w));
    const hasIncompatible = incWords.some(w => prod.includes(w));

    if (hasCategory && hasIncompatible) {
      return -100; // Rechazar: incompatibles
    }
  }

  // Validar especificaciones de unidad/dimensión si las hay
  // CRÍTICO: Solo acepta equivalencia matemática exacta (epsilon), no reglas de negocio
  // Ej: 2m = 2000mm (exacto), 2.0m = 2000.00mm (epsilon ~1e-10)
  // Ej: 15.8cm ≠ 5.5" (139.7mm) → REVISAR, no validado

  // CRÍTICO: Extraer TODAS las dimensiones (no solo la primera)
  const dimensionPatternGlobal = /(\d+(?:[.,]\d+)?)\s*(cm|mm|metros|metro|m|pulgadas|pulgada|pulg|"|inch)(?!\w)/g;
  const reqDims = Array.from(reqFullText.matchAll(dimensionPatternGlobal));
  const prodDims = Array.from(prodFullText.matchAll(dimensionPatternGlobal));

  if (reqDims.length > 0 && prodDims.length > 0) {
    // Si hay diferente cantidad de dimensiones → ambiguo, penalizar
    if (reqDims.length !== prodDims.length) {
      return -35; // Multidimensional mismatch: diferente cantidad
    }

    // Normalizar a mm (conversión real)
    const toMm = (val: number, unit: string): number => {
      const u = unit.toLowerCase();
      // Metros: 1m = 1000mm
      if (u === 'm' || u.includes('metro')) return val * 1000;
      // Centímetros: 1cm = 10mm
      if (u.includes('cm')) return val * 10;
      // Pulgadas: 1" = 25.4mm
      if (u.includes('"') || u.includes('pulg') || u.includes('inch')) return val * 25.4;
      // Si no se reconoce, asumir mm
      return val;
    };

    // Comparar TODAS las dimensiones
    let allMatch = true;
    for (let i = 0; i < reqDims.length; i++) {
      const reqVal = parseFloat(reqDims[i][1].replace(',', '.'));
      const reqUnit = reqDims[i][2].toLowerCase();
      const prodVal = parseFloat(prodDims[i][1].replace(',', '.'));
      const prodUnit = prodDims[i][2].toLowerCase();

      const reqMm = toMm(reqVal, reqUnit);
      const prodMm = toMm(prodVal, prodUnit);

      // Usar epsilon para equivalencia matemática
      const epsilon = 1e-10;
      const diff = Math.abs(reqMm - prodMm);

      if (diff >= epsilon) {
        allMatch = false;
        break;
      }
    }

    if (allMatch) {
      return 0; // Todas las dimensiones coinciden exactamente
    }

    // Si alguna dimensión difiere → REVISAR (score <60)
    // Penalidad -35 asegura: score 85 → 50 (<60), score 75 → 40 (<60)
    return -35; // Penalidad dimensional: garantiza REVISAR
  }

  return 0; // Compatible
}

/**
 * Calcula match entre un item requerido y un producto del inventario
 * Versión mejorada con soporte para sinónimos, categorías Y validación de especificaciones
 */
function calculateMatch(itemRequerido: ItemRequerido, producto: InventoryItem): ProductMatch | null {
  // Primero: validar que no haya incompatibilidades obvias
  const specPenalty = validateSpecifications(itemRequerido, producto);
  if (specPenalty < -50) return null; // Rechazar si incompatible

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
  // CRÍTICO: Solo retornar 100 si no hay conflicto de dimensiones
  // Si hay mismatch dimensional (specPenalty = -30), dejar que pase al scoring normal
  // para que se aplique la penalidad y el score quede <60
  if (nombreRequerido === nombreProducto) {
    if (specPenalty === 0) {
      // Sin dimensiones conflictivas - retornar exact match
      return {
        inventoryItem: producto,
        score: 100,
        matchType: 'exact',
        matchedTerms: [itemRequerido.nombre]
      };
    }
    // Si especPenalty = -30 (mismatch dimensional), no retornar aquí
    // Continuar al scoring normal para aplicar penalidad
  }

  // 2. Similitud de nombre (hasta 85% - más importancia)
  const nombreSimilarity = stringSimilarity(nombreRequerido, nombreProducto);
  if (nombreSimilarity > 0.75) {
    score = Math.max(score, nombreSimilarity * 85);
    matchType = 'partial';
    matchedTerms.push(itemRequerido.nombre);
  }

  // 3. Match por categoría expandida - REDUCIDO a máximo 50% (no es suficiente solo)
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
    // CAMBIO CRÍTICO: Máximo 50% solo por categoría, no 70%
    const categoryScore = Math.min(categoryMatches * 12, 50);
    if (categoryScore > score) {
      score = categoryScore;
      matchType = 'category';
    }
  }

  // 4. Match por keywords del producto (hasta 75%)
  const keywordsRequerido = extractKeywords(textoCompleto);
  let keywordMatches = 0;

  for (const kw of keywordsRequerido) {
    let found = false;

    // Buscar en keywords del producto
    for (const pkw of keywordsProducto) {
      if (pkw.includes(kw) || kw.includes(pkw) || stringSimilarity(kw, pkw) > 0.8) {
        keywordMatches++;
        matchedTerms.push(kw);
        found = true;
        break;
      }
    }

    // Buscar en nombre y descripción SOLO si no encontró en keywords
    if (!found && textoProducto.includes(kw)) {
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

  // 5. Similitud de texto completo (hasta 65%)
  const fullSimilarity = stringSimilarity(textoCompleto, textoProducto);
  if (fullSimilarity > 0.5) {
    const fuzzyScore = fullSimilarity * 65;
    if (fuzzyScore > score) {
      score = fuzzyScore;
      matchType = 'fuzzy';
    }
  }

  // Aplicar penalty/bonus de especificación
  if (specPenalty === 0) {
    // Verificar si hay dimensiones exactas equivalentes
    const dimensionPattern = /(\d+(?:[.,]\d+)?)\s*(cm|mm|metros|metro|m|pulgadas|pulgada|pulg|"|inch)(?!\w)/i;
    const reqFullText = itemRequerido.nombre + ' ' + (itemRequerido.descripcion || '');
    const prodFullText = producto.nombre_producto + ' ' + (producto.descripcion || '');
    const hasBothDims = dimensionPattern.test(reqFullText) && dimensionPattern.test(prodFullText);
    if (hasBothDims) {
      // Bonus por equivalencia matemática exacta de dimensiones
      score = Math.min(100, score + 25); // +25 para exactitud dimensional
    }
  } else if (specPenalty < 0) {
    score = Math.max(0, score + specPenalty);
  }

  // Umbral mínimo de 35% (subido desde 25% - requiere más especificidad)
  // CRÍTICO: Si hay dimension mismatch, permitir scores más bajos pero visibles (REVISAR)
  const minThreshold = specPenalty < 0 ? 25 : 35;
  if (score < minThreshold) return null;

  return {
    inventoryItem: producto,
    score: Math.round(score),
    matchType,
    matchedTerms: [...new Set(matchedTerms)]
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
 * Interfaz para una fila de item en propuesta
 */
export interface PropuestaItemRow {
  id: string;
  match: ProductMatch | null;
  estado: 'auto' | 'confirmado' | 'descartado';
}

/**
 * Calcula métricas de cobertura de propuesta
 * CRÍTICO FV-UX-002: solo score >= 60 cuenta como VALIDADO
 * score < 60 (REVISAR) NO cuenta; items descartados NO cuentan
 */
export function calculateCoverageMetrics(rows: PropuestaItemRow[]): {
  itemsConMatchValidado: number;
  itemsConMatchDebil: number;
  itemsSinMatch: number;
  totalItems: number;
  cobertura: number;
  propuestaIncompleta: boolean;
} {
  const itemsConMatchValidado = rows.filter((f) => {
    if (!f.match || f.estado === 'descartado') return false;
    return f.match.score >= 60; // Solo high/medium confidence
  }).length;

  const itemsConMatchDebil = rows.filter((f) => {
    if (!f.match || f.estado === 'descartado') return false;
    return f.match.score < 60; // Low confidence (REVISAR)
  }).length;

  const itemsSinMatch = rows.filter((f) => !f.match && f.estado !== 'descartado').length;
  const totalItems = rows.filter((f) => f.estado !== 'descartado').length;
  const cobertura = totalItems > 0 ? Math.round((itemsConMatchValidado / totalItems) * 100) : 0;
  const propuestaIncompleta = (itemsSinMatch + itemsConMatchDebil) > 0;

  return {
    itemsConMatchValidado,
    itemsConMatchDebil,
    itemsSinMatch,
    totalItems,
    cobertura,
    propuestaIncompleta
  };
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
