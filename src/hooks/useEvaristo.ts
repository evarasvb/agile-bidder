// Hook para interactuar con Evaristo API
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface EvaristoStatus {
  status: string;
  has_gemini: boolean;
  has_deepseek: boolean;
  timestamp: string;
}

interface EvaristoResponse {
  success: boolean;
  exit_code: number;
  output: string;
  error?: string;
  report?: any;
  timestamp: string;
}

export function useEvaristoStatus() {
  return useQuery({
    queryKey: ['evaristo', 'status'],
    queryFn: async (): Promise<EvaristoStatus> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Verificar email autorizado
      const userEmail = session.user.email?.toLowerCase();
      if (userEmail !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'status' }),
        }
      );

      if (!response.ok) throw new Error('Failed to get status');
      return response.json();
    },
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });
}

export function useEvaristoRevisar() {
  return useMutation({
    mutationFn: async (apiKeys?: { gemini?: string; deepseek?: string }): Promise<EvaristoResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action: 'revisar',
            api_keys: apiKeys,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute revisar');
      }

      return response.json();
    },
  });
}

export function useEvaristoMision() {
  return useMutation({
    mutationFn: async ({ 
      mision_file, 
      api_keys 
    }: { 
      mision_file: string; 
      api_keys?: { gemini?: string; deepseek?: string } 
    }): Promise<EvaristoResponse> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      // Verificar email autorizado
      const userEmail = session.user.email?.toLowerCase();
      if (userEmail !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            action: 'mision',
            mision_file,
            api_keys,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute mision');
      }

      return response.json();
    },
  });
}
