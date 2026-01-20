import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface Producto {
  id: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  subcategoria?: string;
  unidad_medida?: string;
  precio_referencia?: number;
  keywords?: string[];
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompraAgilItem {
  id: string;
  compra_agil_id: string;
  codigo_compra?: string;
  nombre_producto: string;
  descripcion?: string;
  cantidad: number;
  unidad?: string;
  precio_unitario?: number;
  total?: number;
  categoria?: string;
  codigo_producto?: string;
  created_at: string;
}

// Hook: Buscar productos
export function useBuscarProductos(search: string, limit: number = 20) {
  return useQuery({
    queryKey: ['productos-buscar', search, limit],
    queryFn: async () => {
      if (!search || search.length < 2) return [];

      const { data, error } = await (supabase as any)
        .from('productos')
        .select('*')
        .eq('activo', true)
        .or(`nombre.ilike.%${search}%,codigo.ilike.%${search}%,categoria.ilike.%${search}%`)
        .limit(limit);

      if (error) throw error;
      return data as Producto[];
    },
    enabled: search.length >= 2,
  });
}

// Hook: Listar productos por categoría
export function useProductosPorCategoria(categoria: string) {
  return useQuery({
    queryKey: ['productos-categoria', categoria],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('productos')
        .select('*')
        .eq('categoria', categoria)
        .eq('activo', true)
        .order('nombre', { ascending: true });

      if (error) throw error;
      return data as Producto[];
    },
    enabled: !!categoria,
  });
}

// Hook: Obtener categorías de productos
export function useCategoriasProductos() {
  return useQuery({
    queryKey: ['productos-categorias'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('productos')
        .select('categoria')
        .eq('activo', true);

      if (error) throw error;

      // Obtener categorías únicas
      const categorias = [...new Set(data?.map((p: any) => p.categoria).filter(Boolean))];
      return categorias.sort() as string[];
    },
  });
}

// Hook: Estadísticas de productos
export function useProductosStats() {
  return useQuery({
    queryKey: ['productos-stats'],
    queryFn: async () => {
      const { count: total } = await (supabase as any)
        .from('productos')
        .select('*', { count: 'exact', head: true });

      const { count: activos } = await (supabase as any)
        .from('productos')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      const { data: categorias } = await (supabase as any)
        .from('productos')
        .select('categoria')
        .eq('activo', true);

      const uniqueCategorias = new Set(categorias?.map((p: any) => p.categoria).filter(Boolean));

      return {
        total: total || 0,
        activos: activos || 0,
        categorias: uniqueCategorias.size,
      };
    },
  });
}

// Hook: Items de compra ágil
export function useCompraAgilItems(compraAgilId: string | null) {
  return useQuery({
    queryKey: ['compra-agil-items', compraAgilId],
    queryFn: async () => {
      if (!compraAgilId) return [];

      const { data, error } = await (supabase as any)
        .from('compras_agiles_items')
        .select('*')
        .eq('compra_agil_id', compraAgilId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CompraAgilItem[];
    },
    enabled: !!compraAgilId,
  });
}

// Hook: Items de compra ágil por código
export function useCompraAgilItemsByCodigo(codigo: string | undefined) {
  return useQuery({
    queryKey: ['compra-agil-items-codigo', codigo],
    queryFn: async () => {
      if (!codigo) return [];

      const { data, error } = await (supabase as any)
        .from('compras_agiles_items')
        .select('*')
        .eq('codigo_compra', codigo)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CompraAgilItem[];
    },
    enabled: !!codigo,
  });
}

// Hook: Matching de productos
export function useMatchingProductos(nombreBuscado: string) {
  return useQuery({
    queryKey: ['matching-productos', nombreBuscado],
    queryFn: async () => {
      if (!nombreBuscado || nombreBuscado.length < 3) return [];

      // Buscar productos similares
      const palabras = nombreBuscado.toLowerCase().split(' ').filter(p => p.length > 2);
      
      const { data, error } = await (supabase as any)
        .from('productos')
        .select('*')
        .eq('activo', true)
        .limit(100);

      if (error) throw error;

      // Calcular similitud
      const productosConScore = (data as Producto[]).map(producto => {
        const nombreProducto = producto.nombre.toLowerCase();
        let score = 0;

        palabras.forEach(palabra => {
          if (nombreProducto.includes(palabra)) {
            score += 10;
          }
        });

        // Bonus por keywords
        if (producto.keywords) {
          producto.keywords.forEach(keyword => {
            if (nombreBuscado.toLowerCase().includes(keyword.toLowerCase())) {
              score += 5;
            }
          });
        }

        return { ...producto, score };
      });

      return productosConScore
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    },
    enabled: nombreBuscado.length >= 3,
  });
}
