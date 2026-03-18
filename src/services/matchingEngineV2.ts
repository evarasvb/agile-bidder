/**
 * MATCHING ENGINE V2 - Item-level matching with buyer intelligence
 *
 * Extends the original matching engine with:
 * - Per-item matching against inventory (licitaciones AND compras ágiles)
 * - New scoring weights per task spec:
 *   40% Product name similarity
 *   30% Category match
 *   15% Historical success rate with buyer
 *   15% Price competitiveness
 * - Price suggestion based on inventory price + historical data + margin
 * - Buyer intelligence (institution info, purchase history, payment behavior)
 * - Persists results to the `matches` table
 */

import { supabase } from '@/integrations/supabase/client';

// Re-use NLP utilities from original engine where sensible
// (levenshtein, stemming, keyword extraction are duplicated here so this
//  module stays self-contained for the edge-function copy)

// ============ TYPES ============

export interface MatchItemScore {
  item_id: string;
  item_nombre: string;
  item_cantidad: number;
  item_unidad: string;
  inventory_id: string;
  inventory_sku: string;
  inventory_nombre: string;
  match_score: number; // 0-100
  match_type: 'exact' | 'partial' | 'keyword' | 'fuzzy' | 'category';
  matched_terms: string[];
  precio_inventario: number;
  precio_sugerido: number;
  margen_aplicado: number;
}

export interface ScoreBreakdown {
  nombre_similarity: number;  // 0-100, weight: 40%
  category_match: number;     // 0-100, weight: 30%
  historical_success: number; // 0-100, weight: 15%
  price_competitiveness: number; // 0-100, weight: 15%
}

export interface BuyerIntelligence {
  institucion_nombre: string;
  institucion_rut: string | null;
  departamento: string | null;
  region: string | null;
  historial_compras: number;
  buen_pagador: boolean | null;
  oportunidades_previas: number;
  monto_historico: number;
}

export interface MatchV2Result {
  oportunidad_id: string;
  oportunidad_tipo: 'licitacion' | 'compra_agil';
  match_score: number;
  items_matched: MatchItemScore[];
  precio_sugerido: number;
  score_breakdown: ScoreBreakdown;
  comprador_info: BuyerIntelligence;
  confidence_level: 'high' | 'medium' | 'low';
  items_coverage: number;
}

interface InventoryRow {
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
  activo: boolean | null;
}

interface OpportunityItem {
  id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  precio_unitario?: number | null;
  categoria?: string | null;
}

interface Opportunity {
  id: string;
  tipo: 'licitacion' | 'compra_agil';
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  region?: string | null;
  buen_pagador?: boolean | null;
  items: OpportunityItem[];
}

// ============ NLP UTILITIES ============

const keywordsCache = new Map<string, string[]>();
const MAX_CACHE = 2000;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string, maxDist?: number): number {
  const m = a.length;
  const n = b.length;
  if (maxDist !== undefined && Math.abs(m - n) > maxDist) return maxDist + 1;
  if (m > 100 || n > 100) {
    if (a.includes(b) || b.includes(a)) return Math.abs(m - n);
    return Math.max(m, n) * 0.5;
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    let minRow = dp[i][0];
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
      minRow = Math.min(minRow, dp[i][j]);
    }
    if (maxDist !== undefined && minRow > maxDist) return maxDist + 1;
  }
  return dp[m][n];
}

function stringSimilarity(s1: string, s2: string): number {
  const a = normalizeText(s1);
  const b = normalizeText(s2);
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - levenshteinDistance(a, b) / maxLen);
}

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'por', 'para', 'con', 'sin',
  'sobre', 'entre', 'tras', 'durante', 'mediante',
  'y', 'o', 'u', 'ni', 'que', 'se', 'su', 'sus',
  'es', 'son', 'ser', 'esta', 'como', 'mas', 'muy',
  'otros', 'todas', 'cada', 'tipo', 'segun',
  'n', 'nro', 'und', 'pza', 'pzs', 'c/u',
]);

const SUFFIXES = [
  'aciones', 'amiento', 'imiento', 'adores',
  'acion', 'mente', 'idad', 'ador', 'edor', 'idor',
  'ando', 'endo', 'iendo', 'adas', 'idas', 'ados', 'idos',
  'ante', 'ente', 'ista', 'ismo', 'able', 'ible',
  'cion', 'sion', 'oso', 'osa', 'ivo', 'iva',
  'es', 'as', 'os', 'is', 'us',
];

