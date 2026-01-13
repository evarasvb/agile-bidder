import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, AlertCircle, ArrowLeft, Sparkles } from 'lucide-react';

// Validation schemas
const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'La contraseña debe tener al menos 6 caracteres');

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es requerida'),
});

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, isAuthenticated, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      // Handle specific error messages
      if (error.message.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Tu email no ha sido confirmado. Revisa tu bandeja de entrada.');
      } else {
        setError(error.message);
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate
    const result = signupSchema.safeParse({ 
      email: signupEmail, 
      password: signupPassword,
      confirmPassword 
    });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword);
    setLoading(false);

    if (error) {
      if (error.message.includes('User already registered')) {
        setError('Este email ya está registrado. Intenta iniciar sesión.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
      setActiveTab('login');
      setLoginEmail(signupEmail);
      setSignupEmail('');
      setSignupPassword('');
      setConfirmPassword('');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al inicio</span>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg shadow-[hsl(var(--firmavb-blue))]/20">
                <span className="text-white font-bold text-lg">FV</span>
              </div>
              <div className="text-left">
                <span className="font-bold text-foreground text-xl">FirmaVB</span>
                <p className="text-xs text-muted-foreground">Inteligencia para Ganar Más</p>
              </div>
            </div>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Acceso a tu cuenta</CardTitle>
              <CardDescription>
                Inicia sesión o crea una cuenta para continuar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                  <TabsTrigger value="signup">Registrarse</TabsTrigger>
                </TabsList>

                {/* Error/Success alerts */}
                {error && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert className="mb-4 border-[hsl(var(--success))] bg-[hsl(var(--success))]/10">
                    <Sparkles className="h-4 w-4 text-[hsl(var(--success))]" />
                    <AlertDescription className="text-[hsl(var(--success))]">{success}</AlertDescription>
                  </Alert>
                )}

                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="tu@email.com"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="pl-10"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-[hsl(var(--firmavb-blue))] hover:bg-[hsl(var(--firmavb-blue))]/90"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Iniciando sesión...
                        </>
                      ) : (
                        'Iniciar Sesión'
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Signup Tab */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="tu@email.com"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          className="pl-10"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          className="pl-10"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type="password"
                          placeholder="Repite tu contraseña"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full bg-[hsl(var(--firmavb-blue))] hover:bg-[hsl(var(--firmavb-blue))]/90"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando cuenta...
                        </>
                      ) : (
                        'Crear Cuenta'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Al continuar, aceptas nuestros{' '}
                <a href="#" className="text-[hsl(var(--firmavb-blue))] hover:underline">
                  Términos de Servicio
                </a>{' '}
                y{' '}
                <a href="#" className="text-[hsl(var(--firmavb-blue))] hover:underline">
                  Política de Privacidad
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
