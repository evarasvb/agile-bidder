import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ClienteConfig {
  id: string;
  empresa_nombre: string;
  plan: string | null;
}

export function useClienteConfig() {
  const { user, isAuthenticated } = useAuth();

  const { data: clienteConfig, isLoading, error } = useQuery({
    queryKey: ['cliente-config', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('clientes')
        .select('id, empresa_nombre, plan')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cliente config:', error);
        return null;
      }

      return data as ClienteConfig | null;
    },
    enabled: isAuthenticated && !!user?.id,
  });

  return {
    clienteConfig,
    isLoading,
    error,
  };
}
