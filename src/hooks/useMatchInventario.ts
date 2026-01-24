import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MatchedProduct {
  id: string;
  codigo: string | null;
  nombre: string;
  categoria: string | null;
  proveedor: string | null;
  costo: number;
  margen_comercial: number;
  precio_unitario: number;
  descripcion: string | null;
  unidad: string | null;
  matchScore: number;
  matchType: 'exact' | 'partial' | 'similar';
  matchedTerms: string[];
}

const KEYWORDS_MAP: Record<string, string[]> = {
  computacion: ['computador', 'notebook', 'laptop', 'pc', 'monitor', 'teclado', 'mouse', 'portátil', 'desktop', 'impresora'],
  insumo: ['papel', 'toner', 'tinta', 'resma', 'carpeta', 'archivador', 'sobre', 'agenda'],
  oficina: ['escritorio', 'silla', 'estante', 'mueble', 'archivador', 'lámpara', 'material', 'artículo'],
  equipamiento: ['equipo', 'periférico', 'accesorio', 'cable', 'adaptador', 'hub', 'servidor'],
  limpieza: ['limpieza', 'jabón', 'detergente', 'desinfectante', 'escoba', 'trapero', 'papel higiénico'],
  seguridad: ['seguridad', 'extintor', 'cámara', 'alarma', 'sensor', 'cerradura'],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .trim();
}

function calculateMatchScore(descripcion: string, searchTerms: string[]): { score: number; matchedTerms: string[] } {
  const descNorm = normalizeText(descripcion);
  let score = 0;
  const matchedTerms: string[] = [];
  
  for (const term of searchTerms) {
    const termNorm = normalizeText(term);
    if (termNorm.length < 2) continue;
    
    if (descNorm.includes(termNorm)) {
      score += termNorm.length >= 5 ? 15 : 10;
      matchedTerms.push(term);
    }
  }
  
  // Bonus for category keywords match
  for (const [category, keywords] of Object.entries(KEYWORDS_MAP)) {
    for (const keyword of keywords) {
      if (descNorm.includes(keyword)) {
        score += 5;
        if (!matchedTerms.includes(keyword)) {
          matchedTerms.push(keyword);
        }
      }
    }
  }
  
  return { score: Math.min(score, 100), matchedTerms };
}

function extractSearchTerms(nombre: string): string[] {
  const terms: string[] = [];
  const nombreNorm = normalizeText(nombre);
  
  // Extract words longer than 2 characters
  const words = nombreNorm.split(/\s+/).filter(w => w.length > 2);
  terms.push(...words);
  
  // Add relevant keywords based on the name
  for (const [category, keywords] of Object.entries(KEYWORDS_MAP)) {
    if (nombreNorm.includes(category)) {
      terms.push(...keywords);
    }
    for (const keyword of keywords) {
      if (nombreNorm.includes(keyword)) {
        terms.push(keyword);
      }
    }
  }
  
  return [...new Set(terms)];
}

export function useMatchInventario(compraNombre: string | null) {
  return useQuery({
    queryKey: ['match_inventario_firmavb', compraNombre],
    queryFn: async () => {
      if (!compraNombre || compraNombre.length < 3) return [];

      const searchTerms = extractSearchTerms(compraNombre);
      
      if (searchTerms.length === 0) return [];

      // Fetch products from lista_precios_firmavb
      const { data: productos, error } = await supabase
        .from('lista_precios_firmavb')
        .select('*')
        .eq('activo', true)
        .limit(500);

      if (error) {
        console.error('Error fetching productos for matching:', error);
        throw error;
      }

      if (!productos || productos.length === 0) return [];

      // Match products based on search terms
      const matched = productos
        .map(item => {
          const { score, matchedTerms } = calculateMatchScore(item.descripcion, searchTerms);
          
          // Additional score for código match
          let finalScore = score;
          if (item.codigo && compraNombre.toLowerCase().includes(item.codigo.toLowerCase())) {
            finalScore += 25;
            matchedTerms.push(`código: ${item.codigo}`);
          }
          
          return {
            id: item.id,
            codigo: item.codigo,
            nombre: item.descripcion,
            categoria: item.categoria,
            proveedor: item.proveedor,
            costo: Number(item.costo) || 0,
            margen_comercial: Number(item.margen_comercial) || 0,
            precio_unitario: Number(item.precio_venta_neto) || 0,
            descripcion: item.descripcion,
            unidad: item.unidad,
            matchScore: finalScore,
            matchType: finalScore >= 40 ? 'exact' : finalScore >= 20 ? 'partial' : 'similar' as const,
            matchedTerms,
          };
        })
        .filter(item => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20);

      return matched as MatchedProduct[];
    },
    enabled: !!compraNombre && compraNombre.length >= 3,
  });
}

// Bulk matching for multiple items
export function useMatchMultipleItems(items: { id: string; nombre: string }[]) {
  return useQuery({
    queryKey: ['match_multiple_firmavb', items.map(i => i.id).join(',')],
    queryFn: async () => {
      if (items.length === 0) return new Map<string, MatchedProduct[]>();

      // Fetch all active products
      const { data: productos, error } = await supabase
        .from('lista_precios_firmavb')
        .select('*')
        .eq('activo', true);

      if (error) {
        console.error('Error fetching productos for bulk matching:', error);
        throw error;
      }

      const results = new Map<string, MatchedProduct[]>();

      for (const item of items) {
        const searchTerms = extractSearchTerms(item.nombre);
        if (searchTerms.length === 0) {
          results.set(item.id, []);
          continue;
        }

        const matched = (productos || [])
          .map(p => {
            const { score, matchedTerms } = calculateMatchScore(p.descripcion, searchTerms);
            return {
              id: p.id,
              codigo: p.codigo,
              nombre: p.descripcion,
              categoria: p.categoria,
              proveedor: p.proveedor,
              costo: Number(p.costo) || 0,
              margen_comercial: Number(p.margen_comercial) || 0,
              precio_unitario: Number(p.precio_venta_neto) || 0,
              descripcion: p.descripcion,
              unidad: p.unidad,
              matchScore: score,
              matchType: score >= 40 ? 'exact' : score >= 20 ? 'partial' : 'similar' as const,
              matchedTerms,
            };
          })
          .filter(p => p.matchScore > 0)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 10);

        results.set(item.id, matched as MatchedProduct[]);
      }

      return results;
    },
    enabled: items.length > 0,
  });
}
