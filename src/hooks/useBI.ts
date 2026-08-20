import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BIStats {
  proveedores: number;
  compradores: number;
  monto_total: number;
  ordenes: number;
}

export interface BIProveedor {
  proveedor: string;
  ordenes: number;
  monto_total: number;
  compradores: number;
  share: number | null;
  ultima: string | null;
}

export interface BIComprador {
  comprador: string;
  ordenes: number;
  monto_total: number;
  proveedores: number;
  share: number | null;
  ultima: string | null;
}

export interface BIProductoLinea {
  producto: string;
  lineas: number;
  monto: number;
  precio_prom: number | null;
}
export interface BIActorLinea {
  proveedor?: string;
  comprador?: string;
  ordenes: number;
  monto: number;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(fn, args);
  if (error) throw error;
  return data as T;
}

// ---- Período de los reportes ----
export type PeriodoPreset = "total" | "mes" | "trimestre" | "ano" | "12m";
export interface RangoPeriodo { desde: string; hasta: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Convierte un preset en un rango {desde,hasta}. "total" => null (histórico). */
export function rangoDePreset(p: PeriodoPreset): RangoPeriodo | null {
  if (p === "total") return null;
  const hoy = new Date();
  let desde: Date;
  if (p === "mes") desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  else if (p === "trimestre") desde = new Date(hoy.getFullYear(), hoy.getMonth() - 3, hoy.getDate());
  else if (p === "ano") desde = new Date(hoy.getFullYear(), 0, 1);
  else desde = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate()); // 12m
  return { desde: iso(desde), hasta: iso(hoy) };
}

export function useBIStats(periodo?: RangoPeriodo | null) {
  return useQuery({
    queryKey: ["bi-stats", periodo?.desde ?? null, periodo?.hasta ?? null],
    queryFn: () =>
      periodo
        ? rpc<BIStats>("bi_stats_rango", { p_desde: periodo.desde, p_hasta: periodo.hasta })
        : rpc<BIStats>("bi_stats", {}),
    staleTime: 5 * 60_000,
  });
}

export function useTopProveedores(termino = "", limite = 60, periodo?: RangoPeriodo | null) {
  return useQuery({
    queryKey: ["bi-top-proveedores", termino, limite, periodo?.desde ?? null, periodo?.hasta ?? null],
    queryFn: () =>
      periodo
        ? rpc<{ total: number; total_mercado: number; items: BIProveedor[] }>(
            "bi_top_proveedores_rango", { termino, limite, p_desde: periodo.desde, p_hasta: periodo.hasta })
        : rpc<{ total: number; total_mercado: number; items: BIProveedor[] }>(
            "bi_top_proveedores", { termino, limite }),
    staleTime: 60_000,
  });
}

export function useTopCompradores(termino = "", limite = 60, periodo?: RangoPeriodo | null) {
  return useQuery({
    queryKey: ["bi-top-compradores", termino, limite, periodo?.desde ?? null, periodo?.hasta ?? null],
    queryFn: () =>
      periodo
        ? rpc<{ total: number; total_mercado: number; items: BIComprador[] }>(
            "bi_top_compradores_rango", { termino, limite, p_desde: periodo.desde, p_hasta: periodo.hasta })
        : rpc<{ total: number; total_mercado: number; items: BIComprador[] }>(
            "bi_top_compradores", { termino, limite }),
    staleTime: 60_000,
  });
}

export function useProveedorDetalle(nombre: string | null) {
  return useQuery({
    queryKey: ["bi-proveedor-detalle", nombre],
    enabled: !!nombre,
    queryFn: () => rpc<{ productos: BIProductoLinea[]; compradores: BIActorLinea[] }>(
      "bi_proveedor_detalle", { p_nombre: nombre, limite: 12 }),
    staleTime: 60_000,
  });
}

export function useCompradorDetalle(nombre: string | null) {
  return useQuery({
    queryKey: ["bi-comprador-detalle", nombre],
    enabled: !!nombre,
    queryFn: () => rpc<{ productos: BIProductoLinea[]; proveedores: BIActorLinea[] }>(
      "bi_comprador_detalle", { p_nombre: nombre, limite: 12 }),
    staleTime: 60_000,
  });
}
