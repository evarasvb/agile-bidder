import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// Órdenes de Compra (mercado) — mapeo al esquema REAL de la BD.
// -----------------------------------------------------------------------------
// La tabla `ordenes_compra` viene del scraper y sus columnas son:
//   codigo, nombre, estado, fecha_emision, fecha_envio_oc, monto_total, neto,
//   total, proveedor_nombre, proveedor, rut_proveedor, organismo_comprador,
//   demandante, rut_demandante, numero_oc, numero_licitacion, ...
// Los ítems (`ordenes_compra_items`) enlazan por `numero_oc` (== codigo), con
// columnas: producto, precio_unitario, valor_total, cantidad, unidad, ...
//
// El hook anterior consultaba columnas que NO existen (fecha_creacion,
// institucion_nombre, total_neto, orden_compra_id...). El `.order('fecha_creacion')`
// hacía que PostgREST devolviera error => la página "no traía las OC". Aquí se
// mapea el esquema real a la interfaz `OrdenCompra` que ya usa la página, así
// que la UI no cambia.
// =============================================================================

// La interfaz pública se mantiene (la consume OrdenesCompra.tsx y los PDFs).
export interface OrdenCompra {
  id: string;
  codigo: string;
  nombre: string | null;
  descripcion: string | null;
  institucion_nombre: string | null;
  institucion_rut: string | null;
  proveedor_nombre: string | null;
  proveedor_rut: string | null;
  total_neto: number | null;
  total: number | null;
  fecha_creacion: string | null;
  fecha_envio: string | null;
  fecha_aceptacion: string | null;
  estado: string | null;
  tipo: string | null;
  created_at: string;
  updated_at: string;
  items?: OrdenCompraItem[];
}

export interface OrdenCompraItem {
  id: string;
  orden_compra_id: string;
  correlativo: number | null;
  codigo_producto: string | null;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number;
  unidad: string | null;
  precio_unitario_neto: number | null;
  total_neto: number | null;
  created_at: string;
}

export interface OrdenesCompraFilters {
  institucion_rut?: string;
  institucion_nombre?: string;
  proveedor_rut?: string;
  proveedor_nombre?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  search?: string; // Búsqueda general en código, nombre, RUTs
}

// El "tipo" de OC no es una columna: se codifica en el sufijo del código
// (ej. 661439-11-CM26 -> CM Convenio Marco; -TD26 Trato Directo; -AG Compra
// Ágil; -SE generada por licitación; -CC Compra Coordinada). Se deriva aquí.
function derivarTipo(codigo?: string | null): string | null {
  if (!codigo) return null;
  const m = codigo.match(/([A-Za-z]{2})[0-9]*$/);
  return m ? m[1].toUpperCase() : null;
}

// Estado de la OC viene como código numérico de Mercado Público.
const ESTADO_OC: Record<string, string> = {
  '3': 'Guardada',
  '4': 'Enviada',
  '5': 'Aceptada',
  '6': 'Recepción conforme',
  '9': 'Cancelada',
  '12': 'Recepción conforme',
};
function etiquetaEstado(estado?: string | null): string | null {
  if (estado == null || estado === '') return null;
  return ESTADO_OC[String(estado).trim()] ?? `Estado ${estado}`;
}

// Fila cruda tal cual la BD (columnas reales). Sin tipos generados (el schema
// de types.ts está desactualizado para esta tabla).
type RawOC = Record<string, any>;

function mapOrden(o: RawOC): OrdenCompra {
  return {
    id: String(o.id),
    codigo: o.codigo,
    nombre: o.nombre ?? null,
    descripcion: null, // la tabla no tiene descripción a nivel de OC
    institucion_nombre: o.organismo_comprador ?? o.demandante ?? null,
    institucion_rut: o.rut_demandante ?? null,
    proveedor_nombre: o.proveedor_nombre ?? o.proveedor ?? null,
    proveedor_rut: o.rut_proveedor ?? null,
    total_neto: o.neto ?? null,
    total: o.total ?? o.monto_total ?? null,
    fecha_creacion: o.fecha_emision ?? o.created_at ?? null,
    fecha_envio: o.fecha_envio_oc ?? null,
    fecha_aceptacion: null,
    estado: etiquetaEstado(o.estado),
    tipo: derivarTipo(o.codigo),
    created_at: o.created_at,
    updated_at: o.updated_at,
    items: undefined,
  };
}

