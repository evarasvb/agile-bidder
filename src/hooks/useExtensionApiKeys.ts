import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ExtensionApiKey {
  id: string;
  cliente_id: string;
  api_key: string;
  nombre: string;
  activa: boolean;
  last_used: string | null;
  created_at: string;
  updated_at: string;
}

// Generate a cryptographically secure API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  let result = 'fvb_ext_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
}

export function useExtensionApiKeys(clienteId: string | null) {
  return useQuery({
    queryKey: ['extension-api-keys', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from('extension_api_keys')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ExtensionApiKey[];
    },
    enabled: !!clienteId
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ clienteId, nombre }: { clienteId: string; nombre: string }) => {
      const apiKey = generateApiKey();
      
      const { data, error } = await supabase
        .from('extension_api_keys')
        .insert({
          cliente_id: clienteId,
          api_key: apiKey,
          nombre: nombre || 'API Key',
          activa: true
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, plainKey: apiKey } as ExtensionApiKey & { plainKey: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['extension-api-keys'] });
      toast({
        title: 'API Key creada',
        description: 'Copia la key ahora, no podrás verla de nuevo.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al crear API Key',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useToggleApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => {
      const { error } = await supabase
        .from('extension_api_keys')
        .update({ activa })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['extension-api-keys'] });
      toast({
        title: variables.activa ? 'API Key activada' : 'API Key desactivada'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('extension_api_keys')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extension-api-keys'] });
      toast({
        title: 'API Key eliminada'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

export function useExtensionActivity(clienteId: string | null) {
  return useQuery({
    queryKey: ['extension-activity', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      
      const { data, error } = await supabase
        .from('extension_activity_log')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId
  });
}
