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

export interface CMStats {
  productos: number;
  monto_total: number;
  proveedores: number;
  compradores: number;
}

// Totales del módulo por origen (para el header).
export function useCMStats(tipo: TipoOrigenCM = 'convenio_marco') {
  return useQuery({
    queryKey: ['cm-stats', tipo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cm_stats', { p_tipo: tipo });
      if (error) throw error;
      return (data ?? { productos: 0, monto_total: 0, proveedores: 0, compradores: 0 }) as unknown as CMStats;
    },
    staleTime: 5 * 60_000,
  });
}

// Búsqueda de productos (lee la MV pre-agregada vía RPC; muy rápida).
export function useCMProductos(termino: string, tipo: TipoOrigenCM = 'convenio_marco') {
  return useQuery({
    queryKey: ['cm-productos', termino, tipo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cm_buscar_productos', {
        termino: termino ?? '',
        p_tipo: tipo,
        limite: 60,
        desplazamiento: 0,
      });
      if (error) throw error;
      return (data ?? { total: 0, items: [] }) as unknown as { total: number; items: CMProducto[] };
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
      const { data, error } = await supabase.rpc('cm_producto_detalle', {
        p_producto_key: productoKey,
        p_tipo: tipo,
      });
      if (error) throw error;
      return (data ?? { resumen: null, proveedores: [], compradores: [] }) as unknown as CMDetalle;
    },
    staleTime: 60_000,
  });
}

export interface CMCompetitividad {
  mi_producto: string;
  mi_precio: number;
  producto_cm: string;
  producto_key: string;
  precio_ganador: number | null;
  precio_prom: number | null;
  proveedores: number;
  similitud: number;
  diff_pct: number | null;
}

// Cruza el inventario del cliente con el mercado (match por nombre) y devuelve
// su posición de precio vs. el ganador.
export function useMiCompetitividad(tipo: TipoOrigenCM = 'convenio_marco', enabled = true) {
  return useQuery({
    queryKey: ['cm-mi-competitividad', tipo],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cm_mi_competitividad', { p_tipo: tipo, umbral: 0.6 });
      if (error) throw error;
      return (data ?? []) as unknown as CMCompetitividad[];
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
      const { data, error } = await supabase.rpc('cm_producto_tendencia', {
        p_producto_key: productoKey,
        p_tipo: tipo,
      });
      if (error) throw error;
      return (data ?? []) as unknown as CMTendenciaPunto[];
    },
    staleTime: 60_000,
  });
}

// ---- Por convenio (clasificación por nombre de producto; ver migración 20260925070000) ----
// Las RPC nuevas aún no están en types.ts (patrón del repo: (supabase as any).rpc).
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface CMConvenioFila { convenio: string; ocs: number; monto_total: number; proveedores: number | null; organismos: number | null; participacion: number | null }
export interface CMConvenioMes { mes: string; ocs: number; monto_total: number }
export interface CMConvenioTop { tipo: 'proveedor' | 'comprador'; nombre: string | null; rut: string | null; ocs: number; monto_total: number }

export function useCMPorConvenio(anio: number) {
  return useQuery({
    queryKey: ['cm-por-convenio', anio],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('cm_por_convenio', { p_anio: anio });
      if (error) throw error;
      return (data || []) as CMConvenioFila[];
    },
  });
}

export function useCMConvenioDetalle(convenio: string | null, anio: number) {
  return useQuery({
    queryKey: ['cm-convenio-detalle', convenio, anio],
    enabled: !!convenio,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [m, t] = await Promise.all([
        (supabase as any).rpc('cm_convenio_meses', { p_convenio: convenio, p_anio: anio }),
        (supabase as any).rpc('cm_convenio_top', { p_convenio: convenio, p_anio: anio, p_limite: 10 }),
      ]);
      if (m.error) throw m.error;
      if (t.error) throw t.error;
      return { meses: (m.data || []) as CMConvenioMes[], top: (t.data || []) as CMConvenioTop[] };
    },
  });
}
