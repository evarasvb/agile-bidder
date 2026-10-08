import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RegionCalor {
  region: string;
  geo_key: string;
  orden: number;
  count_lic: number;
  monto_lic: number;
  count_ca: number;
  monto_ca: number;
}

export interface InstitucionCalor {
  rut: string;
  nombre: string | null;
  count_lic: number;
  monto_lic: number;
  count_ca: number;
  monto_ca: number;
  monto_total: number;
}

export interface ComunaCalor {
  comuna: string;
  count: number;
  monto: number;
}

export interface RegionDetalle {
  instituciones: InstitucionCalor[];
  comunas: ComunaCalor[];
}

// Volumen de licitaciones y compra ágil por región (las 16 regiones de Chile),
// para el mapa de calor de Reportes. Capas: Licitación / Compra Ágil.
export function useMapaCalorRegiones() {
  return useQuery({
    queryKey: ['mapa-calor-regiones'],
    queryFn: async (): Promise<RegionCalor[]> => {
      const { data, error } = await (supabase.rpc as any)('mapa_calor_regiones');
      if (error) throw error;
      return (data ?? []) as RegionCalor[];
    },
    staleTime: 10 * 60_000,
  });
}

// Al hacer zoom/clic en una región: ranking de instituciones y, cuando hay
// comuna registrada (hoy solo en licitaciones), el desglose por comuna —
// el máximo detalle geográfico que guarda la base para esa región.
export function useMapaCalorDetalle(region: string | null) {
  return useQuery({
    queryKey: ['mapa-calor-detalle', region],
    queryFn: async (): Promise<RegionDetalle> => {
      const { data, error } = await (supabase.rpc as any)('mapa_calor_region_detalle', { p_region: region });
      if (error) throw error;
      return (data ?? { instituciones: [], comunas: [] }) as RegionDetalle;
    },
    enabled: !!region,
    staleTime: 10 * 60_000,
  });
}
