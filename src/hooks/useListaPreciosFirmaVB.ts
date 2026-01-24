import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductoFirmaVB {
  id: number;
  proveedor: string | null;
  categoria: string | null;
  descripcion: string;
  codigo: string | null;
  costo: string | null;
  margen_comercial: string | null;
  precio_venta_neto: string | null;
  unidad: string | null;
  created_at: string | null;
}

export interface ListaPreciosFilters {
  search?: string;
  categoria?: string;
  proveedor?: string;
}

// Hook principal para listar productos con paginación
export function useListaPreciosFirmaVB(filters?: ListaPreciosFilters) {
  return useQuery({
    queryKey: ['lista-precios-firmavb', filters],
    queryFn: async () => {
      // Fetch with pagination to handle large dataset
      const allItems: ProductoFirmaVB[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = (supabase as any)
          .from('lista_precios_firmavb')
          .select('id, "PROVEEDOR", "CATEGORIA", "DESCRIPCION", "CODIGO", "COSTO", "Mg Comercial", "Precio de venta neto", "Unidad", created_at', { count: 'exact' })
          .range(from, from + pageSize - 1)
          .order('id', { ascending: true });

        // Apply filters using correct column names
        if (filters?.search) {
          query = query.or(`"DESCRIPCION".ilike.%${filters.search}%,"CODIGO".ilike.%${filters.search}%,"PROVEEDOR".ilike.%${filters.search}%`);
        }
        if (filters?.categoria && filters.categoria !== 'all') {
          query = query.eq('CATEGORIA', filters.categoria);
        }
        if (filters?.proveedor && filters.proveedor !== 'all') {
          query = query.eq('PROVEEDOR', filters.proveedor);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching lista precios:', error);
          throw error;
        }

        if (data && data.length > 0) {
          // Map the uppercase columns to our interface
          const mapped = data.map((item: any) => ({
            id: item.id,
            proveedor: item.PROVEEDOR,
            categoria: item.CATEGORIA,
            descripcion: item.DESCRIPCION,
            codigo: item.CODIGO,
            costo: item.COSTO,
            margen_comercial: item['Mg Comercial'],
            precio_venta_neto: item['Precio de venta neto'],
            unidad: item.Unidad,
            created_at: item.created_at,
          }));
          allItems.push(...mapped);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Get unique categories
      const { data: catData } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('"CATEGORIA"');

      const categorias = [...new Set((catData || []).map((c: any) => c.CATEGORIA).filter(Boolean))].sort();

      // Get unique providers
      const { data: provData } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('"PROVEEDOR"');

      const proveedores = [...new Set((provData || []).map((p: any) => p.PROVEEDOR).filter(Boolean))].sort();

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
      const { count: total } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('*', { count: 'exact', head: true });

      const { data: categorias } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('"CATEGORIA"');

      const { data: proveedores } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('"PROVEEDOR"');

      const { data: valorData } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('"Precio de venta neto"');

      const valorTotal = (valorData || []).reduce((acc, item: any) => {
        const precio = parseFloat(item['Precio de venta neto']) || 0;
        return acc + precio;
      }, 0);

      return {
        totalProductos: total || 0,
        productosActivos: total || 0,
        totalCategorias: new Set((categorias || []).map((c: any) => c.CATEGORIA).filter(Boolean)).size,
        totalProveedores: new Set((proveedores || []).map((p: any) => p.PROVEEDOR).filter(Boolean)).size,
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

      const { data, error } = await (supabase as any)
        .from('lista_precios_firmavb')
        .select('id, "PROVEEDOR", "CATEGORIA", "DESCRIPCION", "CODIGO", "COSTO", "Mg Comercial", "Precio de venta neto", "Unidad"')
        .or(`"DESCRIPCION".ilike.%${searchTerm}%,"CODIGO".ilike.%${searchTerm}%`)
        .limit(50);

      if (error) {
        console.error('Error searching productos:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        id: item.id,
        proveedor: item.PROVEEDOR,
        categoria: item.CATEGORIA,
        descripcion: item.DESCRIPCION,
        codigo: item.CODIGO,
        costo: item.COSTO,
        margen_comercial: item['Mg Comercial'],
        precio_venta_neto: item['Precio de venta neto'],
        unidad: item.Unidad,
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
        .select('id, "PROVEEDOR", "CATEGORIA", "DESCRIPCION", "CODIGO", "COSTO", "Mg Comercial", "Precio de venta neto", "Unidad"')
        .or(`"DESCRIPCION".ilike.%${searchTerm}%,"CATEGORIA".ilike.%${searchTerm}%`)
        .limit(200);

      if (error) {
        console.error('Error matching productos:', error);
        throw error;
      }

      // Calcular score de matching
      const productosConScore = (data || []).map((item: any) => {
        const descripcionNorm = (item.DESCRIPCION || '')
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
        if (item.CODIGO && nombreBuscado.toLowerCase().includes(item.CODIGO.toLowerCase())) {
          score += 20;
        }

        return {
          id: item.id,
          proveedor: item.PROVEEDOR,
          categoria: item.CATEGORIA,
          descripcion: item.DESCRIPCION,
          codigo: item.CODIGO,
          costo: item.COSTO,
          margen_comercial: item['Mg Comercial'],
          precio_venta_neto: item['Precio de venta neto'],
          unidad: item.Unidad,
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
