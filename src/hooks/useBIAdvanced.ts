import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface BINegocioInstitucion {
  institucion_nombre: string;
  institucion_rut?: string;
  total_ordenes: number;
  monto_total: number;
  promedio_orden: number;
  ultima_orden?: string;
  proveedores_distintos: number;
}

export interface BINegocioProveedor {
  proveedor_nombre: string;
  proveedor_rut?: string;
  total_ordenes: number;
  monto_total: number;
  promedio_orden: number;
  ultima_orden?: string;
  instituciones_distintas: number;
}

export interface BIProducto {
  nombre_producto: string;
  categoria?: string;
  total_ventas: number;
  cantidad_total: number;
  monto_total: number;
  precio_promedio: number;
  precio_minimo: number;
  precio_maximo: number;
}

export interface BIPrecioProductoProveedor {
  nombre_producto: string;
  proveedor_nombre: string;
  proveedor_rut?: string;
  veces_vendido: number;
  precio_promedio: number;
  precio_minimo: number;
  precio_maximo: number;
  ultima_venta?: string;
}

export interface DashboardEstado {
  total_licitaciones: number;
  con_match: number;
  urgentes: number;
  total_ofertas: number;
  ofertas_enviadas: number;
  ofertas_ganadas: number;
  monto_ganado: number;
  total_ordenes: number;
  monto_ordenes: number;
}

// Hook: Negocios por institución
export function useBINegociosPorInstitucion(limit: number = 20) {
  return useQuery({
    queryKey: ['bi-negocios-institucion', limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bi_oc_negocios_por_institucion')
        .select('*')
        .limit(limit);
      
      if (error) throw error;
      return data as BINegocioInstitucion[];
    },
  });
}

// Hook: Negocios por proveedor
export function useBINegociosPorProveedor(limit: number = 20) {
  return useQuery({
    queryKey: ['bi-negocios-proveedor', limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bi_oc_negocios_por_proveedor')
        .select('*')
        .limit(limit);
      
      if (error) throw error;
      return data as BINegocioProveedor[];
    },
  });
}

// Hook: Productos más vendidos
export function useBIProductos(limit: number = 50) {
  return useQuery({
    queryKey: ['bi-productos', limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bi_oc_productos')
        .select('*')
        .limit(limit);
      
      if (error) throw error;
      return data as BIProducto[];
    },
  });
}

// Hook: Precios por producto y proveedor
export function useBIPreciosProductoProveedor(productoNombre?: string, limit: number = 50) {
  return useQuery({
    queryKey: ['bi-precios-producto-proveedor', productoNombre, limit],
    queryFn: async () => {
      let query = (supabase as any)
        .from('bi_oc_precios_producto_proveedor')
        .select('*')
        .limit(limit);

      if (productoNombre) {
        query = query.ilike('nombre_producto', `%${productoNombre}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BIPrecioProductoProveedor[];
    },
  });
}

// Hook: Dashboard estado general
export function useDashboardEstado() {
  return useQuery({
    queryKey: ['dashboard-estado'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dashboard_estado')
        .select('*')
        .single();
      
      if (error) throw error;
      return data as DashboardEstado;
    },
  });
}

// Hook: Licitaciones con match
export function useLicitacionesConMatch(limit: number = 50) {
  return useQuery({
    queryKey: ['licitaciones-con-match', limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('licitaciones_con_match')
        .select('*')
        .limit(limit);
      
      if (error) throw error;
      return data;
    },
  });
}

// Hook: Licitaciones urgentes
export function useLicitacionesUrgentes() {
  return useQuery({
    queryKey: ['licitaciones-urgentes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('licitaciones_urgentes')
        .select('*');
      
      if (error) throw error;
      return data;
    },
  });
}

// Hook: Tendencia de ventas mensual
export function useTendenciaVentasMensual() {
  return useQuery({
    queryKey: ['tendencia-ventas-mensual'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ordenes_compra')
        .select('fecha_creacion, total')
        .order('fecha_creacion', { ascending: true });
      
      if (error) throw error;

      // Agrupar por mes
      const porMes: Record<string, { mes: string; total: number; cantidad: number }> = {};
      
      data?.forEach((oc: any) => {
        if (oc.fecha_creacion) {
          const fecha = new Date(oc.fecha_creacion);
          const mes = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
          
          if (!porMes[mes]) {
            porMes[mes] = { mes, total: 0, cantidad: 0 };
          }
          porMes[mes].total += oc.total || 0;
          porMes[mes].cantidad += 1;
        }
      });

      return Object.values(porMes).slice(-12); // Últimos 12 meses
    },
  });
}

// Hook: Top categorías
export function useTopCategorias(limit: number = 10) {
  return useQuery({
    queryKey: ['top-categorias', limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ordenes_compra_items')
        .select('categoria');
      
      if (error) throw error;

      // Contar por categoría
      const conteo: Record<string, number> = {};
      data?.forEach((item: any) => {
        const cat = item.categoria || 'Sin categoría';
        conteo[cat] = (conteo[cat] || 0) + 1;
      });

      return Object.entries(conteo)
        .map(([categoria, cantidad]) => ({ categoria, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, limit);
    },
  });
}

// Hook: Comparativa de precios
export function useComparativaPrecios(productoNombre: string) {
  return useQuery({
    queryKey: ['comparativa-precios', productoNombre],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('bi_oc_precios_producto_proveedor')
        .select('*')
        .ilike('nombre_producto', `%${productoNombre}%`)
        .order('precio_promedio', { ascending: true });
      
      if (error) throw error;
      return data as BIPrecioProductoProveedor[];
    },
    enabled: !!productoNombre,
  });
}
