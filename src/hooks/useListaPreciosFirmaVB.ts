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
// Usa la vista lista_precios_view con columnas normalizadas en minúsculas
export function useListaPreciosFirmaVB(filters?: ListaPreciosFilters) {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;

  return useQuery({
    queryKey: ['lista-precios-firmavb', filters],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Using lista_precios_view with lowercase column names
      let query = (supabase as any)
        .from('lista_precios_view')
        .select('id, categoria, descripcion, codigo, costo, margen_comercial, precio_venta_neto, unidad, created_at', { count: 'exact' })
        .range(from, to)
        .order('id', { ascending: true });

      // Apply filters with lowercase column names
      if (filters?.search && filters.search.length >= 2) {
        query = query.or(`descripcion.ilike.%${filters.search}%,codigo.ilike.%${filters.search}%`);
      }
      if (filters?.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria);
      }
      // Note: proveedor column doesn't exist in the view

      const { data, error, count } = await query;

      // Debug logging
      console.log('=== useListaPreciosFirmaVB DEBUG ===');
      console.log('Query result - data:', data);
      console.log('Query result - error:', error);
      console.log('Query result - count:', count);
      console.log('Data length:', data?.length || 0);
      console.log('First item:', data?.[0]);
      console.log('=====================================');

      if (error) {
        console.error('Error fetching lista precios:', error);
        throw error;
      }

      // Map view column names to interface
      const items: ProductoFirmaVB[] = (data || []).map((item: any) => ({
        id: item.id,
        proveedor: null, // Not available in view
        categoria: item.categoria,
        descripcion: item.descripcion,
        codigo: item.codigo,
        costo: item.costo,
        margen_comercial: item.margen_comercial,
        precio_venta_neto: item.precio_venta_neto,
        unidad: item.unidad,
        activo: true, // Not available in view, default to true
        created_at: item.created_at,
      }));

      return {
        items,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });
}

// Hook para obtener categorías únicas (sin proveedor en la vista)
export function useListaPreciosFilterOptions() {
  return useQuery({
    queryKey: ['lista-precios-filter-options'],
    queryFn: async () => {
      const { data: catData } = await (supabase as any)
        .from('lista_precios_view')
        .select('categoria');

      const categorias = [...new Set((catData || []).map((c: any) => c.categoria).filter(Boolean))].sort() as string[];

      // No proveedor in the view
      return { categorias, proveedores: [] };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para estadísticas
export function useListaPreciosStats() {
  return useQuery({
    queryKey: ['lista-precios-stats'],
    queryFn: async () => {
      const { count: total } = await (supabase as any)
        .from('lista_precios_view')
        .select('*', { count: 'exact', head: true });

      const { data: categorias } = await (supabase as any)
        .from('lista_precios_view')
        .select('categoria');

      const { data: valorData } = await (supabase as any)
        .from('lista_precios_view')
        .select('precio_venta_neto')
        .limit(1000);

      const valorTotal = (valorData || []).reduce((acc: number, item: any) => {
        const precio = parseFloat(item.precio_venta_neto) || 0;
        return acc + precio;
      }, 0);

      return {
        totalProductos: total || 0,
        productosActivos: total || 0,
        totalCategorias: new Set((categorias || []).map((c: any) => c.categoria).filter(Boolean)).size,
        totalProveedores: 0, // Not available in view
        valorCatalogoTotal: valorTotal,
      };
    },
    staleTime: 60 * 1000,
  });
}

// Hook para buscar productos
export function useBuscarProductosFirmaVB(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['lista-precios-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await (supabase as any)
        .from('lista_precios_view')
        .select('id, categoria, descripcion, codigo, costo, margen_comercial, precio_venta_neto, unidad')
        .or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%`)
        .limit(50);

      if (error) {
        console.error('Error searching productos:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        proveedor: null,
        categoria: item.categoria,
        descripcion: item.descripcion,
        codigo: item.codigo,
        costo: item.costo,
        margen_comercial: item.margen_comercial,
        precio_venta_neto: item.precio_venta_neto,
        unidad: item.unidad,
        activo: true,
        created_at: null,
      })) as ProductoFirmaVB[];
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

      const palabras = nombreBuscado
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/[\s,;.]+/)
        .filter(p => p.length > 2);

      if (palabras.length === 0) return [];

      const searchTerm = palabras[0];
      const { data, error } = await (supabase as any)
        .from('lista_precios_view')
        .select('id, categoria, descripcion, codigo, costo, margen_comercial, precio_venta_neto, unidad')
        .or(`descripcion.ilike.%${searchTerm}%,categoria.ilike.%${searchTerm}%`)
        .limit(200);

      if (error) {
        console.error('Error matching productos:', error);
        throw error;
      }

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

        if (item.codigo && nombreBuscado.toLowerCase().includes(item.codigo.toLowerCase())) {
          score += 20;
        }

        return {
          id: item.id,
          proveedor: null,
          categoria: item.categoria,
          descripcion: item.descripcion,
          codigo: item.codigo,
          costo: item.costo,
          margen_comercial: item.margen_comercial,
          precio_venta_neto: item.precio_venta_neto,
          unidad: item.unidad,
          activo: true,
          created_at: null,
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
