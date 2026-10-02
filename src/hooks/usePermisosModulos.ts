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

  const { data: permisosRaw, isLoading: permisosCargando } = useQuery({
    queryKey: ['mis-permisos-modulos', user?.id],
    enabled: !!user?.id && !isAdmin, // admin ve todo: no hace falta consultar
    staleTime: 5 * 60_000,
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

  // Admin/fundador, o miembro sin lista de permisos ⇒ todo.
  const todo = isAdmin || permisosRaw == null;
  const permitidos = new Set<ModuloKey>(todo ? [] : permisosRaw);

  const puede = (modulo: ModuloKey | null): boolean => {
    if (modulo == null) return true; // ruta libre
    if (todo) return true;
    return permitidos.has(modulo);
  };

  return { cargando, todo, permitidos, puede };
}
