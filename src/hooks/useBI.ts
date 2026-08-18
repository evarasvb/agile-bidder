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

export function useBIStats() {
  return useQuery({
    queryKey: ["bi-stats"],
    queryFn: () => rpc<BIStats>("bi_stats", {}),
    staleTime: 5 * 60_000,
  });
}

export function useTopProveedores(termino = "", limite = 60) {
  return useQuery({
    queryKey: ["bi-top-proveedores", termino, limite],
    queryFn: () => rpc<{ total: number; total_mercado: number; items: BIProveedor[] }>(
      "bi_top_proveedores", { termino, limite }),
    staleTime: 60_000,
  });
}

export function useTopCompradores(termino = "", limite = 60) {
  return useQuery({
    queryKey: ["bi-top-compradores", termino, limite],
    queryFn: () => rpc<{ total: number; total_mercado: number; items: BIComprador[] }>(
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
