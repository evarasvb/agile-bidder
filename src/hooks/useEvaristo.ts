// Hook para interactuar con Evaristo API
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { supabaseClient as firmavbSupabase } from '@/lib/supabaseClient';

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

// Get the Lovable Cloud Supabase URL for edge functions
const LOVABLE_CLOUD_URL = 'https://euzqadopjvdszcdjegmo.supabase.co';
const LOVABLE_CLOUD_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1enFhZG9wanZkc3pjZGplZ21vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4ODkwNTAsImV4cCI6MjA4MzQ2NTA1MH0.xCowDYXij0nMYO0YNIizOX6PnbBWPVtzS-ypDuVKk-o';

// Helper to get user email from either auth source
async function getUserEmail(): Promise<string | null> {
  // Try Lovable Cloud first
  const { data: { session: cloudSession } } = await supabase.auth.getSession();
  if (cloudSession?.user?.email) {
    return cloudSession.user.email;
  }
  
  // Try FirmaVB Supabase
  const { data: { session: firmavbSession } } = await firmavbSupabase.auth.getSession();
  if (firmavbSession?.user?.email) {
    return firmavbSession.user.email;
  }
  
  return null;
}

// Helper to get auth token - prefer Lovable Cloud, fall back to FirmaVB
async function getAuthToken(): Promise<string | null> {
  // Try Lovable Cloud first
  const { data: { session: cloudSession } } = await supabase.auth.getSession();
  if (cloudSession?.access_token) {
    return cloudSession.access_token;
  }
  
  // Fall back to FirmaVB session token
  const { data: { session: firmavbSession } } = await firmavbSupabase.auth.getSession();
  return firmavbSession?.access_token || null;
}

export function useEvaristoStatus() {
  return useQuery({
    queryKey: ['evaristo', 'status'],
    queryFn: async (): Promise<EvaristoStatus> => {
      const token = await getAuthToken();
      const userEmail = await getUserEmail();
      
      if (!token) {
        throw new Error('No session - Inicia sesión para acceder a Evaristo');
      }

      // Verificar email autorizado (client-side check for UX)
      if (userEmail?.toLowerCase() !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${LOVABLE_CLOUD_URL}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': LOVABLE_CLOUD_ANON_KEY,
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
      const token = await getAuthToken();
      const userEmail = await getUserEmail();
      
      if (!token) {
        throw new Error('No session - Inicia sesión para acceder a Evaristo');
      }

      // Verificar email autorizado (client-side check for UX)
      if (userEmail?.toLowerCase() !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${LOVABLE_CLOUD_URL}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': LOVABLE_CLOUD_ANON_KEY,
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
      const token = await getAuthToken();
      const userEmail = await getUserEmail();
      
      if (!token) {
        throw new Error('No session - Inicia sesión para acceder a Evaristo');
      }

      // Verificar email autorizado (client-side check for UX)
      if (userEmail?.toLowerCase() !== 'evaras@firmavb.cl') {
        throw new Error('Unauthorized: Solo el administrador autorizado puede acceder');
      }

      const response = await fetch(
        `${LOVABLE_CLOUD_URL}/functions/v1/evaristo-api`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'apikey': LOVABLE_CLOUD_ANON_KEY,
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
