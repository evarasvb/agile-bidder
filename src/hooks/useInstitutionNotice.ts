import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { InstitutionNotice } from '@/lib/institutionFollowing';

export type SavedInstitutionNotice = InstitutionNotice & { created_at: string };

// Fetch the selected receipt independently of the bell's 30 newest messages.
// RLS on notificaciones_log controls access, including direct/altered URLs.
export function useInstitutionNotice(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['institution-notice', user?.id, id],
    enabled: !!user?.id && !!id,
    queryFn: async (): Promise<SavedInstitutionNotice | null> => {
      const { data, error } = await supabase.from('notificaciones_log')
        .select('id, tipo, licitacion_id, datos, created_at').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as SavedInstitutionNotice | null;
    },
  });
}
