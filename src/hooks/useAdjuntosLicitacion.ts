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
  bases_pendiente?: boolean;
  bajado_en: string;
  /** Link firmado (1 h). Solo viene con sesión iniciada. */
  url?: string | null;
}

export interface BaseLicitacion {
  id: string;
  archivo: string;
  paginas: number | null;
  creado_en: string;
  resumen_ok: boolean;
  url?: string | null;
}

export interface AdjuntosLicitacionRespuesta {
  codigo: string;
  adjuntos: AdjuntoLicitacion[];
  /** Bases (PDF) ya leídas por el Experto, subidas por un usuario o por el robot. */
  bases: BaseLicitacion[];
  estado: {
    revisado_en: string;
    archivos: number;
    pendientes: number;
    error: string | null;
    /** Sección "Adjuntos" de la ficha en Mercado Público (exige captcha, se abre a mano). */
    url_adjuntos_mp?: string | null;
    adjuntos_mp_solo_captcha?: boolean | null;
  } | null;
  ficha_url?: string;
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

/** Sube un PDF de bases a mano (misma ruta que el Libro del Experto): queda para todos y el Experto lo lee. */
export function useSubirBases(codigo: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<{ paginas?: number; destino?: string }> => {
      if (!codigo) throw new Error('Sin código de licitación');
      const { data } = await supabaseClient.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error('Inicia sesión en FirmaVB (es gratis) para subir las bases.');
      const r = await fetch(`${SUPA}/functions/v1/experto-documentos`, {
        method: 'POST',
        headers: { apikey: ANON, Authorization: 'Bearer ' + token, 'Content-Type': file.type || 'application/pdf', 'X-Codigo': codigo, 'X-Nombre': encodeURIComponent(file.name), 'X-Destino': 'bases' },
        body: file,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.mensaje || j.error || `Error ${r.status}`);
      return j;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: claveAdjuntos(codigo ?? '') });
      qc.invalidateQueries({ queryKey: ['experto_libro', codigo] });
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
