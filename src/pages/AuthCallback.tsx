import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseClient } from '@/lib/supabaseClient';
import { Loader2 } from 'lucide-react';

/**
 * Callback de OAuth (Google). Robusto para móvil:
 *  - Soporta PKCE (?code=...) y el flujo implícito (tokens en el hash).
 *  - Escucha onAuthStateChange (la sesión puede establecerse async) además de
 *    reintentar getSession varias veces (los teléfonos son más lentos).
 *  - Si nada resulta en ~8s, vuelve al login con un mensaje claro (no se queda
 *    pegado ni en blanco).
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigate('/dashboard', { replace: true });
    };

    // La sesión puede llegar por el listener (detectSessionInUrl es async).
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    (async () => {
      try {
        // 1) PKCE: si viene ?code=, intercambiarlo por sesión (idempotente).
        const url = new URL(window.location.href);
        if (url.searchParams.get('code')) {
          try { await supabaseClient.auth.exchangeCodeForSession(window.location.href); } catch { /* ya procesado */ }
        }

        // 2) Reintentar getSession + fallback a tokens del hash (flujo implícito).
        for (let i = 0; i < 12 && !done; i++) {
          const { data } = await supabaseClient.auth.getSession();
          if (data.session) { finish(); return; }

          const hp = new URLSearchParams(window.location.hash.substring(1));
          const at = hp.get('access_token');
          const rt = hp.get('refresh_token');
          if (at && rt) {
            const { data: sd } = await supabaseClient.auth.setSession({ access_token: at, refresh_token: rt });
            if (sd.session) { finish(); return; }
          }
          await new Promise((r) => setTimeout(r, 600));
        }

        if (!done) {
          setError('No pudimos completar el inicio de sesión. Intenta de nuevo.');
          setTimeout(() => navigate('/auth', { replace: true }), 2500);
        }
      } catch (err) {
        if (!done) {
          setError('Error durante la autenticación. Intenta de nuevo.');
          setTimeout(() => navigate('/auth', { replace: true }), 2500);
        }
      }
    })();

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-lg">FV</span>
        </div>
        {error ? (
          <>
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground">Redirigiendo al login…</p>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--firmavb-blue))]" />
            <p className="text-muted-foreground">Completando inicio de sesión…</p>
          </>
        )}
      </div>
    </div>
  );
}