function stemWord(word: string): string {
  const w = word.toLowerCase().trim();
  for (const s of SUFFIXES) {
    if (w.endsWith(s) && w.length > s.length + 2) return w.slice(0, -s.length);
  }
  return w;
}

function extractKeywords(text: string): string[] {
  if (!text) return [];
  const key = normalizeText(text);
  if (keywordsCache.has(key)) return keywordsCache.get(key)!;
  if (keywordsCache.size > MAX_CACHE) {
    const first = keywordsCache.keys().next().value;
    if (first !== undefined) keywordsCache.delete(first);
  }
  const words = key.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const result = [...new Set(words.map(stemWord))];
  keywordsCache.set(key, result);
  return result;
}

// ============ CATEGORY SYNONYMS (from fuzzyMatching.ts) ============

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  oficina: ['escritorio', 'papeleria', 'utiles', 'suministros', 'materiales oficina'],
  papel: ['resma', 'hoja', 'papel carta', 'papel oficio', 'papel bond', 'papel fotocopia'],
  escritura: ['lapiz', 'boligrafo', 'marcador', 'pluma', 'plumon', 'resaltador', 'tinta'],
  archivo: ['carpeta', 'archivador', 'folder', 'portafolio', 'organizador', 'clasificador'],
  limpieza: ['detergente', 'jabon', 'desinfectante', 'cloro', 'escoba', 'trapero', 'bolsa basura'],
  tecnologia: ['computador', 'notebook', 'laptop', 'monitor', 'teclado', 'mouse', 'impresora', 'toner'],
  alimentos: ['comida', 'alimento', 'racion', 'cafe', 'azucar', 'leche', 'agua', 'bebida'],
  vestuario: ['ropa', 'uniforme', 'calzado', 'zapato', 'bota', 'guante', 'casco'],
  herramientas: ['herramienta', 'destornillador', 'martillo', 'alicate', 'llave', 'sierra', 'taladro'],
  mobiliario: ['mueble', 'silla', 'mesa', 'estante', 'escritorio', 'archivador', 'locker'],
};

// ============ SCORING FUNCTIONS ============

/**
 * Score: Product name similarity (Weight: 40%)
 * Compares item name against inventory product name using fuzzy matching
 */
function scoreNameSimilarity(
  itemName: string,
  itemDescription: string | null,
  invName: string,
  invKeywords: string[] | null,
  invDescription: string | null
): { score: number; matchType: MatchItemScore['match_type']; matchedTerms: string[] } {
  const normItem = normalizeText(itemName);
  const normInv = normalizeText(invName);
  const matchedTerms: string[] = [];

  // Exact match
  if (normItem === normInv) {
    return { score: 100, matchType: 'exact', matchedTerms: [itemName] };
  }

  // High similarity (partial)
  const nameSim = stringSimilarity(itemName, invName);
  if (nameSim >= 0.8) {
    matchedTerms.push(invName);
    return { score: Math.round(nameSim * 95), matchType: 'partial', matchedTerms };
  }

  // Keyword-level matching
  const itemKws = extractKeywords(`${itemName} ${itemDescription || ''}`);
  const invKws = extractKeywords(`${invName} ${invDescription || ''}`);
  const allInvKws = [...invKws, ...(invKeywords || []).map(k => normalizeText(k))];
  const invKwSet = new Set(allInvKws.map(stemWord));

  let matched = 0;
  for (const kw of itemKws) {
    const stemmed = stemWord(kw);
    if (invKwSet.has(stemmed)) {
      matched++;
      matchedTerms.push(kw);
      continue;
    }
    // Fuzzy compare against inv keywords
    for (const ik of allInvKws) {
      if (stringSimilarity(stemmed, stemWord(ik)) >= 0.75) {
        matched++;
        matchedTerms.push(kw);
        break;
      }
    }
  }

  if (itemKws.length > 0 && matched > 0) {
    const kwScore = Math.round((matched / itemKws.length) * 80);
    if (kwScore >= 40) {
      return { score: kwScore, matchType: 'keyword', matchedTerms };
    }
  }

  // Substring containment
  if (normItem.length > 3 && (normInv.includes(normItem) || normItem.includes(normInv))) {
    return { score: 65, matchType: 'partial', matchedTerms: [itemName] };
  }

  // General fuzzy
  if (nameSim >= 0.5) {
    return { score: Math.round(nameSim * 60), matchType: 'fuzzy', matchedTerms: [invName] };
  }

  return { score: 0, matchType: 'fuzzy', matchedTerms: [] };
}

