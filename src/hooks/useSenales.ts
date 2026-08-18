import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';

// =============================================================================
// Nivel 2: la IA aprende del comportamiento del cliente.
// Registramos SEÑALES (qué descarta / qué cotiza) y una función las analiza para
// sugerir palabras a excluir/incluir. Con el tiempo afina los matches.
// =============================================================================

export type SenalTipo = 'descartada' | 'cotizada' | 'guardada' | 'vista';

export interface SenalInput {
  tipo: SenalTipo;
  oportunidad_tipo?: 'compra_agil' | 'licitacion' | null;
  codigo?: string | null;
  titulo?: string | null;
  meta?: Record<string, unknown> | null;
}

/** Devuelve una función para registrar una señal (fire-and-forget, no bloquea la UI). */
export function useRegistrarSenal() {
  const { data: cliente } = useCliente();
  const clienteId = cliente?.id ?? null;

  return useCallback(
    (s: SenalInput) => {
      if (!clienteId) return;
      // Best-effort: no interrumpe la acción del usuario si falla.
      (supabase as any)
        .from('cliente_senales')
        .insert({
          cliente_id: clienteId,
          tipo: s.tipo,
          oportunidad_tipo: s.oportunidad_tipo ?? null,
          codigo: s.codigo ?? null,
          titulo: s.titulo ?? null,
          meta: s.meta ?? null,
        })
        .then(
          () => {},
          () => {},
        );
    },
    [clienteId],
  );
}

export interface SugerenciaAprendida { palabra: string; veces: number; }
export interface Aprendizaje {
  total_senales: number;
  descartadas: number;
  cotizadas: number;
  excluir_sugeridas: SugerenciaAprendida[];
  incluir_sugeridas: SugerenciaAprendida[];
}

/** Lo que la IA aprendió del comportamiento del cliente. */
export function useAprendizaje() {
  const { data: cliente } = useCliente();
  const clienteId = cliente?.id ?? null;

  return useQuery({
    queryKey: ['aprendizaje', clienteId],
    queryFn: async (): Promise<Aprendizaje> => {
      const { data, error } = await (supabase as any).rpc('cliente_aprendizaje', { p_cliente: clienteId });
      if (error) throw error;
      return (data as Aprendizaje) ?? {
        total_senales: 0, descartadas: 0, cotizadas: 0, excluir_sugeridas: [], incluir_sugeridas: [],
      };
    },
    enabled: !!clienteId,
    staleTime: 60 * 1000,
  });
}
