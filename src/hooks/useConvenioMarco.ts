import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TipoOrigenCM = 'convenio_marco' | 'compra_agil' | 'trato_directo' | 'licitacion' | null;

export interface CMProducto {
  producto_key: string;
  producto: string;
  codigo_producto: string | null;
  proveedores: number;
  compradores: number;
  monto_total: number;
  precio_min: number | null;
  precio_prom: number | null;
  precio_max: number | null;
  ultima_compra: string | null;
}

export interface CMProveedor {
  proveedor: string;
  lineas: number;
  monto_total: number;
  precio_min: number | null;
  precio_prom: number | null;
  precio_max: number | null;
}

export interface CMComprador {
  comprador: string;
  lineas: number;
  monto_total: number;
  precio_prom: number | null;
}

export interface CMDetalle {
  resumen: CMProducto | null;
  proveedores: CMProveedor[];
  compradores: CMComprador[];
}

export interface CMTendenciaPunto {
  mes: string;
  ordenes: number;
  monto_total: number;
  precio_prom: number;
  precio_min: number | null;
  precio_max: number | null;
}

// Búsqueda de productos (lee la MV pre-agregada vía RPC; muy rápida).
export function useCMProductos(termino: string, tipo: TipoOrigenCM = 'convenio_marco') {
  return useQuery({
    queryKey: ['cm-productos', termino, tipo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('cm_buscar_productos', {
        termino: termino ?? '',
        p_tipo: tipo,
        limite: 60,
        desplazamiento: 0,
      });
      if (error) throw error;
      return (data ?? { total: 0, items: [] }) as { total: number; items: CMProducto[] };
    },
    staleTime: 60_000,
  });
}

// Detalle de un producto: resumen + competidores + compradores.
export function useCMProductoDetalle(productoKey: string | null, tipo: TipoOrigenCM = 'convenio_marco') {
  return useQuery({
    queryKey: ['cm-detalle', productoKey, tipo],
    enabled: !!productoKey,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('cm_producto_detalle', {
        p_producto_key: productoKey,
        p_tipo: tipo,
      });
      if (error) throw error;
      return (data ?? { resumen: null, proveedores: [], compradores: [] }) as CMDetalle;
    },
    staleTime: 60_000,
  });
}

// Tendencia de precio en el tiempo (serie mensual).
export function useCMProductoTendencia(productoKey: string | null, tipo: TipoOrigenCM = 'convenio_marco') {
  return useQuery({
    queryKey: ['cm-tendencia', productoKey, tipo],
    enabled: !!productoKey,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('cm_producto_tendencia', {
        p_producto_key: productoKey,
        p_tipo: tipo,
      });
      if (error) throw error;
      return (data ?? []) as CMTendenciaPunto[];
    },
    staleTime: 60_000,
  });
}
