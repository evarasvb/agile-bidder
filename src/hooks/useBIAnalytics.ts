import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BIFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  proveedorRut?: string;
  proveedorNombre?: string;
  institucionRut?: string;
  institucionNombre?: string;
  producto?: string;
  mes?: number;
  anio?: number;
}

export interface ProveedorStats {
  rut: string;
  nombre: string;
  total_ordenes: number;
  monto_total: number;
  promedio_orden: number;
}

export interface InstitucionStats {
  rut: string;
  nombre: string;
  total_ordenes: number;
  monto_total: number;
  promedio_orden: number;
}

export interface ProductoStats {
  nombre: string;
  categoria: string;
  cantidad_total: number;
  precio_promedio: number;
  precio_min: number;
  precio_max: number;
  total_neto: number;
  ocurrencias: number;
}

export interface TendenciaMensual {
  mes: string;
  anio: number;
  total_ordenes: number;
  monto_total: number;
  promedio: number;
}

export interface PrecioHistorico {
  fecha: string;
  proveedor_nombre: string;
  proveedor_rut: string;
  precio_unitario: number;
  cantidad: number;
  total: number;
  orden_codigo: string;
}

export interface SugerenciaPrecio {
  precioMinimo: number;
  precioMaximo: number;
  precioPromedio: number;
  precioSugerido: number;
  precioGanador: number;
  margenSugerido: number;
  competidores: {
    nombre: string;
    rut: string;
    precioPromedio: number;
    vecesGanador: number;
  }[];
}

