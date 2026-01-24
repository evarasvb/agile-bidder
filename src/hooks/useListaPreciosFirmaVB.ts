import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductoFirmaVB {
  id: string;
  proveedor: string | null;
  categoria: string | null;
  descripcion: string;
  codigo: string | null;
  costo: number;
  margen_comercial: number;
  precio_venta_neto: number;
  unidad: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListaPreciosFilters {
  search?: string;
  categoria?: string;
  proveedor?: string;
  activo?: boolean;
}

// Hook principal para listar productos con paginación
export function useListaPreciosFirmaVB(filters?: ListaPreciosFilters) {
  return useQuery({
    queryKey: ['lista-precios-firmavb', filters],
    queryFn: async () => {
      // Fetch all items with pagination to bypass 1000 row limit
      const allItems: ProductoFirmaVB[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('lista_precios_firmavb')
          .select('*', { count: 'exact' })
          .range(from, from + pageSize - 1)
          .order('descripcion', { ascending: true });

        // Apply filters
        if (filters?.search) {
          query = query.or(`descripcion.ilike.%${filters.search}%,codigo.ilike.%${filters.search}%,proveedor.ilike.%${filters.search}%`);
        }
        if (filters?.categoria && filters.categoria !== 'all') {
          query = query.eq('categoria', filters.categoria);
        }
        if (filters?.proveedor && filters.proveedor !== 'all') {
          query = query.eq('proveedor', filters.proveedor);
        }
        if (filters?.activo !== undefined) {
          query = query.eq('activo', filters.activo);
        }

        const { data, error, count } = await query;

        if (error) {
          console.error('Error fetching lista precios:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allItems.push(...(data as ProductoFirmaVB[]));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Get unique categories
      const { data: catData } = await supabase
        .from('lista_precios_firmavb')
        .select('categoria')
        .not('categoria', 'is', null);

      const categorias = [...new Set((catData || []).map((c: any) => c.categoria).filter(Boolean))].sort();

      // Get unique providers
      const { data: provData } = await supabase
        .from('lista_precios_firmavb')
        .select('proveedor')
        .not('proveedor', 'is', null);

      const proveedores = [...new Set((provData || []).map((p: any) => p.proveedor).filter(Boolean))].sort();

      return {
        items: allItems,
        total: allItems.length,
        categorias: categorias as string[],
        proveedores: proveedores as string[],
      };
    },
  });
}

// Hook para estadísticas
export function useListaPreciosStats() {
  return useQuery({
    queryKey: ['lista-precios-stats'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('lista_precios_firmavb')
        .select('*', { count: 'exact', head: true });

      const { count: activos } = await supabase
        .from('lista_precios_firmavb')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      const { data: categorias } = await supabase
        .from('lista_precios_firmavb')
        .select('categoria')
        .eq('activo', true);

      const { data: proveedores } = await supabase
        .from('lista_precios_firmavb')
        .select('proveedor')
        .eq('activo', true);

      const { data: valorData } = await supabase
        .from('lista_precios_firmavb')
        .select('precio_venta_neto')
        .eq('activo', true);

      const valorTotal = (valorData || []).reduce((acc, item) => acc + (Number(item.precio_venta_neto) || 0), 0);

      return {
        totalProductos: total || 0,
        productosActivos: activos || 0,
        totalCategorias: new Set((categorias || []).map((c: any) => c.categoria).filter(Boolean)).size,
        totalProveedores: new Set((proveedores || []).map((p: any) => p.proveedor).filter(Boolean)).size,
        valorCatalogoTotal: valorTotal,
      };
    },
  });
}

// Hook para buscar productos (para matching)
export function useBuscarProductosFirmaVB(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lista-precios-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await supabase
        .from('lista_precios_firmavb')
        .select('*')
        .eq('activo', true)
        .or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
        .limit(50);

      if (error) {
        console.error('Error searching productos:', error);
        throw error;
      }

      return data as ProductoFirmaVB[];
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

      // Buscar productos que coincidan
      const { data, error } = await supabase
        .from('lista_precios_firmavb')
        .select('*')
        .eq('activo', true)
        .limit(200);

      if (error) {
        console.error('Error matching productos:', error);
        throw error;
      }

      // Calcular score de matching
      const productosConScore = (data || []).map((producto: ProductoFirmaVB) => {
        const descripcionNorm = (producto.descripcion || '')
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
        if (producto.codigo && nombreBuscado.toLowerCase().includes(producto.codigo.toLowerCase())) {
          score += 20;
        }

        return {
          ...producto,
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
