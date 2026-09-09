import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Mención de un organismo en diarios, radios, TV, portales o prensa oficial (Google Noticias vía FirmaVB). */
export interface MencionMedio {
  id: number;
  organismo: string;
  titulo: string;
  url: string;
  medio: string | null;
  tipo_medio: 'diario' | 'radio' | 'tv' | 'portal' | 'oficial' | 'gremio' | 'redes' | 'otro';
  fecha: string | null;
  resumen: string | null;
  revisado_en: string | null;
}

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const clave = (codigo?: string | null, organismo?: string | null) => ['medios-organismo', codigo ?? '', organismo ?? ''];

export function useMediosOrganismo(codigo?: string | null, organismo?: string | null) {
  return useQuery({
    queryKey: clave(codigo, organismo),
    queryFn: async (): Promise<MencionMedio[]> => {
      const { data, error } = await (supabase as any).rpc('medios_organismo', {
        p_codigo: codigo ?? null,
        p_organismo: organismo ?? null,
        p_cantidad: 30,
      });
      if (error) throw error;
      return (data ?? []) as MencionMedio[];
    },
    enabled: Boolean(codigo || organismo),
    staleTime: 10 * 60 * 1000,
  });
}

/** Pide al robot que traiga (o refresque) las menciones del organismo y recarga la lista. */
export function useRefrescarMedios(codigo?: string | null, organismo?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (forzar = false) => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('Inicia sesión para ver qué dicen los medios.');
      const r = await fetch(`${SUPA}/functions/v1/medios-organismo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string },
        body: JSON.stringify({ codigo: codigo ?? undefined, organismo: organismo ?? undefined, forzar }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
      return j as { organismo: string; refrescado: boolean; menciones: MencionMedio[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: clave(codigo, organismo) }),
  });
}
