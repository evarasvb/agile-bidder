import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductoFirmaVB {
  id: string;
  proveedor: string | null;
  categoria: string | null;
  descripcion: string | null;
  codigo: string | null;
  costo: number | null;
  margen_comercial: number | null;
  precio_venta_neto: number | null;
  unidad: string | null;
  activo: boolean;
  created_at: string | null;
}

export interface ListaPreciosFilters {
  search?: string;
  categoria?: string;
  proveedor?: string;
  page?: number;
  pageSize?: number;
}

// Hook principal con paginación del lado del servidor
export function useListaPreciosFirmaVB(filters?: ListaPreciosFilters) {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;

  return useQuery({
    queryKey: ['lista-precios-firmavb', filters],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = (supabase as any)
        .from('lista_precios_firmavb')
        .select('id, proveedor, categoria, descripcion, codigo, costo, margen_comercial, precio_venta_neto, unidad, activo, created_at', { count: 'exact' })
        .eq('activo', true)
        .range(from, to)
        .order('id', { ascending: true });

      // Apply filters
      if (filters?.search && filters.search.length >= 2) {
        query = query.or(`descripcion.ilike.%${filters.search}%,codigo.ilike.%${filters.search}%,proveedor.ilike.%${filters.search}%`);
      }
      if (filters?.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria);
      }
      if (filters?.proveedor && filters.proveedor !== 'all') {
        query = query.eq('proveedor', filters.proveedor);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching lista precios:', error);
        throw error;
      }

      return {
        items: (data || []) as ProductoFirmaVB[],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Hook para obtener categorías y proveedores únicos (solo para filtros)
export function useListaPreciosFilterOptions() {
  return useQuery({
    queryKey: ['lista-precios-filter-options'],
    queryFn: async () => {
      // Get unique categories
      const { data: catData } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('categoria')
        .eq('activo', true);

      const categorias = [...new Set((catData || []).map((c: any) => c.categoria).filter(Boolean))].sort() as string[];

      // Get unique providers  
      const { data: provData } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('proveedor')
        .eq('activo', true);

      const proveedores = [...new Set((provData || []).map((p: any) => p.proveedor).filter(Boolean))].sort() as string[];

      return { categorias, proveedores };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Hook para estadísticas
export function useListaPreciosStats() {
  return useQuery({
    queryKey: ['lista-precios-stats'],
    queryFn: async () => {
      const { count: total } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      const { data: categorias } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('categoria')
        .eq('activo', true);

      const { data: proveedores } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('proveedor')
        .eq('activo', true);

      // Get sum of prices more efficiently
      const { data: valorData } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('precio_venta_neto')
        .eq('activo', true)
        .limit(1000); // Limit for performance

      const valorTotal = (valorData || []).reduce((acc: number, item: any) => {
        const precio = parseFloat(item.precio_venta_neto) || 0;
        return acc + precio;
      }, 0);

      return {
        totalProductos: total || 0,
        productosActivos: total || 0,
        totalCategorias: new Set((categorias || []).map((c: any) => c.categoria).filter(Boolean)).size,
        totalProveedores: new Set((proveedores || []).map((p: any) => p.proveedor).filter(Boolean)).size,
        valorCatalogoTotal: valorTotal,
      };
    },
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

// Hook para buscar productos (para matching)
export function useBuscarProductosFirmaVB(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lista-precios-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('id, proveedor, categoria, descripcion, codigo, costo, margen_comercial, precio_venta_neto, unidad')
        .eq('activo', true)
        .or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
        .limit(50);

      if (error) {
        console.error('Error searching productos:', error);
        throw error;
      }

      return (data || []) as ProductoFirmaVB[];
    },
    enabled: enabled && searchTerm.length >= 2,
  });
}

// Hook para matching con licitaciones/compras ágiles
export function useMatchProductosFirmaVB(nombreBuscado: string | null) {
  return useQuery({
    queryKey: ['match-productos-firmavb', nombreBuscado],
    queryFn: async () => {
      if (!nombreBuscado || nombreBuscado.length < 3) return [];

      // Extraer palabras clave
      const palabras = nombreBuscado
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[\s,;.]+/)
        .filter(p => p.length > 2);

      if (palabras.length === 0) return [];

      // Buscar productos que coincidan con el primer término
      const searchTerm = palabras[0];
      const { data, error } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('id, proveedor, categoria, descripcion, codigo, costo, margen_comercial, precio_venta_neto, unidad')
        .eq('activo', true)
        .or(`descripcion.ilike.%${searchTerm}%,categoria.ilike.%${searchTerm}%`)
        .limit(200);

      if (error) {
        console.error('Error matching productos:', error);
        throw error;
      }

      // Calcular score de matching
      const productosConScore = (data || []).map((item: any) => {
        const descripcionNorm = (item.descripcion || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        
        let score = 0;
        let matchedTerms: string[] = [];

        palabras.forEach(palabra => {
          if (descripcionNorm.includes(palabra)) {
            score += 10;
            matchedTerms.push(palabra);
          }
        });

        // Bonus por coincidencia de código
        if (item.codigo && nombreBuscado.toLowerCase().includes(item.codigo.toLowerCase())) {
          score += 20;
        }

        return {
          ...item,
          matchScore: score,
          matchedTerms,
          matchType: score >= 30 ? 'exact' : score >= 15 ? 'partial' : 'similar' as const,
        };
      });

      return productosConScore
        .filter(p => p.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20);
    },
    enabled: !!nombreBuscado && nombreBuscado.length >= 3,
  });
}
