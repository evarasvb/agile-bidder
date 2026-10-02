import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export type HistoricoResultado = 'ganada' | 'perdida' | 'sin_tomar';

export interface HistoricoPostulacion {
  codigo: string;
  nombre: string | null;
  institucion: string | null;
  /** Área/unidad de compra dentro de la institución (ej. "CMDS Nivel
   *  Central"), cuando es distinta del nombre de la institución. Solo
   *  disponible para órdenes de compra (compra ágil/convenio marco/trato
   *  directo); en licitaciones no se tiene ese dato. */
  area_compradora: string | null;
  rut_institucion: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  monto_estimado: number | null;
  tipo: 'licitacion' | 'compra_agil' | 'convenio_marco' | 'trato_directo' | 'otro';
  resultado: HistoricoResultado;
  ganador_nombre: string | null;
  conducta_pago: string | null;
  pago_promedio_dias: number | null;
  /** Solo compras/convenio ganados: el número real de la orden de compra —
   *  distinto del código del proceso (`codigo`) cuando es Convenio Marco, que
   *  usa la numeración de la licitación que lo originó, no la de la OC. */
  orden_compra_codigo?: string | null;
  orden_compra_link?: string | null;
}

function mapMia(row: any, nombreFallback: string): HistoricoPostulacion {
  return {
    codigo: row.codigo,
    nombre: row.nombre ?? nombreFallback,
    institucion: row.institucion ?? null,
    area_compradora: row.area_compradora ?? null,
    rut_institucion: row.rut_institucion ?? null,
    fecha_publicacion: row.fecha_publicacion ?? null,
    fecha_cierre: row.fecha_cierre ?? null,
    monto_estimado: row.monto_estimado != null ? Number(row.monto_estimado) : null,
    tipo: row.tipo,
    resultado: row.gano ? 'ganada' : 'perdida',
    ganador_nombre: row.gano ? null : (row.ganador_nombre ?? null),
    conducta_pago: row.conducta_pago ?? null,
    pago_promedio_dias: row.pago_promedio_dias ?? null,
    orden_compra_codigo: row.orden_compra_codigo ?? null,
    orden_compra_link: row.orden_compra_link ?? null,
  };
}

// Histórico de postulaciones: a qué procesos ya postuló el cliente (ganó o
// perdió, según los oferentes/adjudicatarios reales de Mercado Público) y a
// cuáles de su industria no postuló todavía. Ver la migración
// 20261002000000_historico_postulaciones.sql para qué sí y qué no se puede
// verificar (compras ágiles: solo se sabe lo que el cliente ganó).
export function useMisPostulaciones() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['historico-mis-postulaciones', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<HistoricoPostulacion[]> => {
      const [lic, ca] = await Promise.all([
        (supabase.rpc as any)('mis_postulaciones_licitaciones'),
        (supabase.rpc as any)('mis_compras_agiles_ganadas'),
      ]);
      if (lic.error) throw lic.error;
      if (ca.error) throw ca.error;
      return [
        ...((lic.data ?? []) as any[]).map((r) => mapMia(r, r.codigo)),
        ...((ca.data ?? []) as any[]).map((r) => mapMia(r, r.codigo)),
      ];
    },
    staleTime: 5 * 60_000,
  });
}

export function useOportunidadesNoTomadas(limite = 40) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['historico-no-tomadas', user?.id, limite],
    enabled: !!user?.id,
    queryFn: async (): Promise<HistoricoPostulacion[]> => {
      const { data, error } = await (supabase.rpc as any)('mis_oportunidades_no_tomadas', { p_limite: limite });
      if (error) throw error;
      return ((data ?? []) as any[]).map((row) => ({
        codigo: row.codigo,
        nombre: row.nombre ?? null,
        institucion: row.institucion ?? null,
        area_compradora: null,
        rut_institucion: row.rut_institucion ?? null,
        fecha_publicacion: row.fecha_publicacion ?? null,
        fecha_cierre: row.fecha_cierre ?? null,
        monto_estimado: row.monto_estimado != null ? Number(row.monto_estimado) : null,
        tipo: row.tipo,
        resultado: 'sin_tomar' as const,
        ganador_nombre: row.ganador_nombre ?? null,
        conducta_pago: row.conducta_pago ?? null,
        pago_promedio_dias: row.pago_promedio_dias ?? null,
      }));
    },
    staleTime: 5 * 60_000,
  });
}