/**
 * Score: Category match (Weight: 30%)
 * Compares item category/name against inventory category using synonym expansion
 */
function scoreCategoryMatch(
  itemName: string,
  itemCategory: string | null,
  invCategory: string | null
): number {
  if (!invCategory) return 0;

  const normInvCat = normalizeText(invCategory);
  const normItemCat = itemCategory ? normalizeText(itemCategory) : '';
  const normItemName = normalizeText(itemName);

  // Direct category match
  if (normItemCat && stringSimilarity(normItemCat, normInvCat) >= 0.7) {
    return 100;
  }

  // Category-in-name match
  if (normItemName.includes(normInvCat) || normInvCat.includes(normItemName)) {
    return 80;
  }

  // Synonym expansion
  const itemText = `${normItemName} ${normItemCat}`;
  for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const catNorm = normalizeText(cat);
    const invCatMatchesCat = normInvCat.includes(catNorm) ||
      synonyms.some(s => normInvCat.includes(normalizeText(s)));
    const itemMatchesCat = itemText.includes(catNorm) ||
      synonyms.some(s => itemText.includes(normalizeText(s)));

    if (invCatMatchesCat && itemMatchesCat) {
      return 75;
    }
  }

  // Keyword-level category comparison
  const itemKws = extractKeywords(`${itemName} ${itemCategory || ''}`);
  const catKws = extractKeywords(invCategory);
  let catMatches = 0;
  for (const ck of catKws) {
    if (itemKws.some(ik => stringSimilarity(ik, ck) >= 0.7)) catMatches++;
  }
  if (catKws.length > 0) {
    return Math.round((catMatches / catKws.length) * 60);
  }

  return 0;
}

/**
 * Score: Historical success rate with buyer (Weight: 15%)
 * Based on past interactions with the same institution
 */
function scoreHistoricalSuccess(buyerInfo: BuyerIntelligence): number {
  let score = 50; // Neutral baseline

  // More past opportunities = more familiarity
  if (buyerInfo.oportunidades_previas > 10) score += 20;
  else if (buyerInfo.oportunidades_previas > 5) score += 15;
  else if (buyerInfo.oportunidades_previas > 0) score += 10;

  // Good payer bonus
  if (buyerInfo.buen_pagador === true) score += 15;
  else if (buyerInfo.buen_pagador === false) score -= 20;

  // Historical purchase volume
  if (buyerInfo.historial_compras > 20) score += 15;
  else if (buyerInfo.historial_compras > 5) score += 10;

  return Math.max(0, Math.min(100, score));
}

/**
 * Score: Price competitiveness (Weight: 15%)
 * Compares inventory price against item's budget/reference price
 */
function scorePriceCompetitiveness(
  invPrecio: number,
  margenObjetivo: number,
  itemPrecioRef: number | null,
  presupuesto: number | null,
  totalItems: number
): number {
  const precioConMargen = invPrecio * (1 + Math.max(0, margenObjetivo) / 100);

  // If we have a direct reference price from the item
  if (itemPrecioRef && itemPrecioRef > 0) {
    const ratio = precioConMargen / itemPrecioRef;
    if (ratio <= 0.85) return 100;  // Well below market
    if (ratio <= 0.95) return 90;   // Competitive
    if (ratio <= 1.0) return 75;    // At market
    if (ratio <= 1.1) return 50;    // Slightly above
    if (ratio <= 1.3) return 25;    // Above market
    return 10;                       // Not competitive
  }

  // If we have overall budget, estimate per-item budget
  if (presupuesto && presupuesto > 0 && totalItems > 0) {
    const perItemBudget = presupuesto / totalItems;
    const ratio = precioConMargen / perItemBudget;
    if (ratio <= 0.7) return 90;
    if (ratio <= 0.9) return 80;
    if (ratio <= 1.0) return 60;
    if (ratio <= 1.2) return 40;
    return 20;
  }

  return 50; // Neutral when no reference available
}

// ============ PRICE SUGGESTION ============

/**
 * Suggest a price based on:
 * 1. Inventory base price + margin
 * 2. Item reference price (from opportunity)
 * 3. Market competitiveness
 */
