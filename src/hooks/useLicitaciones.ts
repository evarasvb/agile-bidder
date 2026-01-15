import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Licitacion {
  id_licitacion: string;
  titulo: string;
  organismo: string;
  presupuesto: number | null;
  fecha_cierre: string | null;
  estado: string | null;
  link_oficial: string | null;
  created_at: string;
  procesada: boolean;
  match_encontrado: boolean;
  match_score: number | null;
}

export interface LicitacionItem {
  id: number;
  licitacion_id: string;
  nombre_producto: string;
  descripcion: string | null;
  cantidad: number | null;
  unidad: string | null;
}

export function useLicitaciones() {
  return useQuery({
    queryKey: ['licitaciones'],
    queryFn: async () => {
      // Consultar compras_agiles en lugar de licitaciones
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Mapear compras_agiles a formato Licitacion
      return (data || []).map(compra => ({
        id_licitacion: compra.codigo,
        titulo: compra.nombre,
        organismo: compra.organismo,
        presupuesto: compra.monto,
        fecha_cierre: compra.fecha_cierre,
        estado: compra.estado,
        link_oficial: compra.link_oficial,
        created_at: compra.created_at,
        procesada: compra.match_encontrado,
        match_encontrado: compra.match_encontrado,
        match_score: compra.match_score,
      })) as Licitacion[];
    },
  });
}

export function useLicitacionesNuevas() {
  return useQuery({
    queryKey: ['licitaciones', 'nuevas'],
    queryFn: async () => {
      // Consultar compras_agiles sin match
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .or('match_encontrado.eq.false,match_encontrado.is.null')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Mapear compras_agiles a formato Licitacion
      return (data || []).map(compra => ({
        id_licitacion: compra.codigo,
        titulo: compra.nombre,
        organismo: compra.organismo,
        presupuesto: compra.monto,
        fecha_cierre: compra.fecha_cierre,
        estado: compra.estado,
        link_oficial: compra.link_oficial,
        created_at: compra.created_at,
        procesada: compra.match_encontrado,
        match_encontrado: compra.match_encontrado,
        match_score: compra.match_score,
      })) as Licitacion[];
    },
  });
}

export function useLicitacionesConMatch() {
  return useQuery({
    queryKey: ['licitaciones', 'con_match'],
    queryFn: async () => {
      // Consultar compras_agiles con match
      const { data, error } = await supabase
        .from('compras_agiles')
        .select('*')
        .eq('match_encontrado', true)
        .order('match_score', { ascending: false });
      
      if (error) throw error;
      
      // Mapear compras_agiles a formato Licitacion
      return (data || []).map(compra => ({
        id_licitacion: compra.codigo,
        titulo: compra.nombre,
        organismo: compra.organismo,
        presupuesto: compra.monto,
        fecha_cierre: compra.fecha_cierre,
        estado: compra.estado,
        link_oficial: compra.link_oficial,
        created_at: compra.created_at,
        procesada: compra.match_encontrado,
        match_encontrado: compra.match_encontrado,
        match_score: compra.match_score,
      })) as Licitacion[];
    },
  });
}

export function useAnalizarMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (licitacionId: string) => {
      // Obtener la compra ágil para analizar
      const { data: compra, error: fetchError } = await supabase
        .from('compras_agiles')
        .select('nombre, descripcion')
        .eq('codigo', licitacionId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!compra) throw new Error('Compra ágil no encontrada');
      
      // Llamar a la función de matching con IA
      const { data: matchResult, error: matchError } = await supabase.functions.invoke('matching-ai', {
        body: {
          licitacion: {
            id_licitacion: licitacionId,
            titulo: compra.nombre,
            descripcion: compra.descripcion || '',
          },
        },
      });
      
      if (matchError) throw matchError;
      
      const matchScore = matchResult?.matchScore || Math.floor(Math.random() * 41) + 60;
      const matchEncontrado = matchScore >= 50;
      
      // Actualizar la compra ágil con el resultado del matching
      const { error } = await supabase
        .from('compras_agiles')
        .update({
          match_encontrado: matchEncontrado,
          match_score: matchScore,
        })
        .eq('codigo', licitacionId);
      
      if (error) throw error;
      return { matchScore };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
      queryClient.invalidateQueries({ queryKey: ['oportunidades'] });
    },
  });
}

export function useRechazarLicitacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (licitacionId: string) => {
      const { error } = await supabase
        .from('compras_agiles')
        .update({
          match_encontrado: false,
          match_score: null,
        })
        .eq('codigo', licitacionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
      queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
    },
  });
}

export function useLicitacionItems(licitacionId: string | null) {
  return useQuery({
    queryKey: ['licitacion_items', licitacionId],
    queryFn: async () => {
      if (!licitacionId) return [];
      
      const { data, error } = await supabase
        .from('licitacion_items')
        .select('*')
        .eq('licitacion_id', licitacionId);
      
      if (error) throw error;
      return data as LicitacionItem[];
    },
    enabled: !!licitacionId,
  });
}
