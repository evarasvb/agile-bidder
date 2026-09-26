import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabaseClient as supabase } from '@/lib/supabaseClient';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('SignOut error:', error);
      throw error;
    }
    // Sin esto, cualquier query cacheada por React Query (roster del equipo,
    // avisos, cliente_owner_id...) sobrevive al logout en el QueryClient
    // global (que no tiene TTL de sesión) y la siguiente cuenta que se loguee
    // en la misma pestaña puede ver por un instante datos de la cuenta anterior
    // hasta que cada query individual refetchee.
    queryClient.clear();
  }, [queryClient]);

  const resetPassword = useCallback(async (email: string) => {
    // Enviamos el correo de recuperación vía Resend (edge function) para entrega
    // confiable, en vez del mailer interno de Supabase (que necesita SMTP). El
    // enlace aterriza en /auth?reset=true, donde el usuario fija su contraseña.
    try {
      const { error } = await supabase.functions.invoke('reset-password', {
        body: { email, app_url: window.location.origin },
      });
      if (error) throw error;
      return { error: null };
    } catch (err) {
      // Respaldo: si la función falla, usamos el flujo nativo de Supabase.
      const redirectUrl = `${window.location.origin}/auth?reset=true`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      return { error };
    }
  }, []);

  return {
    user,
    session,
    loading,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
