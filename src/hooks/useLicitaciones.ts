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
      const { data, error } = await supabase
        .from('licitaciones')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Licitacion[];
    },
  });
}

export function useLicitacionesNuevas() {
  return useQuery({
    queryKey: ['licitaciones', 'nuevas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitaciones')
        .select('*')
        .or('procesada.eq.false,procesada.is.null')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Licitacion[];
    },
  });
}

export function useLicitacionesConMatch() {
  return useQuery({
    queryKey: ['licitaciones', 'con_match'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('licitaciones')
        .select('*')
        .eq('match_encontrado', true)
        .order('match_score', { ascending: false });
      
      if (error) throw error;
      return data as Licitacion[];
    },
  });
}

export function useAnalizarMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (licitacionId: string) => {
      // Simulate matching analysis (placeholder)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate random match score between 60-100
      const matchScore = Math.floor(Math.random() * 41) + 60;
      
      const { error } = await supabase
        .from('licitaciones')
        .update({
          procesada: true,
          match_encontrado: true,
          match_score: matchScore,
        })
        .eq('id_licitacion', licitacionId);
      
      if (error) throw error;
      return { matchScore };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
    },
  });
}

export function useRechazarLicitacion() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (licitacionId: string) => {
      const { error } = await supabase
        .from('licitaciones')
        .update({
          procesada: true,
          match_encontrado: false,
          match_score: null,
        })
        .eq('id_licitacion', licitacionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
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