function suggestPrice(
  invPrecio: number,
  margenMinimo: number,
  margenObjetivo: number,
  itemPrecioRef: number | null
): number {
  const precioMinimo = invPrecio * (1 + Math.max(0, margenMinimo) / 100);
  const precioObjetivo = invPrecio * (1 + Math.max(0, margenObjetivo) / 100);

  if (!itemPrecioRef || itemPrecioRef <= 0) {
    return Math.round(precioObjetivo * 100) / 100;
  }

  // Strategy: aim for 3-5% below reference price, but above minimum margin
  const precioCompetitivo = itemPrecioRef * 0.96;
  const sugerido = Math.max(precioMinimo, Math.min(precioCompetitivo, precioObjetivo));
  return Math.round(sugerido * 100) / 100;
}

// ============ BUYER INTELLIGENCE ============

/**
 * Gather buyer intelligence from existing data
 */
async function gatherBuyerIntelligence(
  organismoNombre: string,
  region?: string | null,
  buenPagador?: boolean | null
): Promise<BuyerIntelligence> {
  const info: BuyerIntelligence = {
    institucion_nombre: organismoNombre,
    institucion_rut: null,
    departamento: null,
    region: region || null,
    historial_compras: 0,
    buen_pagador: buenPagador ?? null,
    oportunidades_previas: 0,
    monto_historico: 0,
  };

  try {
    // Count past licitaciones from this organism
    const { count: licCount } = await supabase
      .from('licitaciones')
      .select('*', { count: 'exact', head: true })
      .eq('organismo', organismoNombre);

    // Count past compras agiles from this organism
    const { count: caCount } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true })
      .eq('organismo', organismoNombre);

    info.oportunidades_previas = (licCount || 0) + (caCount || 0);

    // Get historical purchase amounts
    const { data: ordenes } = await supabase
      .from('ordenes_compra')
      .select('datos_json')
      .eq('institucion_nombre', organismoNombre);

    if (ordenes && ordenes.length > 0) {
      info.historial_compras = ordenes.length;
      info.monto_historico = ordenes.reduce((sum: number, o: any) => {
        const monto = o.datos_json?.MontoTotal || o.datos_json?.monto_total || 0;
        return sum + Number(monto);
      }, 0);
    }

    // Try to get RUT from ordenes
    if (ordenes && ordenes.length > 0) {
      const firstOrden = ordenes[0] as any;
      info.institucion_rut = firstOrden.datos_json?.RutInstitucion ||
        firstOrden.datos_json?.institucion_rut || null;
    }

    // Check buen_pagador from compras_agiles if not already set
    if (info.buen_pagador === null) {
      const { data: caBuenPagador } = await supabase
        .from('compras_agiles')
        .select('buen_pagador')
        .eq('organismo', organismoNombre)
        .not('buen_pagador', 'is', null)
        .limit(1);

      if (caBuenPagador && caBuenPagador.length > 0) {
        info.buen_pagador = (caBuenPagador[0] as any).buen_pagador;
      }
    }
  } catch (err) {
    console.error('[gatherBuyerIntelligence] Error:', err);
  }

  return info;
}

// ============ MAIN MATCHING FUNCTION ============

/**
 * Match a single opportunity (licitación or compra ágil) against inventory.
 * Returns a MatchV2Result with per-item scores.
 */
