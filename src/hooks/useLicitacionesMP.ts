// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LicitacionMP {
  id: string;
  codigo: string;
  nombre: string;
  institucion_nombre: string | null;
  presupuesto_estimado: number | null;
  created_at: string | null;
  fecha_cierre: string | null;
  estado: string | null;
  unidad_compra_region: string | null;
}

/**
 * Licitaciones frescas: lee directamente de `licitaciones_bi`, la tabla que el
 * robot interno actualiza cada ~4 horas. Ordena por fecha de publicacion
 * (mas nuevas primero). Es de solo lectura y no toca ninguna otra pantalla.
 */
export function useLicitacionesMP(limit = 200) {
  return useQuery({
    queryKey: ["licitaciones-mp", limit],
    queryFn: async (): Promise<LicitacionMP[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("licitaciones_bi")
        .select(
          "id, codigo, nombre, institucion_nombre, presupuesto_estimado, created_at, fecha_cierre, estado, unidad_compra_region"
        )
        .or(`fecha_cierre.gte.${nowIso},fecha_cierre.is.null`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as LicitacionMP[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