// Hook para obtener estadísticas de proveedores
export function useProveedorStats(filters: BIFilters) {
  return useQuery({
    queryKey: ['bi-proveedores-stats', filters],
    queryFn: async (): Promise<ProveedorStats[]> => {
      let query = supabase
        .from('ordenes_compra')
        .select('proveedor_rut, proveedor_nombre, total');

      if (filters.fechaDesde) {
        query = query.gte('fecha_envio', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_envio', filters.fechaHasta);
      }
      if (filters.institucionRut) {
        query = query.eq('institucion_rut', filters.institucionRut);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por proveedor
      const proveedoresMap = new Map<string, ProveedorStats>();
      data?.forEach(orden => {
        const key = orden.proveedor_rut || 'sin-rut';
        if (proveedoresMap.has(key)) {
          const prov = proveedoresMap.get(key)!;
          prov.total_ordenes++;
          prov.monto_total += orden.total || 0;
        } else {
          proveedoresMap.set(key, {
            rut: orden.proveedor_rut || '',
            nombre: orden.proveedor_nombre || 'Sin nombre',
            total_ordenes: 1,
            monto_total: orden.total || 0,
            promedio_orden: 0
          });
        }
      });

      return Array.from(proveedoresMap.values())
        .map(p => ({ ...p, promedio_orden: p.monto_total / p.total_ordenes }))
        .sort((a, b) => b.monto_total - a.monto_total);
    }
  });
}

// Hook para obtener estadísticas de instituciones
export function useInstitucionStats(filters: BIFilters) {
  return useQuery({
    queryKey: ['bi-instituciones-stats', filters],
    queryFn: async (): Promise<InstitucionStats[]> => {
      let query = supabase
        .from('ordenes_compra')
        .select('institucion_rut, institucion_nombre, total');

      if (filters.fechaDesde) {
        query = query.gte('fecha_envio', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_envio', filters.fechaHasta);
      }
      if (filters.proveedorRut) {
        query = query.eq('proveedor_rut', filters.proveedorRut);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por institución
      const institucionesMap = new Map<string, InstitucionStats>();
      data?.forEach(orden => {
        const key = orden.institucion_rut || 'sin-rut';
        if (institucionesMap.has(key)) {
          const inst = institucionesMap.get(key)!;
          inst.total_ordenes++;
          inst.monto_total += orden.total || 0;
        } else {
          institucionesMap.set(key, {
            rut: orden.institucion_rut || '',
            nombre: orden.institucion_nombre || 'Sin nombre',
            total_ordenes: 1,
            monto_total: orden.total || 0,
            promedio_orden: 0
          });
        }
      });

      return Array.from(institucionesMap.values())
        .map(i => ({ ...i, promedio_orden: i.monto_total / i.total_ordenes }))
        .sort((a, b) => b.monto_total - a.monto_total);
    }
  });
}

// Hook para obtener estadísticas de productos
export function useProductoStats(filters: BIFilters) {
  return useQuery({
    queryKey: ['bi-productos-stats', filters],
    queryFn: async (): Promise<ProductoStats[]> => {
      // Primero obtener los items con sus órdenes
      let query = supabase
        .from('ordenes_compra_items')
        .select(`
          nombre_producto,
          categoria,
          cantidad,
          precio_unitario_neto,
          total_neto,
          ordenes_compra!inner (
            fecha_envio,
            proveedor_rut,
            institucion_rut
          )
        `);

      if (filters.producto) {
        query = query.ilike('nombre_producto', `%${filters.producto}%`);
      }

      const { data, error } = await query.limit(1000);
      if (error) throw error;

      // Agrupar por producto
      const productosMap = new Map<string, ProductoStats>();
      data?.forEach((item: any) => {
        // Filtrar por fechas si están definidas
        const fechaEnvio = item.ordenes_compra?.fecha_envio;
        if (filters.fechaDesde && fechaEnvio < filters.fechaDesde) return;
        if (filters.fechaHasta && fechaEnvio > filters.fechaHasta) return;
        if (filters.proveedorRut && item.ordenes_compra?.proveedor_rut !== filters.proveedorRut) return;
        if (filters.institucionRut && item.ordenes_compra?.institucion_rut !== filters.institucionRut) return;

        const key = item.nombre_producto?.toLowerCase().trim() || 'sin-nombre';
        const precio = item.precio_unitario_neto || 0;
        
        if (productosMap.has(key)) {
          const prod = productosMap.get(key)!;
          prod.ocurrencias++;
          prod.cantidad_total += item.cantidad || 0;
          prod.total_neto += item.total_neto || 0;
          prod.precio_min = Math.min(prod.precio_min, precio);
          prod.precio_max = Math.max(prod.precio_max, precio);
        } else {
          productosMap.set(key, {
            nombre: item.nombre_producto || 'Sin nombre',
            categoria: item.categoria || 'Sin categoría',
            cantidad_total: item.cantidad || 0,
            precio_promedio: 0,
            precio_min: precio,
            precio_max: precio,
            total_neto: item.total_neto || 0,
            ocurrencias: 1
          });
        }
      });

      return Array.from(productosMap.values())
        .map(p => ({ 
          ...p, 
          precio_promedio: p.cantidad_total > 0 ? p.total_neto / p.cantidad_total : 0 
        }))
        .sort((a, b) => b.ocurrencias - a.ocurrencias);
    }
  });
}

// Hook para obtener tendencias mensuales
export function useTendenciaMensual(filters: BIFilters) {
  return useQuery({
    queryKey: ['bi-tendencia-mensual', filters],
    queryFn: async (): Promise<TendenciaMensual[]> => {
      let query = supabase
        .from('ordenes_compra')
        .select('fecha_envio, total');

      if (filters.fechaDesde) {
        query = query.gte('fecha_envio', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_envio', filters.fechaHasta);
      }
      if (filters.proveedorRut) {
        query = query.eq('proveedor_rut', filters.proveedorRut);
      }
      if (filters.institucionRut) {
        query = query.eq('institucion_rut', filters.institucionRut);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Agrupar por mes
      const mesesMap = new Map<string, TendenciaMensual>();
      data?.forEach(orden => {
        if (!orden.fecha_envio) return;
        const fecha = new Date(orden.fecha_envio);
        const mes = fecha.toLocaleDateString('es-CL', { month: 'short' });
        const anio = fecha.getFullYear();
        const key = `${anio}-${fecha.getMonth()}`;
        
        if (mesesMap.has(key)) {
          const m = mesesMap.get(key)!;
          m.total_ordenes++;
          m.monto_total += orden.total || 0;
        } else {
          mesesMap.set(key, {
            mes,
            anio,
            total_ordenes: 1,
            monto_total: orden.total || 0,
            promedio: 0
          });
        }
      });

      return Array.from(mesesMap.values())
        .map(m => ({ ...m, promedio: m.monto_total / m.total_ordenes }))
        .sort((a, b) => {
          if (a.anio !== b.anio) return a.anio - b.anio;
          return new Date(`${a.mes} 1, ${a.anio}`).getTime() - new Date(`${b.mes} 1, ${b.anio}`).getTime();
        });
    }
  });
}

// Hook para historial de precios de un producto específico
export function usePrecioHistorico(productoNombre: string | null, filters: BIFilters) {
  return useQuery({
    queryKey: ['bi-precio-historico', productoNombre, filters],
    queryFn: async (): Promise<PrecioHistorico[]> => {
      if (!productoNombre) return [];

      const { data, error } = await supabase
        .from('ordenes_compra_items')
        .select(`
          nombre_producto,
          cantidad,
          precio_unitario_neto,
          total_neto,
          ordenes_compra!inner (
            codigo,
            fecha_envio,
            proveedor_nombre,
            proveedor_rut
          )
        `)
        .ilike('nombre_producto', `%${productoNombre}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return (data || []).map((item: any) => ({
        fecha: item.ordenes_compra?.fecha_envio || '',
        proveedor_nombre: item.ordenes_compra?.proveedor_nombre || '',
        proveedor_rut: item.ordenes_compra?.proveedor_rut || '',
        precio_unitario: item.precio_unitario_neto || 0,
        cantidad: item.cantidad || 0,
        total: item.total_neto || 0,
        orden_codigo: item.ordenes_compra?.codigo || ''
      })).filter((p: PrecioHistorico) => {
        if (filters.fechaDesde && p.fecha < filters.fechaDesde) return false;
        if (filters.fechaHasta && p.fecha > filters.fechaHasta) return false;
        return true;
      });
    },
    enabled: !!productoNombre
  });
}

// Hook para generar sugerencia de precio ganador
export function useSugerenciaPrecio(productoNombre: string | null) {
  return useQuery({
    queryKey: ['bi-sugerencia-precio', productoNombre],
    queryFn: async (): Promise<SugerenciaPrecio | null> => {
      if (!productoNombre) return null;

      const { data, error } = await supabase
        .from('ordenes_compra_items')
        .select(`
          precio_unitario_neto,
          cantidad,
          total_neto,
          ordenes_compra!inner (
            proveedor_nombre,
            proveedor_rut,
            estado
          )
        `)
        .ilike('nombre_producto', `%${productoNombre}%`)
        .limit(500);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      // Calcular estadísticas de precios
      const precios = data.map((item: any) => item.precio_unitario_neto).filter((p: number) => p > 0);
      if (precios.length === 0) return null;

      const precioMinimo = Math.min(...precios);
      const precioMaximo = Math.max(...precios);
      const precioPromedio = precios.reduce((a: number, b: number) => a + b, 0) / precios.length;

      // Analizar competidores
      const competidoresMap = new Map<string, { 
        nombre: string; 
        rut: string; 
        precios: number[]; 
        vecesGanador: number 
      }>();

      data.forEach((item: any) => {
        const rut = item.ordenes_compra?.proveedor_rut || 'sin-rut';
        if (competidoresMap.has(rut)) {
          const comp = competidoresMap.get(rut)!;
          comp.precios.push(item.precio_unitario_neto || 0);
          if (item.ordenes_compra?.estado === 'Aceptada') {
            comp.vecesGanador++;
          }
        } else {
          competidoresMap.set(rut, {
            nombre: item.ordenes_compra?.proveedor_nombre || '',
            rut,
            precios: [item.precio_unitario_neto || 0],
            vecesGanador: item.ordenes_compra?.estado === 'Aceptada' ? 1 : 0
          });
        }
      });

      const competidores = Array.from(competidoresMap.values())
        .map(c => ({
          nombre: c.nombre,
          rut: c.rut,
          precioPromedio: c.precios.reduce((a, b) => a + b, 0) / c.precios.length,
          vecesGanador: c.vecesGanador
        }))
        .sort((a, b) => b.vecesGanador - a.vecesGanador)
        .slice(0, 10);

      // Precio ganador: percentil 25 (competitivo pero no el más bajo)
      const preciosOrdenados = [...precios].sort((a, b) => a - b);
      const idx25 = Math.floor(preciosOrdenados.length * 0.25);
      const precioGanador = preciosOrdenados[idx25];

      // Precio sugerido: ligeramente por debajo del promedio
      const precioSugerido = precioPromedio * 0.95;

      return {
        precioMinimo,
        precioMaximo,
        precioPromedio,
        precioSugerido,
        precioGanador,
        margenSugerido: ((precioPromedio - precioGanador) / precioPromedio) * 100,
        competidores
      };
    },
    enabled: !!productoNombre
  });
}

// Hook para búsqueda de proveedores
export function useBuscarProveedores(search: string) {
  return useQuery({
    queryKey: ['bi-buscar-proveedores', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      
      const { data, error } = await supabase
        .from('proveedores')
        .select('rut, nombre')
        .or(`nombre.ilike.%${search}%,rut.ilike.%${search}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2
  });
}

// Hook para búsqueda de instituciones
export function useBuscarInstituciones(search: string) {
  return useQuery({
    queryKey: ['bi-buscar-instituciones', search],
    queryFn: async () => {
      if (!search || search.length < 2) return [];
      
      const { data, error } = await supabase
        .from('instituciones')
        .select('rut, nombre')
        .or(`nombre.ilike.%${search}%,rut.ilike.%${search}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2
  });
}

// Hook para KPIs generales
export function useBIKPIs(filters: BIFilters) {
  return useQuery({
    queryKey: ['bi-kpis', filters],
    queryFn: async () => {
      let query = supabase.from('ordenes_compra').select('total, proveedor_rut');

      if (filters.fechaDesde) {
        query = query.gte('fecha_envio', filters.fechaDesde);
      }
      if (filters.fechaHasta) {
        query = query.lte('fecha_envio', filters.fechaHasta);
      }
      if (filters.proveedorRut) {
        query = query.eq('proveedor_rut', filters.proveedorRut);
      }
      if (filters.institucionRut) {
        query = query.eq('institucion_rut', filters.institucionRut);
      }

      const { data, error } = await query;
      if (error) throw error;

      const totalOrdenes = data?.length || 0;
      const montoTotal = data?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const proveedoresUnicos = new Set(data?.map(o => o.proveedor_rut)).size;
      const promedioOrden = totalOrdenes > 0 ? montoTotal / totalOrdenes : 0;

      return {
        totalOrdenes,
        montoTotal,
        proveedoresUnicos,
        promedioOrden
      };
    }
  });
}
