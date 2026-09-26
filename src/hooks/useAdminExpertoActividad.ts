import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExpertoResumen {
  consultas_total: number;
  consultas_hoy: number;
  consultas_7d: number;
  anonimas_7d: number;
  evaristo_mensajes_7d: number;
}

export interface ExpertoConsulta {
  id: number;
  creado_en: string;
  user_id: string | null;
  empresa_nombre: string | null;
  email: string | null;
  huella: string | null;
  modo: string;
  licitacion: string | null;
  pregunta: string;
  respuesta: string;
  ms: number | null;
}

export interface EvaristoConversacion {
  id: string;
  user_id: string;
  empresa_nombre: string | null;
  email: string | null;
  canal: string;
  titulo: string | null;
  actualizado_en: string;
  mensajes: number;
  ultima_pregunta: string | null;
}

export interface EvaristoMensaje {
  id: number;
  rol: 'user' | 'assistant';
  contenido: string;
  creado_en: string;
}

export function useExpertoResumen() {
  return useQuery({
    queryKey: ['admin_experto_resumen'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_experto_resumen');
      if (error) throw error;
      return data as ExpertoResumen | null;
    },
  });
}

export function useExpertoConsultas(dias: number, buscar: string) {
  return useQuery({
    queryKey: ['admin_experto_consultas', dias, buscar],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_experto_consultas', { dias, lim: 300, buscar: buscar || null });
      if (error) throw error;
      return (data ?? []) as ExpertoConsulta[];
    },
  });
}

export function useEvaristoConversaciones(dias: number) {
  return useQuery({
    queryKey: ['admin_evaristo_conversaciones', dias],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_evaristo_conversaciones', { dias, lim: 200 });
      if (error) throw error;
      return (data ?? []) as EvaristoConversacion[];
    },
  });
}

export function useEvaristoMensajes(conversacionId: string | null) {
  return useQuery({
    queryKey: ['admin_evaristo_mensajes', conversacionId],
    enabled: !!conversacionId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_evaristo_mensajes', { p_conversacion_id: conversacionId });
      if (error) throw error;
      return (data ?? []) as EvaristoMensaje[];
    },
  });
}
