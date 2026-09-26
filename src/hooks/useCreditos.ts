import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CreditosSaldo {
  ok: boolean;
  saldo: number;
  plan: string;
  plan_nombre: string;
  ilimitado: boolean;
}

export interface ConsumoResultado {
  ok: boolean;
  saldo: number;
  cobrado: number;
  motivo: string;      // ok | gratis | ilimitado | sin_creditos | sin_usuario
  requiere?: number;
}

// rpc casteado: los tipos generados de Supabase aún no incluyen estas funciones nuevas.
const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/** Saldo de créditos del cliente actual (para la barra). */
export function useCreditosSaldo() {
  return useQuery({
    queryKey: ['creditos-saldo'],
    queryFn: async (): Promise<CreditosSaldo | null> => {
      const { data, error } = await rpc('creditos_saldo');
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as CreditosSaldo | null;
      return row && row.ok ? row : null;
    },
    staleTime: 30 * 1000,
  });
}

/**
 * Descuenta créditos por una acción. Devuelve el resultado del cobro.
 * Refresca el saldo de la barra al terminar.
 */
export function useConsumirCreditos() {
  const qc = useQueryClient();
  return async (accion: string, cantidad = 1, referencia?: string): Promise<ConsumoResultado> => {
    const { data, error } = await rpc('consumir_creditos', {
      p_accion: accion,
      p_cantidad: cantidad,
      p_referencia: referencia ?? null,
    });
    if (error) throw error;
    const res = (Array.isArray(data) ? data[0] : data) as ConsumoResultado;
    qc.invalidateQueries({ queryKey: ['creditos-saldo'] });
    return res;
  };
}
