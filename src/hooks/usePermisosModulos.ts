import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import type { ModuloKey } from '@/lib/modulosPermisos';

// `vendedores.permisos` aún no está en los tipos generados.
const sb = supabase as unknown as { from: (t: string) => any };

interface PermisosModulos {
  cargando: boolean;
  // true = acceso a todo (dueño/admin/fundador, o miembro sin restricción).
  todo: boolean;
  permitidos: Set<ModuloKey>;
  puede: (modulo: ModuloKey | null) => boolean;
}

// Permisos por módulo del usuario actual.
// - Dueño/admin/super_admin (fundador): ven TODO.
// - Miembro invitado: lo que tenga marcado en su fila `vendedores.permisos`.
//   Si `permisos` es null/ausente ⇒ ve TODO (no se bloquea a nadie existente).
export function usePermisosModulos(): PermisosModulos {
  const { user } = useAuth();
  const { isAdmin, loading: perfilCargando } = useProfile();

  const { data: permisosRaw, isLoading: permisosCargando, isSuccess } = useQuery({
    queryKey: ['mis-permisos-modulos', user?.id],
    enabled: !!user?.id && !isAdmin, // admin ve todo: no hace falta consultar
    staleTime: 60_000,
    // Si el admin cambia los permisos mientras el miembro sigue adentro, que se
    // refresquen solos: re-consulta cada minuto y al volver el foco a la pestaña.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ModuloKey[] | null> => {
      // La RLS de vendedores permite ver la fila propia (user_id = auth.uid()).
      const { data, error } = await sb
        .from('vendedores')
        .select('permisos')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      const p = (data as { permisos?: unknown })?.permisos;
      return Array.isArray(p) ? (p as ModuloKey[]) : null; // null = sin restricción
    },
  });

  const cargando = perfilCargando || (!isAdmin && permisosCargando);

  // Acceso total SOLO si: soy admin/fundador, o la consulta tuvo ÉXITO y
  // devolvió null (sin restricción). Si la consulta falla (error de API/RLS),
  // NO se concede todo: se "falla cerrado" ocultando lo gateado, para que un
  // error transitorio nunca abra módulos que no corresponden.
  const todo = isAdmin || (isSuccess && permisosRaw == null);
  const permitidos = new Set<ModuloKey>(isSuccess && permisosRaw ? permisosRaw : []);

  const puede = (modulo: ModuloKey | null): boolean => {
    if (modulo == null) return true; // ruta libre
    if (todo) return true;
    return permitidos.has(modulo);
  };

  return { cargando, todo, permitidos, puede };
}