function mapItem(i: RawOC): OrdenCompraItem {
  return {
    id: String(i.id),
    orden_compra_id: i.numero_oc, // enlazan por numero_oc (== codigo de la OC)
    correlativo: null,
    codigo_producto: i.codigo_producto ?? null,
    nombre_producto: i.producto ?? 'Ítem',
    descripcion: i.especificaciones ?? null,
    cantidad: Number(i.cantidad ?? 0),
    unidad: i.unidad ?? null,
    precio_unitario_neto: i.precio_unitario ?? null,
    total_neto: i.valor_total ?? null,
    created_at: i.created_at,
  };
}

export function useOrdenesCompra(filters?: OrdenesCompraFilters, includeItems = false) {
  return useQuery({
    queryKey: ['ordenes_compra', filters, includeItems],
    queryFn: async (): Promise<OrdenCompra[]> => {
      let query = (supabase as any)
        .from('ordenes_compra')
        .select(
          'id, codigo, nombre, estado, fecha_emision, fecha_envio_oc, monto_total, total, neto, ' +
            'proveedor_nombre, proveedor, rut_proveedor, organismo_comprador, demandante, rut_demandante, ' +
            'numero_licitacion, created_at, updated_at'
        )
        .order('fecha_emision', { ascending: false, nullsFirst: false })
        .limit(1000);

      // RUT: el buscador único ("institución o proveedor") manda el mismo valor
      // en ambos campos. Si coinciden, buscamos con OR; si no, filtro puntual.
      if (filters?.institucion_rut && filters?.proveedor_rut && filters.institucion_rut === filters.proveedor_rut) {
        const v = filters.institucion_rut;
        query = query.or(`rut_demandante.eq.${v},rut_proveedor.eq.${v}`);
      } else {
        if (filters?.institucion_rut) query = query.eq('rut_demandante', filters.institucion_rut);
        if (filters?.proveedor_rut) query = query.eq('rut_proveedor', filters.proveedor_rut);
      }

      // Nombre: igual criterio (institución o proveedor).
      if (
        filters?.institucion_nombre &&
        filters?.proveedor_nombre &&
        filters.institucion_nombre === filters.proveedor_nombre
      ) {
        const v = filters.institucion_nombre;
        query = query.or(`organismo_comprador.ilike.%${v}%,proveedor_nombre.ilike.%${v}%`);
      } else {
        if (filters?.institucion_nombre) query = query.ilike('organismo_comprador', `%${filters.institucion_nombre}%`);
        if (filters?.proveedor_nombre) query = query.ilike('proveedor_nombre', `%${filters.proveedor_nombre}%`);
      }

      if (filters?.fecha_desde) query = query.gte('fecha_emision', filters.fecha_desde);
      if (filters?.fecha_hasta) query = query.lte('fecha_emision', filters.fecha_hasta);

      // Búsqueda general por texto.
      if (filters?.search) {
        const s = filters.search;
        query = query.or(
          `codigo.ilike.%${s}%,nombre.ilike.%${s}%,organismo_comprador.ilike.%${s}%,` +
            `proveedor_nombre.ilike.%${s}%,rut_demandante.ilike.%${s}%,rut_proveedor.ilike.%${s}%`
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error obteniendo órdenes de compra:', error);
        throw new Error(`Error al obtener órdenes de compra: ${error.message}`);
      }

      const ordenes = (data || []) as RawOC[];
      const mapped = ordenes.map(mapOrden);

      // Cargar ítems (enlazados por numero_oc == codigo) si se piden.
      if (includeItems && mapped.length > 0) {
        const codigos = mapped.map((o) => o.codigo).filter(Boolean);
        const { data: itemsData, error: itemsError } = await (supabase as any)
          .from('ordenes_compra_items')
          .select('*')
          .in('numero_oc', codigos);

        if (itemsError) {
          console.error('Error obteniendo items:', itemsError);
        } else {
          const itemsMap = new Map<string, OrdenCompraItem[]>();
          (itemsData || []).forEach((raw: RawOC) => {
            const item = mapItem(raw);
            const key = raw.numero_oc as string;
            if (!itemsMap.has(key)) itemsMap.set(key, []);
            itemsMap.get(key)!.push(item);
          });
          return mapped.map((o) => ({ ...o, items: itemsMap.get(o.codigo) || [] }));
        }
      }

      return mapped;
    },
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useOrdenCompra(codigo: string | null, includeItems = true) {
  return useQuery({
    queryKey: ['orden_compra', codigo, includeItems],
    queryFn: async (): Promise<OrdenCompra | null> => {
      if (!codigo) return null;

      const { data: orden, error: ordenError } = await (supabase as any)
        .from('ordenes_compra')
        .select('*')
        .eq('codigo', codigo)
        .maybeSingle();

      if (ordenError) {
        console.error('Error obteniendo orden de compra:', ordenError);
        throw new Error(`Error al obtener orden de compra: ${ordenError.message}`);
      }
      if (!orden) return null;

      const mapped = mapOrden(orden as RawOC);

      if (includeItems) {
        const { data: itemsData, error: itemsError } = await (supabase as any)
          .from('ordenes_compra_items')
          .select('*')
          .eq('numero_oc', codigo);
        if (itemsError) {
          console.error('Error obteniendo items:', itemsError);
        } else {
          mapped.items = (itemsData || []).map((raw: RawOC) => mapItem(raw));
        }
      }

      return mapped;
    },
    enabled: !!codigo,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useOrdenCompraItems(numeroOc: string | null) {
  return useQuery({
    queryKey: ['orden_compra_items', numeroOc],
    queryFn: async (): Promise<OrdenCompraItem[]> => {
      if (!numeroOc) return [];
      const { data, error } = await (supabase as any)
        .from('ordenes_compra_items')
        .select('*')
        .eq('numero_oc', numeroOc);
      if (error) {
        console.error('Error obteniendo items:', error);
        throw new Error(`Error al obtener items: ${error.message}`);
      }
      return (data || []).map((raw: RawOC) => mapItem(raw));
    },
    enabled: !!numeroOc,
    staleTime: 30000,
    gcTime: 300000,
  });
}

export function useUpsertOrdenCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orden, items }: { orden: Partial<OrdenCompra>; items?: Partial<OrdenCompraItem>[] }) => {
      // Mapea la interfaz a columnas reales de la tabla.
      const ordenData: RawOC = {
        codigo: orden.codigo!,
        numero_oc: orden.codigo!,
        nombre: orden.nombre ?? null,
        organismo_comprador: orden.institucion_nombre ?? null,
        rut_demandante: orden.institucion_rut ?? null,
        proveedor_nombre: orden.proveedor_nombre ?? null,
        rut_proveedor: orden.proveedor_rut ?? null,
        neto: orden.total_neto ?? null,
        total: orden.total ?? null,
        fecha_emision: orden.fecha_creacion ?? null,
        fecha_envio_oc: orden.fecha_envio ?? null,
        estado: orden.estado ?? null,
      };

      const { data: savedOrden, error: ordenError } = await (supabase as any)
        .from('ordenes_compra')
        .upsert(ordenData, { onConflict: 'codigo' })
        .select()
        .single();

      if (ordenError) {
        console.error('Error upserting orden:', ordenError);
        throw new Error(`Error al guardar orden: ${ordenError.message}`);
      }

      if (items && items.length > 0 && savedOrden) {
        const itemsData = items.map((item) => ({
          numero_oc: orden.codigo!,
          codigo_producto: item.codigo_producto ?? null,
          producto: item.nombre_producto ?? null,
          especificaciones: item.descripcion ?? null,
          cantidad: item.cantidad ?? 0,
          unidad: item.unidad ?? null,
          precio_unitario: item.precio_unitario_neto ?? null,
          valor_total: item.total_neto ?? null,
        }));

        const { error: itemsError } = await (supabase as any)
          .from('ordenes_compra_items')
          .insert(itemsData);
        if (itemsError) console.error('Error insertando items:', itemsError);
      }

      return savedOrden;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordenes_compra'] });
      queryClient.invalidateQueries({ queryKey: ['orden_compra'] });
    },
  });
}

export function useOrdenesCompraStats() {
  return useQuery({
    queryKey: ['ordenes_compra_stats'],
    queryFn: async () => {
      const { count: total, error: countError } = await (supabase as any)
        .from('ordenes_compra')
        .select('*', { count: 'exact', head: true });
      if (countError) throw countError;

      // Suma de montos (columna real `total`).
      const { data: montoData } = await (supabase as any)
        .from('ordenes_compra')
        .select('total')
        .limit(20000);
      const montoTotal = (montoData || []).reduce((sum: number, o: RawOC) => sum + (Number(o.total) || 0), 0);

      return { total: total || 0, montoTotal };
    },
  });
}
