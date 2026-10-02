import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  /** Tiene catálogo propio cargado en FirmaVB (no solo cuenta): mk_buscar no
   *  devuelve esto como columna aparte (agregarla requería un DROP FUNCTION
   *  que quedaba colgado al aplicarlo — ver la migración), así que se deriva
   *  de `productos`: solo los del propio inventario traen `catalogo: true`. */
  tiene_inventario: boolean;
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
      return (data ?? []).map((p) => {
        const productos = p.productos ?? [];
        return { ...p, productos, tiene_inventario: productos.some((x) => x.catalogo) };
      });
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

// ── Chat por solicitud (mk_mensajes) ──────────────────────────────
// Tabla reciente, aún no está en los tipos generados de Supabase.
const sb = supabase as unknown as { from: (t: string) => any };

export interface MarketMensaje {
  id: string;
  solicitud_id: string;
  autor_id: string;
  mensaje: string;
  created_at: string;
}

// Mensajes de una solicitud, en vivo: la RLS de mk_mensajes ya acota a
// quienes participan en esa solicitud (solicitante o proveedor), así que
// basta un filtro por solicitud_id, sin el escenario de doble-fila-cliente
// que sí aplica a la campanita (useAvisos).
export function useMkMensajes(solicitudId: string | null) {
  const qc = useQueryClient();
  const instanceId = useId();
  const queryKey = ['mk-mensajes', solicitudId];

  const query = useQuery({
    queryKey,
    enabled: !!solicitudId,
    staleTime: 10_000,
    queryFn: async (): Promise<MarketMensaje[]> => {
      const { data, error } = await sb
        .from('mk_mensajes')
        .select('id, solicitud_id, autor_id, mensaje, created_at')
        .eq('solicitud_id', solicitudId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarketMensaje[];
    },
  });

  useEffect(() => {
    if (!solicitudId) return;
    const channel = supabase
      .channel(`mk-mensajes-${solicitudId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mk_mensajes', filter: `solicitud_id=eq.${solicitudId}` },
        () => qc.invalidateQueries({ queryKey }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId, instanceId]);

  return query;
}

// Mandar un mensaje en una solicitud. La RLS exige ser el autor Y
// participar en esa solicitud (solicitante o proveedor) — mismo chequeo que
// ya hace mk_mis_solicitudes/mk_cotizar para sus respectivas tablas.
export function useMkEnviarMensaje(solicitudId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mensaje: string) => {
      if (!solicitudId) throw new Error('Falta la solicitud');
      const texto = mensaje.trim();
      if (!texto) throw new Error('Escribe un mensaje');
      const { data: owner, error: errOwner } = await supabase.rpc('cliente_owner_id');
      if (errOwner) throw errOwner;
      if (!owner) throw new Error('Debes iniciar sesión como cliente FirmaVB');
      const { error } = await sb
        .from('mk_mensajes')
        .insert({ solicitud_id: solicitudId, autor_id: owner, mensaje: texto });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mk-mensajes', solicitudId] }),
  });
}

// RUT/id del cliente dueño de la sesión (mismo RPC y misma queryKey que ya
// usa useAvisos.ts, para compartir caché): lo necesita el chat para saber
// qué mensajes son "míos" — mk_mensajes.autor_id es un clientes.id, no el
// user_id de auth, así que no sirve comparar contra user.id directo.
export function useClienteOwnerId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cliente-owner-id', user?.id],
    enabled: !!user?.id,
    refetchInterval: (query) => (query.state.data ? 5 * 60_000 : 15_000),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('cliente_owner_id');
      if (error) throw error;
      return (data as string | null) ?? null;
    },
  });
}
