import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// Inteligencia de mercado: cruza los ítems de una oportunidad con las órdenes de
// compra reales (RPC inteligencia_oc_oportunidad) para responder:
//   - ¿a qué PRECIO se ha comprado esto? (referencia)
//   - ¿quién GANA estas OC? (competidores)
//   - ¿quién COMPRA esto? (potenciales clientes / demanda)
// =============================================================================

export interface OCIntelLine {
  oc_codigo: string;
  organismo: string | null;
  proveedor: string | null;
  rut_proveedor: string | null;
  producto: string | null;
  precio_unitario: number | null;
  cantidad: number | null;
  valor_total: number | null;
  fecha: string | null;
  score: number;
}

export interface AgregadoIntel {
  nombre: string;
  ocs: number;
  monto: number;
}

export interface InteligenciaOC {
  lines: OCIntelLine[];
  total: number;
  precio: { min: number; prom: number; max: number } | null;
  competidores: AgregadoIntel[]; // proveedores que ganan
  compradores: AgregadoIntel[];  // organismos que compran
  muestra: OCIntelLine[];        // OC recientes
}

const normNombre = (s: string | null) => (s || '').trim().replace(/\s+/g, ' ');

function agrupar(lines: OCIntelLine[], key: 'proveedor' | 'organismo'): AgregadoIntel[] {
  const map = new Map<string, { ocs: Set<string>; monto: number }>();
  for (const l of lines) {
    const nombre = normNombre(l[key]);
    if (!nombre) continue;
    if (!map.has(nombre)) map.set(nombre, { ocs: new Set(), monto: 0 });
    const e = map.get(nombre)!;
    e.ocs.add(l.oc_codigo);
    e.monto += Number(l.valor_total) || 0;
  }
  return Array.from(map.entries())
    .map(([nombre, e]) => ({ nombre, ocs: e.ocs.size, monto: e.monto }))
    .sort((a, b) => b.ocs - a.ocs || b.monto - a.monto)
    .slice(0, 6);
}

export function useInteligenciaOC(
  codigo: string | null | undefined,
  tipo: 'compra_agil' | 'licitacion' | null
) {
  return useQuery({
    queryKey: ['inteligencia-oc', codigo, tipo],
    queryFn: async (): Promise<InteligenciaOC> => {
      const empty: InteligenciaOC = { lines: [], total: 0, precio: null, competidores: [], compradores: [], muestra: [] };
      if (!codigo || !tipo) return empty;

      const { data, error } = await (supabase as any).rpc('inteligencia_oc_oportunidad', {
        p_codigo: codigo,
        p_tipo: tipo,
        p_limit: 80,
      });
      if (error) {
        console.error('[InteligenciaOC] error:', error);
        throw error;
      }
      const lines = (data || []) as OCIntelLine[];
      if (lines.length === 0) return empty;

      // Precio de referencia (unitario, ignorando nulos/ceros).
      const precios = lines
        .map((l) => Number(l.precio_unitario))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b);
      const precio = precios.length
        ? {
            min: precios[0],
            max: precios[precios.length - 1],
            prom: Math.round(precios.reduce((s, n) => s + n, 0) / precios.length),
          }
        : null;

      // Muestra reciente (por fecha desc).
      const muestra = [...lines]
        .sort((a, b) => {
          const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
          const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 10);

      return {
        lines,
        total: lines.length,
        precio,
        competidores: agrupar(lines, 'proveedor'),
        compradores: agrupar(lines, 'organismo'),
        muestra,
      };
    },
    enabled: !!codigo && !!tipo,
    staleTime: 5 * 60 * 1000,
  });
}