export async function matchOpportunity(
  opportunity: Opportunity,
  inventory: InventoryRow[]
): Promise<MatchV2Result> {
  // Gather buyer intelligence
  const buyerInfo = await gatherBuyerIntelligence(
    opportunity.organismo,
    opportunity.region,
    opportunity.buen_pagador
  );

  const historicalScore = scoreHistoricalSuccess(buyerInfo);
  const itemsMatched: MatchItemScore[] = [];
  let totalNameScore = 0;
  let totalCategoryScore = 0;
  let totalPriceScore = 0;
  let matchedCount = 0;

  for (const item of opportunity.items) {
    let bestMatch: MatchItemScore | null = null;
    let bestScore = 0;

    for (const inv of inventory) {
      if (inv.activo === false) continue;
      const precio = Number(inv.precio_unitario) || 0;
      if (precio <= 0) continue;

      // 1. Name similarity (40%)
      const { score: nameScore, matchType, matchedTerms } = scoreNameSimilarity(
        item.nombre_producto,
        item.descripcion,
        inv.nombre_producto,
        inv.keywords,
        inv.descripcion
      );

      if (nameScore < 20) continue; // Skip very low matches

      // 2. Category match (30%)
      const catScore = scoreCategoryMatch(
        item.nombre_producto,
        item.categoria || null,
        inv.categoria
      );

      // 3. Price competitiveness (15%)
      const margenObj = Number(inv.margen_objetivo) || 25;
      const priceScore = scorePriceCompetitiveness(
        precio,
        margenObj,
        Number(item.precio_unitario) || null,
        opportunity.presupuesto,
        opportunity.items.length
      );

      // Weighted item score (historical is opportunity-level, not per-item)
      const itemScore = Math.round(
        nameScore * 0.50 +
        catScore * 0.35 +
        priceScore * 0.15
      );

      if (itemScore > bestScore) {
        bestScore = itemScore;
        const margenMin = Number(inv.margen_minimo) || 10;
        const suggested = suggestPrice(
          precio,
          margenMin,
          margenObj,
          Number(item.precio_unitario) || null
        );

        bestMatch = {
          item_id: item.id,
          item_nombre: item.nombre_producto,
          item_cantidad: Number(item.cantidad) || 1,
          item_unidad: item.unidad || 'UN',
          inventory_id: inv.id,
          inventory_sku: inv.sku || 'N/A',
          inventory_nombre: inv.nombre_producto,
          match_score: itemScore,
          match_type: matchType,
          matched_terms: matchedTerms,
          precio_inventario: precio,
          precio_sugerido: suggested,
          margen_aplicado: margenObj,
        };
      }
    }

    if (bestMatch && bestMatch.match_score >= 30) {
      itemsMatched.push(bestMatch);
      matchedCount++;

      // Accumulate for weighted overall score
      const { score: ns } = scoreNameSimilarity(
        item.nombre_producto, item.descripcion,
        bestMatch.inventory_nombre, null, null
      );
      totalNameScore += ns;
      totalCategoryScore += scoreCategoryMatch(
        item.nombre_producto, item.categoria || null,
        inventory.find(i => i.id === bestMatch!.inventory_id)?.categoria || null
      );
      totalPriceScore += scorePriceCompetitiveness(
        bestMatch.precio_inventario,
        bestMatch.margen_aplicado,
        Number(item.precio_unitario) || null,
        opportunity.presupuesto,
        opportunity.items.length
      );
    }
  }

  const totalItems = opportunity.items.length;
  const coverage = totalItems > 0 ? Math.round((matchedCount / totalItems) * 100) : 0;

  // Overall score breakdown (avg of matched items)
  const avgName = matchedCount > 0 ? Math.round(totalNameScore / matchedCount) : 0;
  const avgCategory = matchedCount > 0 ? Math.round(totalCategoryScore / matchedCount) : 0;
  const avgPrice = matchedCount > 0 ? Math.round(totalPriceScore / matchedCount) : 0;

  const scoreBreakdown: ScoreBreakdown = {
    nombre_similarity: avgName,
    category_match: avgCategory,
    historical_success: historicalScore,
    price_competitiveness: avgPrice,
  };

  // Final weighted score per spec: 40% name, 30% category, 15% historical, 15% price
  const rawScore = Math.round(
    avgName * 0.40 +
    avgCategory * 0.30 +
    historicalScore * 0.15 +
    avgPrice * 0.15
  );

  // Apply coverage penalty: if we match less than 50% of items, reduce score
  const coverageFactor = coverage >= 50 ? 1.0 : 0.5 + (coverage / 100);
  const finalScore = Math.round(rawScore * coverageFactor);

  // Total suggested price
  const totalSugerido = itemsMatched.reduce(
    (sum, m) => sum + m.precio_sugerido * m.item_cantidad, 0
  );

  // Confidence level
  let confidence: 'high' | 'medium' | 'low';
  if (finalScore >= 70 && coverage >= 60) confidence = 'high';
  else if (finalScore >= 45 || coverage >= 40) confidence = 'medium';
  else confidence = 'low';

  return {
    oportunidad_id: opportunity.id,
    oportunidad_tipo: opportunity.tipo,
    match_score: Math.max(0, Math.min(100, finalScore)),
    items_matched: itemsMatched,
    precio_sugerido: Math.round(totalSugerido * 100) / 100,
    score_breakdown: scoreBreakdown,
    comprador_info: buyerInfo,
    confidence_level: confidence,
    items_coverage: coverage,
  };
}

// ============ BATCH PROCESSING ============

/**
 * Run matching for all active opportunities against a user's inventory.
 * Persists results to the `matches` table.
 */
