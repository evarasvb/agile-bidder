// Bases y anexos de una licitación bajados desde Mercado Público (función licitacion-adjuntos).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

const SUPA = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

export interface AdjuntoLicitacion {
  id: string;
  nombre: string;
  tipo: string | null;
  descripcion: string | null;
  fecha_adjunto: string | null;
  bytes: number | null;
  content_type: string | null;
  es_bases: boolean;
  bajado_en: string;
  /** Link firmado (1 h). Solo viene con sesión iniciada. */
  url?: string | null;
}

export interface AdjuntosLicitacionRespuesta {
  codigo: string;
  adjuntos: AdjuntoLicitacion[];
  estado: { revisado_en: string; archivos: number; pendientes: number; error: string | null } | null;
}

export interface TraerAdjuntosResultado {
  ok?: boolean;
  encontrados: number;
  nuevos: number;
  bases: number;
  omitidos: string[];
  errores: string[];
  pendientes: number;
}

async function cabeceras(): Promise<Record<string, string>> {
  const { data } = await supabaseClient.auth.getSession();
  const token = data.session?.access_token;
  return { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (token || ANON) };
}

export const claveAdjuntos = (codigo: string) => ['licitacion_adjuntos', codigo];

export function useAdjuntosLicitacion(codigo: string | null | undefined) {
  return useQuery({
    queryKey: claveAdjuntos(codigo ?? ''),
    enabled: !!codigo,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AdjuntosLicitacionRespuesta> => {
      const r = await fetch(`${SUPA}/functions/v1/licitacion-adjuntos?codigo=${encodeURIComponent(codigo!)}`, { headers: await cabeceras() });
      if (!r.ok) throw new Error(`No pude leer los adjuntos (${r.status})`);
      return r.json();
    },
  });
}

export function useTraerAdjuntos(codigo: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<TraerAdjuntosResultado> => {
      if (!codigo) throw new Error('Sin código de licitación');
      const r = await fetch(`${SUPA}/functions/v1/licitacion-adjuntos`, { method: 'POST', headers: await cabeceras(), body: JSON.stringify({ codigo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
      return j as TraerAdjuntosResultado;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claveAdjuntos(codigo ?? '') });
      qc.invalidateQueries({ queryKey: ['experto_libro', codigo] });
    },
  });
}
