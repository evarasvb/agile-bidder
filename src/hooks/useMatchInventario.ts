import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCliente } from '@/hooks/useCliente';

export interface MatchedProduct {
  id: string;
  sku: string;
  nombre: string;
  categoria: string | null;
  stock: number | null;
  precio_unitario: number;
  descripcion: string | null;
  tiempo_entrega_dias: number | null;
  matchScore: number;
}

const KEYWORDS_MAP: Record<string, string[]> = {
  computacion: ['computador', 'notebook', 'laptop', 'pc', 'monitor', 'teclado', 'mouse', 'portátil', 'desktop', 'impresora'],
  insumo: ['papel', 'toner', 'tinta', 'resma', 'carpeta', 'archivador', 'sobre', 'agenda'],
  oficina: ['escritorio', 'silla', 'estante', 'mueble', 'archivador', 'lámpara', 'material', 'artículo'],
  equipamiento: ['equipo', 'periférico', 'accesorio', 'cable', 'adaptador', 'hub', 'servidor'],
};

function calculateMatchScore(productName: string, searchTerms: string[]): number {
  const nameLower = productName.toLowerCase();
  let score = 0;
  
  for (const term of searchTerms) {
    if (nameLower.includes(term.toLowerCase())) {
      score += 30;
    }
  }
  
  // Bonus for exact category match
  for (const [category, keywords] of Object.entries(KEYWORDS_MAP)) {
    for (const keyword of keywords) {
      if (nameLower.includes(keyword)) {
        score += 15;
      }
    }
  }
  
  return Math.min(score, 100);
}

function extractSearchTerms(nombre: string): string[] {
  const terms: string[] = [];
  const nombreLower = nombre.toLowerCase();
  
  for (const [category, keywords] of Object.entries(KEYWORDS_MAP)) {
    if (nombreLower.includes(category)) {
      terms.push(...keywords);
    }
    for (const keyword of keywords) {
      if (nombreLower.includes(keyword)) {
        terms.push(keyword);
      }
    }
  }
  
  // Also extract words from the name
  const words = nombre.split(/\s+/).filter(w => w.length > 3);
  terms.push(...words);
  
  return [...new Set(terms)];
}

export function useMatchInventario(compraNombre: string | null) {
  const { user } = useAuth();
  const { data: cliente } = useCliente();

  return useQuery({
    queryKey: ['match_inventario', compraNombre, cliente?.id],
    queryFn: async () => {
      if (!compraNombre || !cliente?.id) return [];

      const searchTerms = extractSearchTerms(compraNombre);
      
      if (searchTerms.length === 0) return [];

      // Get all active inventory for the client
      const { data: inventario, error } = await supabase
        .from('cliente_inventario')
        .select('*')
        .eq('cliente_id', cliente.id)
        .eq('activo', true);

      if (error) throw error;
      if (!inventario || inventario.length === 0) {
        // Try the general inventory table
        const { data: generalInventory, error: genError } = await supabase
          .from('inventory')
          .select('*')
          .eq('activo', true);

        if (genError) throw genError;
        
        const matched = (generalInventory || [])
          .map(item => ({
            id: item.id,
            sku: item.sku,
            nombre: item.nombre_producto,
            categoria: item.categoria,
            stock: item.stock_disponible,
            precio_unitario: item.precio_unitario,
            descripcion: item.descripcion,
            tiempo_entrega_dias: item.tiempo_entrega_dias,
            matchScore: calculateMatchScore(item.nombre_producto, searchTerms),
          }))
          .filter(item => item.matchScore > 0)
          .sort((a, b) => b.matchScore - a.matchScore);

        return matched as MatchedProduct[];
      }

      // Match products based on search terms
      const matched = inventario
        .map(item => ({
          id: item.id,
          sku: item.sku,
          nombre: item.nombre,
          categoria: item.categoria,
          stock: item.stock,
          precio_unitario: item.precio_unitario,
          descripcion: item.descripcion,
          tiempo_entrega_dias: item.tiempo_entrega_dias,
          matchScore: calculateMatchScore(item.nombre, searchTerms),
        }))
        .filter(item => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);

      return matched as MatchedProduct[];
    },
    enabled: !!compraNombre && !!cliente?.id,
  });
}
