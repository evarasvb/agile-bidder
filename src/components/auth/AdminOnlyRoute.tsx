// Ruta protegida solo para administrador específico (evaras@firmavb.cl)
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminOnlyRouteProps {
  children: ReactNode;
  allowedEmails?: string[]; // Lista de emails permitidos
}

const DEFAULT_ALLOWED_EMAILS = ['evaras@firmavb.cl'];

export function AdminOnlyRoute({ 
  children, 
  allowedEmails = DEFAULT_ALLOWED_EMAILS 
}: AdminOnlyRouteProps) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">FV</span>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const userEmail = user?.email?.toLowerCase() || '';
  const isAllowed = allowedEmails.some(email => email.toLowerCase() === userEmail);

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full border-firmavb-red/20">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-firmavb-red/10 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-firmavb-red" />
              </div>
              <div>
                <CardTitle className="text-firmavb-red">Acceso Restringido</CardTitle>
                <CardDescription>
                  Esta sección es solo para administradores autorizados
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No tienes permiso para acceder a esta sección. Si crees que esto es un error, 
              contacta al administrador del sistema.
            </p>
            <p className="text-xs text-muted-foreground mt-4">
              Email actual: <span className="font-mono">{userEmail || 'No disponible'}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
