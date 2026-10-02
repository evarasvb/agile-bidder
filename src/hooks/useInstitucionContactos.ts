import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Directorio colaborativo de contactos por institución (venta, cobranza...).
// La tabla se creó en 20261002200000 y aún no está en los tipos generados.
const sb = supabase as unknown as { from: (t: string) => any };

export interface InstitucionContacto {
  id: string;
  institucion_rut: string;
  institucion_nombre: string | null;
  nombre_contacto: string;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  etiquetas: string[];
  notas: string | null;
  creado_en: string;
}

// Lista los contactos ya cargados para una institución (por RUT, tal como
// viene de instituciones/ordenes_compra — mismo formato con puntos y guión).
export function useContactosInstitucion(rut: string | null) {
  return useQuery({
    queryKey: ['institucion-contactos', rut],
    enabled: !!rut,
    staleTime: 30_000,
    queryFn: async (): Promise<InstitucionContacto[]> => {
      const { data, error } = await sb
        .from('institucion_contactos')
        .select('*')
        .eq('institucion_rut', rut)
        .order('creado_en', { ascending: false });
      if (error) throw error;
      return (data ?? []) as InstitucionContacto[];
    },
  });
}

export interface NuevoContactoInstitucion {
  institucion_rut: string;
  institucion_nombre?: string | null;
  nombre_contacto: string;
  email?: string | null;
  telefono?: string | null;
  cargo?: string | null;
  etiquetas?: string[];
}

export function useAgregarContactoInstitucion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (c: NuevoContactoInstitucion): Promise<InstitucionContacto> => {
      const { data, error } = await sb
        .from('institucion_contactos')
        .insert({
          ...c,
          email: c.email?.trim() || null,
          telefono: c.telefono?.trim() || null,
          cargo: c.cargo?.trim() || null,
          etiquetas: c.etiquetas ?? [],
          agregado_por: user?.id ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data as InstitucionContacto;
    },
    onSuccess: (c) => qc.invalidateQueries({ queryKey: ['institucion-contactos', c.institucion_rut] }),
  });
}
