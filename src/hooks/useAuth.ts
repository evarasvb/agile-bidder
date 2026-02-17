import { useState, useEffect, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabaseClient as supabase } from '@/lib/supabaseClient';
import { logErrorToSupabase } from '@/lib/supabaseErrorHandler';

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
  refreshSession: () => Promise<void>;
}

// Session timeout: 24 hours
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);

  // Refresh session function
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
        await logErrorToSupabase(error, 'warning', { context: 'useAuth.refreshSession' });
        // If refresh fails, sign out
        await supabase.auth.signOut();
        return;
      }
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (error) {
      console.error('Unexpected error refreshing session:', error);
    }
  }, []);

  // Setup session timeout
  const setupSessionTimeout = useCallback((currentSession: Session | null) => {
    // Clear existing timer
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }

    if (!currentSession) {
      setSessionTimer(null);
      return;
    }

    // Calculate time until session expires
    const expiresAt = new Date(currentSession.expires_at || 0).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000);

    const timer = setTimeout(() => {
      refreshSession();
    }, refreshTime);

    setSessionTimer(timer);
  }, [sessionTimer, refreshSession]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Setup session timeout
        if (currentSession) {
          setupSessionTimeout(currentSession);
        }

        // Handle token refresh
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        }

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          if (sessionTimer) {
            clearTimeout(sessionTimer);
          }
          setSessionTimer(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);

      if (currentSession) {
        setupSessionTimeout(currentSession);
      }
    });

    // Cleanup
    return () => {
      subscription.unsubscribe();
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [setupSessionTimeout]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        await logErrorToSupabase(error, 'warning', { context: 'useAuth.signIn', email });
      }
      return { error };
    } catch (error) {
      console.error('SignIn error:', error);
      return { error: error as AuthError };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) {
        await logErrorToSupabase(error, 'warning', { context: 'useAuth.signUp', email });
      }
      return { error };
    } catch (error) {
      console.error('SignUp error:', error);
      return { error: error as AuthError };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('SignOut error:', error);
        await logErrorToSupabase(error, 'warning', { context: 'useAuth.signOut' });
        throw error;
      }
      // Clear session timer
      if (sessionTimer) {
        clearTimeout(sessionTimer);
        setSessionTimer(null);
      }
    } catch (error) {
      console.error('SignOut error:', error);
      throw error;
    }
  }, [sessionTimer]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth?reset=true`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        await logErrorToSupabase(error, 'warning', { context: 'useAuth.resetPassword', email });
      }
      return { error };
    } catch (error) {
      console.error('ResetPassword error:', error);
      return { error: error as AuthError };
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
    refreshSession,
  };
}
