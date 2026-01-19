// Hook para interactuar con Evaristo API - Using FirmaVB Supabase only
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabaseClient } from '@/lib/supabaseClient';

interface EvaristoStatus {
  status: string;
  has_gemini: boolean;
  has_deepseek: boolean;
  timestamp: string;
}

interface EvaristoResponse {
  success: boolean;
  exit_code?: number;
  output?: string;
  error?: string;
  message?: string;
  report?: any;
  timestamp: string;
}

// FirmaVB Supabase configuration
const FIRMAVB_URL = 'https://juiskeeutbaipwbeeezw.supabase.co';
const FIRMAVB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1aXNrZWV1dGJhaXB3YmVlZXp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3NzQ4MzYsImV4cCI6MjA2MzM1MDgzNn0.EvUfaVNiDhJqPqHnxBjS_xJxKBJMqTpIn38ILAfv-TI';

// Helper to get session from FirmaVB Supabase
async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

export function useEvaristoStatus() {
  return useQuery({
    queryKey: ['evaristo', 'status'],
    queryFn: async (): Promise<EvaristoStatus> => {
      const session = await getSession();
      
      if (!session) {
        throw new Error('No session - Inicia sesión para acceder a Evaristo');
      }

      // Verificar email autorizado
      if (session.user.email?.toLowerCase() !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${FIRMAVB_URL}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': FIRMAVB_ANON_KEY,
          },
          body: JSON.stringify({ action: 'status' }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to get status' }));
        throw new Error(error.error || 'Failed to get status');
      }
      return response.json();
    },
    refetchInterval: 30000,
    retry: false,
  });
}

export function useEvaristoRevisar() {
  return useMutation({
    mutationFn: async (apiKeys?: { gemini?: string; deepseek?: string }): Promise<EvaristoResponse> => {
      const session = await getSession();
      
      if (!session) {
        throw new Error('No session - Inicia sesión para acceder a Evaristo');
      }

      // Verificar email autorizado
      if (session.user.email?.toLowerCase() !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${FIRMAVB_URL}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': FIRMAVB_ANON_KEY,
          },
          body: JSON.stringify({ 
            action: 'revisar',
            api_keys: apiKeys,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to execute revisar' }));
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
      const session = await getSession();
      
      if (!session) {
        throw new Error('No session - Inicia sesión para acceder a Evaristo');
      }

      // Verificar email autorizado
      if (session.user.email?.toLowerCase() !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${FIRMAVB_URL}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': FIRMAVB_ANON_KEY,
          },
          body: JSON.stringify({ 
            action: 'mision',
            mision_file,
            api_keys,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to execute mision' }));
        throw new Error(error.error || 'Failed to execute mision');
      }

      return response.json();
    },
  });
}
