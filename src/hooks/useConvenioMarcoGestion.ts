import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';

// Las tablas cm_marcas / cm_distribuidores / cm_solicitudes se crearon en la
// migración 20260922030000 y todavía no están en los tipos generados de
// Supabase, por eso accedemos vía un cliente sin tipar. El resultado se castea
// a las interfaces de abajo.
const sb = supabase as unknown as {
  from: (t: string) => any;
};

export interface CmMarca {
  id: string;
  cliente_id: string;
  nombre: string;
  palabras_clave: string[];
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmDistribuidor {
  id: string;
  cliente_id: string;
  marca_id: string;
  proveedor_nombre: string;
  proveedor_rut: string | null;
  notas: string | null;
  created_at: string;
}

export type CmEstadoSolicitud = 'borrador' | 'enviada' | 'aceptada' | 'rechazada';

export interface CmSolicitud {
  id: string;
  cliente_id: string;
  marca_id: string | null;
  marca_nombre: string | null;
  proveedor_nombre: string;
  proveedor_rut: string | null;
  producto: string | null;
  producto_key: string | null;
  motivo: string | null;
  estado: CmEstadoSolicitud;
  texto: string | null;
  fecha_envio: string | null;
  created_at: string;
  updated_at: string;
}

// ----- Marcas ---------------------------------------------------------------
export function useCmMarcas() {
  const { data: cliente } = useCliente();
  return useQuery({
    queryKey: ['cm-marcas', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const { data, error } = await sb
        .from('cm_marcas')
        .select('*')
        .eq('cliente_id', cliente!.id)
        .order('nombre', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CmMarca[];
    },
  });
}

export function useCrearMarca() {
  const qc = useQueryClient();
  const { data: cliente } = useCliente();
  return useMutation({
    mutationFn: async (input: { nombre: string; palabras_clave: string[]; notas?: string | null }) => {
      if (!cliente?.id) throw new Error('No hay cliente activo');
      const { error } = await sb.from('cm_marcas').insert({
        cliente_id: cliente.id,
        nombre: input.nombre.trim(),
        palabras_clave: input.palabras_clave,
        notas: input.notas ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-marcas'] }),
  });
}

export function useActualizarMarca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nombre?: string; palabras_clave?: string[]; notas?: string | null }) => {
      const { id, ...rest } = input;
      const { error } = await sb
        .from('cm_marcas')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-marcas'] }),
  });
}

export function useEliminarMarca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('cm_marcas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cm-marcas'] });
      qc.invalidateQueries({ queryKey: ['cm-distribuidores'] });
    },
  });
}

// ----- Distribuidores autorizados -------------------------------------------
export function useCmDistribuidores(marcaId: string | null) {
  const { data: cliente } = useCliente();
  return useQuery({
    queryKey: ['cm-distribuidores', cliente?.id, marcaId],
    enabled: !!cliente?.id && !!marcaId,
    queryFn: async () => {
      const { data, error } = await sb
        .from('cm_distribuidores')
        .select('*')
        .eq('cliente_id', cliente!.id)
        .eq('marca_id', marcaId)
        .order('proveedor_nombre', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CmDistribuidor[];
    },
  });
}

export function useAgregarDistribuidor() {
  const qc = useQueryClient();
  const { data: cliente } = useCliente();
  return useMutation({
    mutationFn: async (input: { marca_id: string; proveedor_nombre: string; proveedor_rut?: string | null }) => {
      if (!cliente?.id) throw new Error('No hay cliente activo');
      const { error } = await sb.from('cm_distribuidores').insert({
        cliente_id: cliente.id,
        marca_id: input.marca_id,
        proveedor_nombre: input.proveedor_nombre.trim(),
        proveedor_rut: input.proveedor_rut?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-distribuidores'] }),
  });
}

export function useEliminarDistribuidor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('cm_distribuidores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-distribuidores'] }),
  });
}

// ----- Solicitudes de baja --------------------------------------------------
export function useCmSolicitudes() {
  const { data: cliente } = useCliente();
  return useQuery({
    queryKey: ['cm-solicitudes', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => {
      const { data, error } = await sb
        .from('cm_solicitudes')
        .select('*')
        .eq('cliente_id', cliente!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CmSolicitud[];
    },
  });
}

export function useCrearSolicitud() {
  const qc = useQueryClient();
  const { data: cliente } = useCliente();
  return useMutation({
    mutationFn: async (input: {
      marca_id: string | null;
      marca_nombre: string | null;
      proveedor_nombre: string;
      proveedor_rut?: string | null;
      producto?: string | null;
      producto_key?: string | null;
      motivo?: string | null;
      texto?: string | null;
    }) => {
      if (!cliente?.id) throw new Error('No hay cliente activo');
      const { error } = await sb.from('cm_solicitudes').insert({
        cliente_id: cliente.id,
        marca_id: input.marca_id,
        marca_nombre: input.marca_nombre,
        proveedor_nombre: input.proveedor_nombre,
        proveedor_rut: input.proveedor_rut ?? null,
        producto: input.producto ?? null,
        producto_key: input.producto_key ?? null,
        motivo: input.motivo ?? null,
        texto: input.texto ?? null,
        estado: 'borrador',
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-solicitudes'] }),
  });
}

export function useActualizarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; estado?: CmEstadoSolicitud; texto?: string | null }) => {
      const { id, estado, texto } = input;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (estado !== undefined) {
        patch.estado = estado;
        patch.fecha_envio = estado === 'enviada' ? new Date().toISOString() : null;
      }
      if (texto !== undefined) patch.texto = texto;
      const { error } = await sb.from('cm_solicitudes').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-solicitudes'] }),
  });
}

export function useEliminarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from('cm_solicitudes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cm-solicitudes'] }),
  });
}

// ----- Utilidades -----------------------------------------------------------
// Normaliza un nombre de proveedor para comparar contra la lista de
// distribuidores autorizados (sin acentos, sin espacios extra, minúsculas).
export function normalizarNombre(v: string): string {
  return (v || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Genera el texto base de una solicitud de baja de ficha.
export function plantillaSolicitud(params: {
  empresa?: string | null;
  marca: string;
  proveedor: string;
  producto?: string | null;
}): string {
  const { empresa, marca, proveedor, producto } = params;
  const remitente = empresa ? `${empresa}, ` : '';
  return [
    `Estimados ChileCompra,`,
    ``,
    `${remitente}en calidad de titular/representante de la marca "${marca}", solicitamos la baja de la ficha del Catálogo de Convenio Marco publicada por el proveedor "${proveedor}"${producto ? ` para el producto "${producto}"` : ''}.`,
    ``,
    `El motivo es que dicho proveedor no es distribuidor autorizado de la marca "${marca}", por lo que ofrece nuestros productos sin autorización.`,
    ``,
    `Quedamos atentos a los antecedentes adicionales que requieran para gestionar esta solicitud.`,
    ``,
    `Saludos cordiales,`,
    empresa || '',
  ].join('\n');
}
