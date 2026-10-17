import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompetidorFrecuente {
  rut_otro: string;
  nombre: string | null;
  coincidencias: number;
  veces_gano: number;
}
export interface MisPrincipalesCompetidores {
  total_procesos_propios: number;
  veces_ganamos: number;
  competidores: CompetidorFrecuente[];
}

// "¿Quiénes son mis competidores?" (pedido de Evaristo: por RUT real del
// cliente, sin usar el inventario — el inventario es solo para preparar una
// postulación). Mira las licitaciones donde el cliente ya ofertó y cuenta
// qué otros proveedores aparecieron ahí mismo.
export function useMisPrincipalesCompetidores(limite = 12, meses = 24) {
  return useQuery({
    queryKey: ['mis-principales-competidores', limite, meses],
    queryFn: async (): Promise<MisPrincipalesCompetidores> => {
      const { data, error } = await (supabase.rpc as any)('mis_principales_competidores', { p_limite: limite, p_meses: meses });
      if (error) throw error;
      return data as MisPrincipalesCompetidores;
    },
    staleTime: 10 * 60_000,
  });
}

export interface OportunidadPerdida {
  codigo: string;
  nombre: string | null;
  institucion: string | null;
  rut_institucion: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  monto_estimado: number | null;
  monto_competidor: number | null;
}

// Negocios que dejamos pasar y que este competidor sí tomó: por palabras
// clave del rubro del cliente (sacadas de sus propias licitaciones, no del
// inventario), licitaciones que no postuló y que este competidor ganó.
export function useOportunidadesPerdidasAnte(rutNorm: string | null) {
  return useQuery({
    queryKey: ['oportunidades-perdidas-ante', rutNorm],
    enabled: !!rutNorm,
    queryFn: async (): Promise<OportunidadPerdida[]> => {
      const { data, error } = await (supabase.rpc as any)('oportunidades_perdidas_ante', { p_rut_competidor: rutNorm });
      if (error) throw error;
      return (data ?? []) as OportunidadPerdida[];
    },
    staleTime: 10 * 60_000,
  });
}
