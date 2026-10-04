import { useQuery } from '@tanstack/react-query';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { resultadoHistorico, type HistoricoResultado } from '@/lib/historicoResultado';
export type { HistoricoResultado } from '@/lib/historicoResultado';

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
  estado_award?: string | null;
  ganador_nombre: string | null;
  conducta_pago: string | null;
  pago_promedio_dias: number | null;
  /** Solo compras/convenio ganados: el número real de la orden de compra —
   *  distinto del código del proceso (`codigo`) cuando es Convenio Marco, que
   *  usa la numeración de la licitación que lo originó, no la de la OC. */
  orden_compra_codigo?: string | null;
  orden_compra_link?: string | null;
  /** Solo "no tomadas" v2: qué tan bien matchea el rubro del cliente (motor
   *  de embeddings de Oportunidades), 0-100. */
  score?: number | null;
}

export interface ResumenMercado {
  tamano_mercado: number;
  en_pipeline: number;
  no_tomadas: number;
  tiene_inventario: boolean;
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
    resultado: resultadoHistorico(row, true),
    estado_award: row.estado_award ?? null,
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

// v2: usa el motor de matching por embeddings que ya corre para
// "Oportunidades" (lic_item_matches/ca_item_matches, precalculado por cron)
// en vez de un ILIKE por palabra clave sobre toda licitaciones_bi/
// compras_agiles — esa versión (v1, mis_oportunidades_no_tomadas) escaneaba
// la tabla completa por cada una de las ~20 palabras clave del cliente y
// nunca alcanzaba a responder a tiempo (el filtro se veía vacío sin avisar
// que en realidad había caído por timeout).
export function useOportunidadesNoTomadas(limite = 40, umbral = 0.3) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['historico-no-tomadas-v2', user?.id, limite, umbral],
    enabled: !!user?.id,
    queryFn: async (): Promise<HistoricoPostulacion[]> => {
      const { data, error } = await (supabase.rpc as any)('mis_oportunidades_no_tomadas_v2', { p_limite: limite, p_umbral: umbral });
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
        resultado: resultadoHistorico(row, false),
        estado_award: row.estado_award ?? null,
        ganador_nombre: row.ganador_nombre ?? null,
        conducta_pago: row.conducta_pago ?? null,
        pago_promedio_dias: row.pago_promedio_dias ?? null,
        score: row.score != null ? Number(row.score) : null,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

// "Tamaño del mercado": cuántas oportunidades de su rubro matchean en total
// (postuladas o no), para que el cliente vea el panorama completo, no solo
// la lista acotada de "no tomadas".
export function useResumenMercado(umbral = 0.3) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['resumen-mercado', user?.id, umbral],
    enabled: !!user?.id,
    queryFn: async (): Promise<ResumenMercado> => {
      const { data, error } = await (supabase.rpc as any)('mis_oportunidades_resumen_mercado', { p_umbral: umbral });
      if (error) throw error;
      return (data ?? { tamano_mercado: 0, en_pipeline: 0, no_tomadas: 0, tiene_inventario: false }) as ResumenMercado;
    },
    staleTime: 5 * 60_000,
  });
}