export async function runMatchingForUser(userId: string): Promise<MatchV2Result[]> {
  // 1. Fetch active inventory
  const { data: inventory, error: invErr } = await supabase
    .from('inventory')
    .select('*')
    .eq('activo', true);

  if (invErr || !inventory || inventory.length === 0) {
    console.log('[matchV2] No active inventory found');
    return [];
  }

  // 2. Fetch active licitaciones with items
  const { data: licitaciones } = await supabase
    .from('licitaciones')
    .select(`*, licitacion_items(*)`)
    .eq('estado', 'activa');

  // 3. Fetch active compras agiles with items
  const { data: comprasAgiles } = await supabase
    .from('compras_agiles')
    .select(`*, compras_agiles_items(*)`)
    .in('estado', ['Activo', 'activa', 'Publicada']);

  // Build opportunity list
  const opportunities: Opportunity[] = [];

  if (licitaciones) {
    for (const lic of licitaciones as any[]) {
      const items: OpportunityItem[] = (lic.licitacion_items || []).map((item: any) => ({
        id: String(item.id),
        nombre_producto: item.nombre_producto || '',
        descripcion: item.descripcion || null,
        cantidad: Number(item.cantidad) || 1,
        unidad: item.unidad || 'UN',
        precio_unitario: null,
        categoria: null,
      }));
      // If no items, create a synthetic item from the title
      if (items.length === 0) {
        items.push({
          id: `lic-title-${lic.id_licitacion}`,
          nombre_producto: lic.titulo || '',
          descripcion: null,
          cantidad: 1,
          unidad: 'UN',
          precio_unitario: null,
          categoria: null,
        });
      }
      opportunities.push({
        id: lic.id_licitacion,
        tipo: 'licitacion',
        titulo: lic.titulo || '',
        organismo: lic.organismo || '',
        presupuesto: Number(lic.presupuesto) || null,
        fecha_cierre: lic.fecha_cierre || null,
        items,
      });
    }
  }

  if (comprasAgiles) {
    for (const ca of comprasAgiles as any[]) {
      const items: OpportunityItem[] = (ca.compras_agiles_items || []).map((item: any) => ({
        id: String(item.id),
        nombre_producto: item.nombre_producto || '',
        descripcion: item.descripcion || null,
        cantidad: Number(item.cantidad) || 1,
        unidad: item.unidad || 'UN',
        precio_unitario: Number(item.precio_unitario) || null,
        categoria: item.categoria || null,
      }));
      if (items.length === 0) {
        items.push({
          id: `ca-title-${ca.id}`,
          nombre_producto: ca.nombre || '',
          descripcion: ca.descripcion || null,
          cantidad: 1,
          unidad: 'UN',
          precio_unitario: null,
          categoria: null,
        });
      }
      opportunities.push({
        id: String(ca.id),
        tipo: 'compra_agil',
        titulo: ca.nombre || '',
        organismo: ca.organismo || '',
        presupuesto: Number(ca.monto) || null,
        fecha_cierre: ca.fecha_cierre || null,
        region: ca.region || null,
        buen_pagador: ca.buen_pagador ?? null,
        items,
      });
    }
  }

  console.log(`[matchV2] Processing ${opportunities.length} opportunities against ${inventory.length} inventory items`);

  // 4. Run matching
  const results: MatchV2Result[] = [];
  for (const opp of opportunities) {
    const result = await matchOpportunity(opp, inventory as InventoryRow[]);
    if (result.match_score > 0 && result.items_matched.length > 0) {
      results.push(result);
    }
  }

  // Sort by score
  results.sort((a, b) => b.match_score - a.match_score);

  // 5. Persist to matches table (upsert by user+opportunity)
  if (results.length > 0) {
    const rows = results.map(r => ({
      user_id: userId,
      oportunidad_id: r.oportunidad_id,
      oportunidad_tipo: r.oportunidad_tipo,
      match_score: r.match_score,
      items_matched: r.items_matched,
      precio_sugerido: r.precio_sugerido,
      estado: 'nuevo',
      comprador_info: r.comprador_info,
      score_breakdown: r.score_breakdown,
      confidence_level: r.confidence_level,
      items_coverage: r.items_coverage,
    }));

    const { error: upsertError } = await supabase
      .from('matches' as any)
      .upsert(rows, {
        onConflict: 'user_id,oportunidad_id,oportunidad_tipo',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('[matchV2] Error upserting matches:', upsertError);
    } else {
      console.log(`[matchV2] Persisted ${rows.length} matches for user ${userId}`);
    }
  }

  return results;
}
