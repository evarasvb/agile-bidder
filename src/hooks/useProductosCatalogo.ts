import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

export interface ProductoCatalogo {
  id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  subcategoria: string | null;
  precio_referencia: number | null;
  unidad_medida: string | null;
  keywords: string[] | null;
  activo: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductosCatalogoFilters {
  search?: string;
  categoria?: string;
  limit?: number;
}

export function useProductosCatalogo(filters?: ProductosCatalogoFilters) {
  return useQuery({
    queryKey: ['productos-catalogo', filters],
    queryFn: async () => {
      let query = (supabaseClient as any)
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (filters?.search) {
        query = query.or(`nombre.ilike.%${filters.search}%,descripcion.ilike.%${filters.search}%,codigo.ilike.%${filters.search}%`);
      }

      if (filters?.categoria && filters.categoria !== 'all') {
        query = query.eq('categoria', filters.categoria);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(1000);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching productos catalogo:', error);
        throw error;
      }

      return data as ProductoCatalogo[];
    },
  });
}

// Hook for searching products for matching
export function useProductosSearch(searchTerm: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['productos-search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return [];

      const { data, error } = await (supabaseClient as any)
        .from('productos')
        .select('*')
        .or(`nombre.ilike.%${searchTerm}%,descripcion.ilike.%${searchTerm}%`)
        .eq('activo', true)
        .limit(50);

      if (error) {
        console.error('Error searching productos:', error);
        throw error;
      }

      return data as ProductoCatalogo[];
    },
    enabled: enabled && searchTerm.length >= 2,
  });
}
