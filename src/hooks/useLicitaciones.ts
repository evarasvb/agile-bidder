import { useQuery } from '@tanstack/react-query';
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
