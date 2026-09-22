import { useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';
import { useAuth } from './useAuth';
import { useState } from 'react';

export interface ClienteInventarioItem {
  id: string;
  cliente_id: string;
  sku: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  precio_unitario: number;
  stock: number | null;
  imagen_url: string | null;
  margen_minimo: number | null;
  palabras_clave: string[] | null;
  tiempo_entrega_dias: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteInventarioFilters {
  search?: string;
  categoria?: string;
}

export function useClienteInventario(filters?: ClienteInventarioFilters) {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['cliente-inventario', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return { items: [], total: 0, categorias: [] };

      // Fetch all items with pagination to bypass 1000 row limit
      const allItems: ClienteInventarioItem[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabaseClient
          .from('cliente_inventario')
          .select('*', { count: 'exact' })
          .eq('cliente_id', user.id)
          .range(from, from + pageSize - 1)
          .order('nombre', { ascending: true });

        // Apply filters
        if (filters?.search) {
          query = query.or(`nombre.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,descripcion.ilike.%${filters.search}%`);
        }
        if (filters?.categoria && filters.categoria !== 'all') {
          query = query.eq('categoria', filters.categoria);
        }
        const { data, error, count } = await query;

        if (error) {
          console.error('Error fetching cliente inventario:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allItems.push(...data.map((d) => ({
            id: d.id,
            cliente_id: d.cliente_id,
            sku: d.sku,
            nombre: d.nombre,
            descripcion: d.descripcion,
            categoria: d.categoria,
            precio_unitario: d.precio_unitario,
            stock: d.stock_disponible,
            imagen_url: d.imagen_url,
            margen_minimo: d.margen_minimo,
            palabras_clave: d.palabras_clave,
            tiempo_entrega_dias: d.tiempo_entrega,
            created_at: d.created_at,
            updated_at: d.updated_at,
          })));
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      // Get unique categories
      const { data: catData } = await supabaseClient
        .from('cliente_inventario')
        .select('categoria')
        .eq('cliente_id', user.id)
        .not('categoria', 'is', null);

      const categorias = [...new Set((catData || []).map((c: any) => c.categoria).filter(Boolean))];

      return {
        items: allItems as ClienteInventarioItem[],
        total: allItems.length,
        categorias: categorias as string[],
      };
    },
    enabled: !!user?.id && !authLoading,
  });

  // Calculate stats
  const stats = {
    totalProductos: query.data?.total || 0,
    totalCategorias: query.data?.categorias.length || 0,
    valorInventario: query.data?.items.reduce((acc, item) =>
      acc + (item.precio_unitario * (item.stock || 0)), 0) || 0,
    productosActivos: query.data?.total || 0,
  };

  return {
    items: query.data?.items || [],
    categorias: query.data?.categorias || [],
    stats,
    isLoading: query.isLoading || authLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
