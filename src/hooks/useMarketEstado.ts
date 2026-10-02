import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Market de proveedores del Estado. El backend (funciones mk_*) es reciente y
// todavía no está en los tipos generados de Supabase, así que se llama a través
// de un wrapper tipado hasta que se regeneren los types.
type RpcResult<T> = { data: T | null; error: { message: string } | null };
type RpcFn = <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<RpcResult<T>>;
// OJO: `const rpc = supabase.rpc as unknown as RpcFn` y llamar rpc(...)
// directo "desenchufa" el método de su objeto — supabase.rpc usa `this`
// internamente (this.rest) y al perder ese contexto revienta con "Cannot
// read properties of undefined (reading 'rest')" en cualquier búsqueda
// (hallazgo de Evaristo en Market del Estado). Por eso se envuelve en una
// función que sí lo invoca como método de supabase (conserva el `this`).
const rpc = ((fn: string, args?: Record<string, unknown>) => supabase.rpc(fn, args)) as unknown as RpcFn;

export interface MarketProducto {
  producto: string;
  precio_mediana?: number | null;
  precio?: number | null;
  catalogo?: boolean;
}

export interface MarketProveedor {
  rut: string;
  proveedor: string;
  es_firmavb: boolean;
  acepta_solicitudes: boolean;
  cliente_id: string | null;
  productos: MarketProducto[];
  n_oc: number;
  n_organismos: number;
  precio_mediana: number | null;
  ultima_venta: string | null;
  relevancia: number | null;
}

// Busca proveedores que le venden un producto al Estado (OC de los últimos 24 meses).
export function useMarketBuscar(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['mk-buscar', term],
    enabled: term.length >= 3,
    staleTime: 60_000,
    queryFn: async (): Promise<MarketProveedor[]> => {
      const { data, error } = await rpc<MarketProveedor[]>('mk_buscar', { p_q: term, p_limit: 30 });
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({ ...p, productos: p.productos ?? [] }));
    },
  });
}

export interface MarketCotizacion {
  precio?: number | null;
  plazo?: number | null;
  mensaje?: string | null;
  proveedor?: string | null;
  created_at?: string | null;
}

export interface MarketSolicitud {
  id: string;
  rol: string; // 'comprador' = yo la pedí · 'vendedor' = me la pidieron
  contraparte: string | null;
  producto: string | null;
  cantidad: number | null;
  oportunidad_codigo: string | null;
  estado: string | null;
  created_at: string | null;
  cotizaciones: MarketCotizacion[];
}

// Mis solicitudes de cotización (las que envié y las que me pidieron).
export function useMisSolicitudes() {
  return useQuery({
    queryKey: ['mk-mis-solicitudes'],
    staleTime: 30_000,
    queryFn: async (): Promise<MarketSolicitud[]> => {
      const { data, error } = await rpc<MarketSolicitud[]>('mk_mis_solicitudes');
      if (error) throw new Error(error.message);
      return (data ?? []).map((s) => ({ ...s, cotizaciones: s.cotizaciones ?? [] }));
    },
  });
}

export interface SolicitarInput {
  rut_proveedor: string;
  producto: string;
  cantidad?: number | null;
  unidad?: string | null;
  region?: string | null;
  fecha?: string | null;
  oportunidad?: string | null;
  mensaje?: string | null;
}

// Pedir cotización a un proveedor (si está en FirmaVB le llega; si no, queda
// esperándolo para cuando se registre con su RUT).
export function useMarketSolicitar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SolicitarInput) => {
      const { data, error } = await rpc<string>('mk_solicitar', {
        p_rut_proveedor: i.rut_proveedor,
        p_producto: i.producto,
        p_cantidad: i.cantidad ?? null,
        p_unidad: i.unidad ?? null,
        p_region: i.region ?? null,
        p_fecha: i.fecha ?? null,
        p_oportunidad: i.oportunidad ?? null,
        p_mensaje: i.mensaje ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mk-mis-solicitudes'] }),
  });
}

export interface CotizarInput {
  solicitud: string;
  precio: number;
  plazo?: number | null;
  mensaje?: string | null;
}

// Responder una solicitud con precio y plazo.
export function useMarketCotizar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: CotizarInput) => {
      const { data, error } = await rpc<string>('mk_cotizar', {
        p_solicitud: i.solicitud,
        p_precio: i.precio,
        p_plazo: i.plazo ?? null,
        p_mensaje: i.mensaje ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mk-mis-solicitudes'] }),
  });
}
