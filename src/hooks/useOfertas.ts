import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { generarOferta, actualizarEstadoOferta, validarOferta, eliminarOferta } from '@/services/ofertaGenerator';
import type { MatchResult } from '@/services/matchingEngine';
import type { Json } from '@/integrations/supabase/types';

export interface ProductoOfertado {
  inventory_id: string;
  sku: string;
  nombre_producto: string;
  descripcion: string;
  cantidad: number;
  unidad_medida: string;
  precio_unitario: number;
  precio_total: number;
  margen_aplicado: number;
}

export interface Oferta {
  id: string;
  licitacion_id: string;
  estado: 'borrador' | 'revision' | 'aprobada' | 'enviada' | 'rechazada' | 'ganada' | 'perdida';
  match_score: number | null;
  productos_ofertados: ProductoOfertado[];
  valor_total_oferta: number;
  margen_total: number;
  notas_internas: string | null;
  documento_oferta_url: string | null;
  fecha_envio: string | null;
  respuesta_mp: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  licitacion?: {
    id_licitacion: string;
    titulo: string;
    organismo: string;
    presupuesto: number | null;
    fecha_cierre: string | null;
  };
}

function parseOferta(data: unknown): Oferta {
  const raw = data as Record<string, unknown>;
  return {
    ...raw,
    productos_ofertados: (raw.productos_ofertados || []) as ProductoOfertado[],
    respuesta_mp: raw.respuesta_mp as Record<string, unknown> | null,
  } as Oferta;
}

export function useOfertas() {
  return useQuery({
    queryKey: ['ofertas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ofertas')
        .select(`
          *,
          licitacion:licitaciones(id_licitacion, titulo, organismo, presupuesto, fecha_cierre)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(parseOferta);
    },
  });
}

export function useOfertasPorEstado(estado: Oferta['estado'] | 'todas') {
  return useQuery({
    queryKey: ['ofertas', estado],
    queryFn: async () => {
      let query = supabase
        .from('ofertas')
        .select(`
          *,
          licitacion:licitaciones(id_licitacion, titulo, organismo, presupuesto, fecha_cierre)
        `)
        .order('created_at', { ascending: false });
      
      if (estado !== 'todas') {
        query = query.eq('estado', estado);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return (data || []).map(parseOferta);
    },
  });
}

export function useOferta(id: string | null) {
  return useQuery({
    queryKey: ['ofertas', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('ofertas')
        .select(`
          *,
          licitacion:licitaciones(id_licitacion, titulo, organismo, presupuesto, fecha_cierre)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return parseOferta(data);
    },
    enabled: !!id,
  });
}

export function useGenerarOferta() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (matchResult: MatchResult) => {
      return generarOferta(matchResult);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ofertas'] });
      queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
    },
  });
}

export function useActualizarEstadoOferta() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      ofertaId, 
      estado, 
      notas 
    }: { 
      ofertaId: string; 
      estado: Oferta['estado']; 
      notas?: string;
    }) => {
      await actualizarEstadoOferta(ofertaId, estado, notas);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ofertas'] });
    },
  });
}

export function useActualizarProductosOferta() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      ofertaId, 
      productos 
    }: { 
      ofertaId: string; 
      productos: ProductoOfertado[];
    }) => {
      const valorTotal = productos.reduce((sum, p) => sum + p.precio_total, 0);
      const costoTotal = productos.reduce(
        (sum, p) => sum + (p.precio_unitario / (1 + p.margen_aplicado / 100)) * p.cantidad, 
        0
      );
      const margenTotal = costoTotal > 0 
        ? Math.round(((valorTotal - costoTotal) / costoTotal) * 100) 
        : 0;
      
      const { error } = await supabase
        .from('ofertas')
        .update({
          productos_ofertados: productos as unknown as Json,
          valor_total_oferta: valorTotal,
          margen_total: margenTotal
        })
        .eq('id', ofertaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ofertas'] });
    },
  });
}

export function useValidarOferta() {
  return useMutation({
    mutationFn: async (ofertaId: string) => {
      return validarOferta(ofertaId);
    },
  });
}

export function useEliminarOferta() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (ofertaId: string) => {
      await eliminarOferta(ofertaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ofertas'] });
    },
  });
}

export function useOfertasStats() {
  return useQuery({
    queryKey: ['ofertas', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ofertas')
        .select('*');
      
      if (error) throw error;
      
      const ofertas = (data || []).map(parseOferta);
      
      const porEstado = {
        borrador: ofertas.filter(o => o.estado === 'borrador').length,
        revision: ofertas.filter(o => o.estado === 'revision').length,
        aprobada: ofertas.filter(o => o.estado === 'aprobada').length,
        enviada: ofertas.filter(o => o.estado === 'enviada').length,
        rechazada: ofertas.filter(o => o.estado === 'rechazada').length,
        ganada: ofertas.filter(o => o.estado === 'ganada').length,
        perdida: ofertas.filter(o => o.estado === 'perdida').length,
      };
      
      const enviadas = ofertas.filter(o => ['enviada', 'ganada', 'perdida'].includes(o.estado));
      const ganadas = ofertas.filter(o => o.estado === 'ganada');
      
      const valorTotalPendiente = ofertas
        .filter(o => ['borrador', 'revision', 'aprobada'].includes(o.estado))
        .reduce((sum, o) => sum + o.valor_total_oferta, 0);
      
      const valorTotalEnviado = enviadas.reduce((sum, o) => sum + o.valor_total_oferta, 0);
      const valorGanado = ganadas.reduce((sum, o) => sum + o.valor_total_oferta, 0);
      
      const margenPromedio = ofertas.length > 0
        ? ofertas.reduce((sum, o) => sum + (o.margen_total || 0), 0) / ofertas.length
        : 0;
      
      const tasaConversion = enviadas.length > 0
        ? (ganadas.length / enviadas.length) * 100
        : 0;
      
      return {
        total: ofertas.length,
        porEstado,
        valorTotalPendiente,
        valorTotalEnviado,
        valorGanado,
        margenPromedio: Math.round(margenPromedio),
        tasaConversion: Math.round(tasaConversion)
      };
    },
  });
}
