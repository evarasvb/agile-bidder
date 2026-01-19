import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[AuthCallback] Processing OAuth callback...');
      console.log('[AuthCallback] URL:', window.location.href);

      try {
        // Supabase automatically processes tokens from the hash
        const { data, error } = await supabaseClient.auth.getSession();
        
        if (error) {
          console.error('[AuthCallback] Session error:', error);
          setError(error.message);
          setTimeout(() => navigate('/auth'), 3000);
          return;
        }

        if (data.session) {
          console.log('[AuthCallback] Session established:', data.session.user.email);
          navigate('/dashboard', { replace: true });
          return;
        }

        // Fallback: manually extract tokens if getSession didn't process them
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('[AuthCallback] Manually setting session from tokens...');
          const { data: sessionData, error: sessionError } = 
            await supabaseClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          
          if (sessionError) {
            console.error('[AuthCallback] Set session error:', sessionError);
            setError(sessionError.message);
            setTimeout(() => navigate('/auth'), 3000);
          } else if (sessionData.session) {
            console.log('[AuthCallback] Session set manually:', sessionData.session.user.email);
            navigate('/dashboard', { replace: true });
          }
        } else {
          console.warn('[AuthCallback] No session or tokens found');
          setError('No se encontraron credenciales de autenticación');
          setTimeout(() => navigate('/auth'), 3000);
        }
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err);
        setError('Error inesperado durante la autenticación');
        setTimeout(() => navigate('/auth'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-lg">FV</span>
        </div>
        {error ? (
          <>
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">Redirigiendo al login...</p>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--firmavb-blue))]" />
            <p className="text-muted-foreground">Completando inicio de sesión...</p>
          </>
        )}
      </div>
    </div>
  );
}
