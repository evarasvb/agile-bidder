/**
 * Edge Function: match-opportunities
 *
 * Item-level matching engine for FirmaVB.
 * Compares active licitaciones/compras ágiles against user inventory.
 *
 * Endpoints:
 *   POST /match-opportunities
 *     Body: { user_id?: string, oportunidad_ids?: string[] }
 *     - If user_id provided, runs matching for that user
 *     - If oportunidad_ids provided, matches only those opportunities
 *     - If neither, matches all active opportunities for the authenticated user
 *
 * Scoring weights (per spec):
 *   40% Product name similarity
 *   30% Category match
 *   15% Historical success rate with buyer
 *   15% Price competitiveness
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ TYPES ============

interface MatchItemScore {
  item_id: string;
  item_nombre: string;
  item_cantidad: number;
  item_unidad: string;
  inventory_id: string;
  inventory_sku: string;
  inventory_nombre: string;
  match_score: number;
  match_type: string;
  matched_terms: string[];
  precio_inventario: number;
  precio_sugerido: number;
  margen_aplicado: number;
}

interface ScoreBreakdown {
  nombre_similarity: number;
  category_match: number;
  historical_success: number;
  price_competitiveness: number;
}

interface BuyerIntelligence {
  institucion_nombre: string;
  institucion_rut: string | null;
  departamento: string | null;
  region: string | null;
  historial_compras: number;
  buen_pagador: boolean | null;
  oportunidades_previas: number;
  monto_historico: number;
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
  'n', 'nro', 'und', 'pza', 'pzs',
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
  const words = key.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words.map(stemWord))];
}

// ============ CATEGORY SYNONYMS ============

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  oficina: ['escritorio', 'papeleria', 'utiles', 'suministros', 'materiales oficina'],
  papel: ['resma', 'hoja', 'papel carta', 'papel oficio', 'papel bond', 'papel fotocopia'],
  escritura: ['lapiz', 'boligrafo', 'marcador', 'pluma', 'plumon', 'resaltador', 'tinta'],
  archivo: ['carpeta', 'archivador', 'folder', 'portafolio', 'organizador'],
  limpieza: ['detergente', 'jabon', 'desinfectante', 'cloro', 'escoba', 'trapero', 'bolsa basura'],
  tecnologia: ['computador', 'notebook', 'laptop', 'monitor', 'teclado', 'mouse', 'impresora', 'toner'],
  alimentos: ['comida', 'alimento', 'racion', 'cafe', 'azucar', 'leche', 'agua', 'bebida'],
  vestuario: ['ropa', 'uniforme', 'calzado', 'zapato', 'bota', 'guante', 'casco'],
  herramientas: ['herramienta', 'destornillador', 'martillo', 'alicate', 'llave', 'sierra', 'taladro'],
  mobiliario: ['mueble', 'silla', 'mesa', 'estante', 'escritorio', 'archivador', 'locker'],
};

// ============ SCORING FUNCTIONS ============

function scoreNameSimilarity(
  itemName: string,
  itemDesc: string | null,
  invName: string,
  invKeywords: string[] | null,
  invDesc: string | null
): { score: number; matchType: string; matchedTerms: string[] } {
  const normItem = normalizeText(itemName);
  const normInv = normalizeText(invName);
  const matchedTerms: string[] = [];

  if (normItem === normInv) {
    return { score: 100, matchType: 'exact', matchedTerms: [itemName] };
  }

  const nameSim = stringSimilarity(itemName, invName);
  if (nameSim >= 0.8) {
    return { score: Math.round(nameSim * 95), matchType: 'partial', matchedTerms: [invName] };
  }

  const itemKws = extractKeywords(`${itemName} ${itemDesc || ''}`);
  const invKws = extractKeywords(`${invName} ${invDesc || ''}`);
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
    if (kwScore >= 40) return { score: kwScore, matchType: 'keyword', matchedTerms };
  }

  if (normItem.length > 3 && (normInv.includes(normItem) || normItem.includes(normInv))) {
    return { score: 65, matchType: 'partial', matchedTerms: [itemName] };
  }

  if (nameSim >= 0.5) {
    return { score: Math.round(nameSim * 60), matchType: 'fuzzy', matchedTerms: [invName] };
  }

  return { score: 0, matchType: 'fuzzy', matchedTerms: [] };
}

function scoreCategoryMatch(
  itemName: string,
  itemCategory: string | null,
  invCategory: string | null
): number {
  if (!invCategory) return 0;
  const normInvCat = normalizeText(invCategory);
  const normItemCat = itemCategory ? normalizeText(itemCategory) : '';
  const normItemName = normalizeText(itemName);

  if (normItemCat && stringSimilarity(normItemCat, normInvCat) >= 0.7) return 100;
  if (normItemName.includes(normInvCat) || normInvCat.includes(normItemName)) return 80;

  const itemText = `${normItemName} ${normItemCat}`;
  for (const [cat, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const catNorm = normalizeText(cat);
    const invMatch = normInvCat.includes(catNorm) || synonyms.some(s => normInvCat.includes(normalizeText(s)));
    const itemMatch = itemText.includes(catNorm) || synonyms.some(s => itemText.includes(normalizeText(s)));
    if (invMatch && itemMatch) return 75;
  }

  const itemKws = extractKeywords(`${itemName} ${itemCategory || ''}`);
  const catKws = extractKeywords(invCategory);
  let catMatches = 0;
  for (const ck of catKws) {
    if (itemKws.some(ik => stringSimilarity(ik, ck) >= 0.7)) catMatches++;
  }
  return catKws.length > 0 ? Math.round((catMatches / catKws.length) * 60) : 0;
}

function scoreHistoricalSuccess(buyerInfo: BuyerIntelligence): number {
  let score = 50;
  if (buyerInfo.oportunidades_previas > 10) score += 20;
  else if (buyerInfo.oportunidades_previas > 5) score += 15;
  else if (buyerInfo.oportunidades_previas > 0) score += 10;
  if (buyerInfo.buen_pagador === true) score += 15;
  else if (buyerInfo.buen_pagador === false) score -= 20;
  if (buyerInfo.historial_compras > 20) score += 15;
  else if (buyerInfo.historial_compras > 5) score += 10;
  return Math.max(0, Math.min(100, score));
}

function scorePriceCompetitiveness(
  invPrecio: number,
  margenObjetivo: number,
  itemPrecioRef: number | null,
  presupuesto: number | null,
  totalItems: number
): number {
  const precioConMargen = invPrecio * (1 + Math.max(0, margenObjetivo) / 100);
  if (itemPrecioRef && itemPrecioRef > 0) {
    const ratio = precioConMargen / itemPrecioRef;
    if (ratio <= 0.85) return 100;
    if (ratio <= 0.95) return 90;
    if (ratio <= 1.0) return 75;
    if (ratio <= 1.1) return 50;
    if (ratio <= 1.3) return 25;
    return 10;
  }
  if (presupuesto && presupuesto > 0 && totalItems > 0) {
    const perItemBudget = presupuesto / totalItems;
    const ratio = precioConMargen / perItemBudget;
    if (ratio <= 0.7) return 90;
    if (ratio <= 0.9) return 80;
    if (ratio <= 1.0) return 60;
    if (ratio <= 1.2) return 40;
    return 20;
  }
  return 50;
}

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
  const precioCompetitivo = itemPrecioRef * 0.96;
  return Math.round(Math.max(precioMinimo, Math.min(precioCompetitivo, precioObjetivo)) * 100) / 100;
}

// ============ BUYER INTELLIGENCE ============

async function gatherBuyerIntelligence(
  supabase: any,
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
    const { count: licCount } = await supabase
      .from('licitaciones')
      .select('*', { count: 'exact', head: true })
      .eq('organismo', organismoNombre);

    const { count: caCount } = await supabase
      .from('compras_agiles')
      .select('*', { count: 'exact', head: true })
      .eq('organismo', organismoNombre);

    info.oportunidades_previas = (licCount || 0) + (caCount || 0);

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
      const firstOrden = ordenes[0];
      info.institucion_rut = firstOrden.datos_json?.RutInstitucion || null;
    }

    if (info.buen_pagador === null) {
      const { data: caBP } = await supabase
        .from('compras_agiles')
        .select('buen_pagador')
        .eq('organismo', organismoNombre)
        .not('buen_pagador', 'is', null)
        .limit(1);
      if (caBP && caBP.length > 0) info.buen_pagador = caBP[0].buen_pagador;
    }
  } catch (err) {
    console.error('[gatherBuyerIntelligence] Error:', err);
  }

  return info;
}

// ============ MATCHING CORE ============

async function matchOpportunity(
  supabase: any,
  opportunity: Opportunity,
  inventory: InventoryRow[]
): Promise<{
  match_score: number;
  items_matched: MatchItemScore[];
  precio_sugerido: number;
  score_breakdown: ScoreBreakdown;
  comprador_info: BuyerIntelligence;
  confidence_level: string;
  items_coverage: number;
}> {
  const buyerInfo = await gatherBuyerIntelligence(
    supabase, opportunity.organismo, opportunity.region, opportunity.buen_pagador
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

      const { score: nameScore, matchType, matchedTerms } = scoreNameSimilarity(
        item.nombre_producto, item.descripcion,
        inv.nombre_producto, inv.keywords, inv.descripcion
      );
      if (nameScore < 20) continue;

      const catScore = scoreCategoryMatch(item.nombre_producto, item.categoria || null, inv.categoria);
      const margenObj = Number(inv.margen_objetivo) || 25;
      const priceScore = scorePriceCompetitiveness(
        precio, margenObj, Number(item.precio_unitario) || null,
        opportunity.presupuesto, opportunity.items.length
      );

      const itemScore = Math.round(nameScore * 0.50 + catScore * 0.35 + priceScore * 0.15);

      if (itemScore > bestScore) {
        bestScore = itemScore;
        const margenMin = Number(inv.margen_minimo) || 10;
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
          precio_sugerido: suggestPrice(precio, margenMin, margenObj, Number(item.precio_unitario) || null),
          margen_aplicado: margenObj,
        };
      }
    }

    if (bestMatch && bestMatch.match_score >= 30) {
      itemsMatched.push(bestMatch);
      matchedCount++;
      totalNameScore += scoreNameSimilarity(item.nombre_producto, item.descripcion, bestMatch.inventory_nombre, null, null).score;
      totalCategoryScore += scoreCategoryMatch(
        item.nombre_producto, item.categoria || null,
        inventory.find(i => i.id === bestMatch!.inventory_id)?.categoria || null
      );
      totalPriceScore += scorePriceCompetitiveness(
        bestMatch.precio_inventario, bestMatch.margen_aplicado,
        Number(item.precio_unitario) || null, opportunity.presupuesto, opportunity.items.length
      );
    }
  }

  const totalItems = opportunity.items.length;
  const coverage = totalItems > 0 ? Math.round((matchedCount / totalItems) * 100) : 0;
  const avgName = matchedCount > 0 ? Math.round(totalNameScore / matchedCount) : 0;
  const avgCategory = matchedCount > 0 ? Math.round(totalCategoryScore / matchedCount) : 0;
  const avgPrice = matchedCount > 0 ? Math.round(totalPriceScore / matchedCount) : 0;

  const rawScore = Math.round(avgName * 0.40 + avgCategory * 0.30 + historicalScore * 0.15 + avgPrice * 0.15);
  const coverageFactor = coverage >= 50 ? 1.0 : 0.5 + (coverage / 100);
  const finalScore = Math.round(rawScore * coverageFactor);
  const totalSugerido = itemsMatched.reduce((sum, m) => sum + m.precio_sugerido * m.item_cantidad, 0);

  let confidence: string;
  if (finalScore >= 70 && coverage >= 60) confidence = 'high';
  else if (finalScore >= 45 || coverage >= 40) confidence = 'medium';
  else confidence = 'low';

  return {
    match_score: Math.max(0, Math.min(100, finalScore)),
    items_matched: itemsMatched,
    precio_sugerido: Math.round(totalSugerido * 100) / 100,
    score_breakdown: { nombre_similarity: avgName, category_match: avgCategory, historical_success: historicalScore, price_competitiveness: avgPrice },
    comprador_info: buyerInfo,
    confidence_level: confidence,
    items_coverage: coverage,
  };
}

// ============ EDGE FUNCTION HANDLER ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate
  const authHeader = req.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Use service role for DB operations (needed for cross-user matching in triggers)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  let userId: string;

  if (authHeader?.startsWith('Bearer ')) {
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    userId = data.user.id;
  } else {
    // Allow service-to-service calls without user auth (for triggers/cron)
    // In this case user_id must be provided in the body
    try {
      const body = await req.clone().json();
      if (!body.user_id) {
        return new Response(JSON.stringify({ error: 'Unauthorized - no user_id' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      userId = body.user_id;
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { oportunidad_ids } = body as { oportunidad_ids?: string[] };

    console.log(`[match-opportunities] User: ${userId}, specific IDs: ${oportunidad_ids?.length || 'all'}`);

    // 1. Fetch inventory
    const { data: inventory, error: invErr } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('activo', true);

    if (invErr || !inventory || inventory.length === 0) {
      return new Response(JSON.stringify({ results: [], message: 'No active inventory' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Fetch opportunities
    const opportunities: Opportunity[] = [];

    // Licitaciones
    let licQuery = supabaseAdmin
      .from('licitaciones')
      .select(`*, licitacion_items(*)`)
      .eq('estado', 'activa');
    if (oportunidad_ids) {
      licQuery = licQuery.in('id_licitacion', oportunidad_ids);
    }
    const { data: licitaciones } = await licQuery;

    if (licitaciones) {
      for (const lic of licitaciones) {
        const items = ((lic as any).licitacion_items || []).map((i: any) => ({
          id: String(i.id),
          nombre_producto: i.nombre_producto || '',
          descripcion: i.descripcion || null,
          cantidad: Number(i.cantidad) || 1,
          unidad: i.unidad || 'UN',
          precio_unitario: null,
          categoria: null,
        }));
        if (items.length === 0) {
          items.push({
            id: `lic-title-${(lic as any).id_licitacion}`,
            nombre_producto: (lic as any).titulo || '',
            descripcion: null, cantidad: 1, unidad: 'UN',
            precio_unitario: null, categoria: null,
          });
        }
        opportunities.push({
          id: (lic as any).id_licitacion,
          tipo: 'licitacion',
          titulo: (lic as any).titulo || '',
          organismo: (lic as any).organismo || '',
          presupuesto: Number((lic as any).presupuesto) || null,
          fecha_cierre: (lic as any).fecha_cierre || null,
          items,
        });
      }
    }

    // Compras Ágiles
    let caQuery = supabaseAdmin
      .from('compras_agiles')
      .select(`*, compras_agiles_items(*)`)
      .in('estado', ['Activo', 'activa', 'Publicada']);
    if (oportunidad_ids) {
      caQuery = caQuery.in('id', oportunidad_ids);
    }
    const { data: comprasAgiles } = await caQuery;

    if (comprasAgiles) {
      for (const ca of comprasAgiles) {
        const caAny = ca as any;
        const items = (caAny.compras_agiles_items || []).map((i: any) => ({
          id: String(i.id),
          nombre_producto: i.nombre_producto || '',
          descripcion: i.descripcion || null,
          cantidad: Number(i.cantidad) || 1,
          unidad: i.unidad || 'UN',
          precio_unitario: Number(i.precio_unitario) || null,
          categoria: i.categoria || null,
        }));
        if (items.length === 0) {
          items.push({
            id: `ca-title-${caAny.id}`,
            nombre_producto: caAny.nombre || '',
            descripcion: caAny.descripcion || null,
            cantidad: 1, unidad: 'UN',
            precio_unitario: null, categoria: null,
          });
        }
        opportunities.push({
          id: String(caAny.id),
          tipo: 'compra_agil',
          titulo: caAny.nombre || '',
          organismo: caAny.organismo || '',
          presupuesto: Number(caAny.monto) || null,
          fecha_cierre: caAny.fecha_cierre || null,
          region: caAny.region || null,
          buen_pagador: caAny.buen_pagador ?? null,
          items,
        });
      }
    }

    console.log(`[match-opportunities] Processing ${opportunities.length} opportunities against ${inventory.length} inventory items`);

    // 3. Run matching
    const results = [];
    for (const opp of opportunities) {
      const result = await matchOpportunity(supabaseAdmin, opp, inventory as InventoryRow[]);
      if (result.match_score > 0 && result.items_matched.length > 0) {
        results.push({
          oportunidad_id: opp.id,
          oportunidad_tipo: opp.tipo,
          ...result,
        });
      }
    }

    results.sort((a, b) => b.match_score - a.match_score);

    // 4. Persist to matches table
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

      const { error: upsertError } = await supabaseAdmin
        .from('matches')
        .upsert(rows, {
          onConflict: 'user_id,oportunidad_id,oportunidad_tipo',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error('[match-opportunities] Upsert error:', upsertError);
      } else {
        console.log(`[match-opportunities] Persisted ${rows.length} matches`);
      }
    }

    return new Response(JSON.stringify({
      results,
      total: results.length,
      high_confidence: results.filter(r => r.confidence_level === 'high').length,
      medium_confidence: results.filter(r => r.confidence_level === 'medium').length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[match-opportunities] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      results: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
