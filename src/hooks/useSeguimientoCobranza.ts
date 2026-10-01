import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCliente } from '@/hooks/useCliente';

// La tabla cobranza_seguimiento (bitácora del CRM de cobranza) se creó en la
// migración 20260930220000 y aún no está en los tipos generados; cliente sin tipar.
const sb = supabase as unknown as { from: (t: string) => any };

export type CanalSeguimiento = 'llamada' | 'correo' | 'whatsapp' | 'visita' | 'nota' | 'otro';

export interface SeguimientoCobranza {
  id: string;
  factura_id: string;
  cliente_id: string;
  fecha: string;
  canal: CanalSeguimiento;
  nota: string;
  proximo: string | null;
  created_at: string;
}

export const CANAL_LABEL: Record<CanalSeguimiento, string> = {
  llamada: 'Llamada',
  correo: 'Correo',
  whatsapp: 'WhatsApp',
  visita: 'Visita',
  nota: 'Nota',
  otro: 'Otro',
};

export function useSeguimientoCobranza(facturaId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['cobranza-seguimiento', facturaId],
    enabled: enabled && !!facturaId,
    queryFn: async (): Promise<SeguimientoCobranza[]> => {
      const { data, error } = await sb
        .from('cobranza_seguimiento')
        .select('*')
        .eq('factura_id', facturaId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SeguimientoCobranza[];
    },
  });
}

export interface NuevoSeguimiento {
  factura_id: string;
  canal: CanalSeguimiento;
  nota: string;
  fecha?: string | null;
  proximo?: string | null;
}

export function useAgregarSeguimiento() {
  const qc = useQueryClient();
  const { data: cliente } = useCliente();
  return useMutation({
    mutationFn: async (input: NuevoSeguimiento) => {
      if (!cliente?.id) throw new Error('No hay cliente activo');
      const { error } = await sb.from('cobranza_seguimiento').insert({
        factura_id: input.factura_id,
        cliente_id: cliente.id,
        canal: input.canal,
        nota: input.nota,
        fecha: input.fecha || new Date().toISOString().slice(0, 10),
        proximo: input.proximo || null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['cobranza-seguimiento', v.factura_id] }),
  });
}

export function useEliminarSeguimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; facturaId: string }) => {
      const { error } = await sb.from('cobranza_seguimiento').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['cobranza-seguimiento', v.facturaId] }),
  });
}
