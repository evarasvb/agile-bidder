import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface BINegocioInstitucion {
  demandante: string;
  cantidad_ordenes: number;
  cantidad_proveedores: number;
  monto_total: number;
  tipo_origen: string;
}

export interface BINegocioProveedor {
  proveedor: string;
  cantidad_ordenes: number;
  cantidad_instituciones: number;
  monto_total: number;
  tipo_origen: string;
}

export interface BIProducto {
  producto: string;
  codigo_producto: string;
  instituciones: number;
  lineas: number;
  proveedores: number;
  precio_unitario_min: number;
  precio_unitario_max: number;
  precio_unitario_prom: number;
  monto_total: number;
  tipo_origen: string;
}

export interface BIPrecioProductoProveedor {
  producto: string;
  proveedor: string;
  codigo_producto: string;
  muestras: number;
  precio_min: number;
  precio_max: number;
  precio_prom: number;
  tipo_origen: string;
}

export interface DashboardEstado {
  total_licitaciones: number;
  con_match: number;
  monto_con_match: number;
  monto_total_oportunidades: number;
  ofertas_enviadas: number;
  procesadas: number;
}

// Hook: Negocios por institución
export function useBINegociosPorInstitucion(limit: number = 20) {
  return useQuery({
    queryKey: ['bi-negocios-institucion', limit],
    queryFn: async () => {
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      let query = supabase
        .from('bi_oc_precios_producto_proveedor')
        .select('*')
        .limit(limit);

      if (productoNombre) {
        query = query.ilike('producto', `%${productoNombre}%`);
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
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
      const { data, error } = await supabase
        .from('bi_oc_precios_producto_proveedor')
        .select('*')
        .ilike('producto', `%${productoNombre}%`)
        .order('precio_prom', { ascending: true });
      
      if (error) throw error;
      return data as BIPrecioProductoProveedor[];
    },
    enabled: !!productoNombre,
  });
}
