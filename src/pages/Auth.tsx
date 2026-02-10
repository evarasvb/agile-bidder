// @ts-nocheck
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabaseClient } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Mail, Lock, AlertCircle, ArrowLeft, Sparkles, HelpCircle, Phone, Shield } from 'lucide-react';

// Validation
const emailSchema = z.string().email('Email inválido');
const passwordSchema = z.string().min(6, 'Mínimo 6 caracteres');
const phoneSchema = z.string().regex(/^\+?56\d{9}$/, 'Teléfono chileno inválido (ej: +569XXXXXXXX)');

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, resetPassword, isAuthenticated, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  
  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupPhone, setSignupPhone] = useState('');

  // Verification method choice
  const [verifyMethod, setVerifyMethod] = useState<'email' | 'phone'>('email');

  // OTP states for phone verification
  const [showOTP, setShowOTP] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpPhone, setOtpPhone] = useState('');

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!loginEmail || !loginPassword) {
      setError('Completa todos los campos');
      return;
    }

    const emailResult = emailSchema.safeParse(loginEmail);
    if (!emailResult.success) {
      setError(emailResult.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Tu email no ha sido confirmado. Revisa tu bandeja de entrada (spam también).');
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
    const emailResult = emailSchema.safeParse(signupEmail);
    if (!emailResult.success) {
      setError(emailResult.error.issues[0].message);
      return;
    }

    const pwResult = passwordSchema.safeParse(signupPassword);
    if (!pwResult.success) {
      setError(pwResult.error.issues[0].message);
      return;
    }

    if (signupPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Validate phone if chosen
    if (verifyMethod === 'phone') {
      const formatted = signupPhone.startsWith('+') ? signupPhone : `+56${signupPhone.replace(/^0+/, '')}`;
      const phoneResult = phoneSchema.safeParse(formatted);
      if (!phoneResult.success) {
        setError('Teléfono inválido. Formato: +569XXXXXXXX');
        return;
      }
    }

    setLoading(true);

    if (verifyMethod === 'phone' && signupPhone) {
      // Phone OTP signup
      const formatted = signupPhone.startsWith('+') ? signupPhone : `+56${signupPhone.replace(/^0+/, '')}`;
      try {
        const { error: phoneError } = await supabaseClient.auth.signInWithOtp({
          phone: formatted,
        });
        
        if (phoneError) {
          // If phone auth not configured, fall back to email
          if (phoneError.message.includes('not enabled') || phoneError.message.includes('provider')) {
            setError('Verificación por SMS no disponible aún. Usa verificación por email.');
            setVerifyMethod('email');
            setLoading(false);
            return;
          }
          setError(phoneError.message);
          setLoading(false);
          return;
        }

        // Also create the account with email
        const { error: signupError } = await signUp(signupEmail, signupPassword);
        if (signupError && !signupError.message.includes('already registered')) {
          setError(signupError.message);
          setLoading(false);
          return;
        }

        setOtpPhone(formatted);
        setShowOTP(true);
        setSuccess('Te enviamos un código SMS. Ingrésalo para verificar tu cuenta.');
        setLoading(false);
        return;
      } catch (err: any) {
        setError(err.message || 'Error enviando SMS');
        setLoading(false);
        return;
      }
    }

    // Email signup (default)
    const { error } = await signUp(signupEmail, signupPassword);
    setLoading(false);

    if (error) {
      if (error.message.includes('User already registered')) {
        setError('Este email ya está registrado. Intenta iniciar sesión.');
      } else {
        setError(error.message);
      }
    } else {
      setSuccess('¡Cuenta creada! Revisa tu email para confirmar (mira también en spam).');
      setActiveTab('login');
      setLoginEmail(signupEmail);
      setSignupEmail('');
      setSignupPassword('');
      setConfirmPassword('');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabaseClient.auth.verifyOtp({
        phone: otpPhone,
        token: otpCode,
        type: 'sms',
      });

      if (error) {
        setError('Código inválido. Intenta de nuevo.');
      } else {
        setSuccess('¡Verificación exitosa! Ya puedes iniciar sesión.');
        setShowOTP(false);
        setActiveTab('login');
      }
    } catch (err: any) {
      setError(err.message || 'Error verificando código');
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!resetEmail || !emailSchema.safeParse(resetEmail).success) {
      setError('Ingresa un email válido');
      return;
    }

    setResetLoading(true);
    const { error } = await resetPassword(resetEmail);
    setResetLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess('¡Revisa tu correo! Te enviamos un enlace para restablecer tu contraseña.');
      setResetEmail('');
      setShowForgotPassword(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
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
      <header className="px-4 sm:px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[hsl(var(--firmavb-blue))] to-[hsl(var(--header-dark))] flex items-center justify-center shadow-lg shadow-[hsl(var(--firmavb-blue))]/20">
                <span className="text-white font-bold text-lg">FV</span>
              </div>
              <div className="text-left">
                <span className="font-bold text-foreground text-xl">FirmaVB</span>
                <p className="text-xs text-muted-foreground">Inteligencia para Ganar Más</p>
              </div>
            </div>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center pb-2 px-4 sm:px-6">
              <CardTitle className="text-xl sm:text-2xl">Acceso a tu cuenta</CardTitle>
              <CardDescription className="text-sm">
                Inicia sesión o crea una cuenta para continuar
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {/* Alerts */}
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="mb-4 border-green-300 bg-green-50 dark:bg-green-950/20">
                  <Sparkles className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-300 text-sm">{success}</AlertDescription>
                </Alert>
              )}

              {/* OTP Verification Screen */}
              {showOTP ? (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="text-center mb-4">
                    <Shield className="h-10 w-10 mx-auto text-primary mb-2" />
                    <h3 className="font-semibold text-lg">Verifica tu teléfono</h3>
                    <p className="text-sm text-muted-foreground">Ingresa el código de 6 dígitos enviado a {otpPhone}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Código de verificación</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                      autoFocus
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading || otpCode.length < 6}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verificar Código
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => setShowOTP(false)}>
                    Volver
                  </Button>
                </form>
              ) : (
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'signup'); setError(null); setSuccess(null); }}>
                  <TabsList className="grid w-full grid-cols-2 mb-5">
                    <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                    <TabsTrigger value="signup">Registrarse</TabsTrigger>
                  </TabsList>

                  {/* ===== LOGIN ===== */}
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
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password">Contraseña</Label>
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(true); setError(null); setSuccess(null); }}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <HelpCircle className="h-3 w-3" />
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
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
                            autoComplete="current-password"
                          />
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Iniciando sesión...</> : 'Iniciar Sesión'}
                      </Button>

                      <div className="relative my-5">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                          O continuar con
                        </span>
                      </div>

                      <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading || googleLoading}>
                        {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        )}
                        Google
                      </Button>
                    </form>

                    {/* Forgot Password */}
                    {showForgotPassword && (
                      <div className="mt-4 p-4 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">Recuperar Contraseña</h3>
                          <button type="button" onClick={() => { setShowForgotPassword(false); setResetEmail(''); setError(null); }} className="text-xs text-muted-foreground hover:text-foreground">
                            Cancelar
                          </button>
                        </div>
                        <form onSubmit={handleForgotPassword} className="space-y-3">
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="email"
                              placeholder="tu@email.com"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              className="pl-10 h-9 text-sm"
                              disabled={resetLoading}
                            />
                          </div>
                          <Button type="submit" size="sm" className="w-full" disabled={resetLoading || !resetEmail}>
                            {resetLoading ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Enviando...</> : 'Enviar Enlace de Recuperación'}
                          </Button>
                        </form>
                      </div>
                    )}
                  </TabsContent>

                  {/* ===== SIGNUP ===== */}
                  <TabsContent value="signup">
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            className="pl-10"
                            disabled={loading}
                            autoComplete="email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="Mínimo 6 caracteres"
                            value={signupPassword}
                            onChange={(e) => setSignupPassword(e.target.value)}
                            className="pl-10"
                            disabled={loading}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar Contraseña</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="password"
                            placeholder="Repite tu contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="pl-10"
                            disabled={loading}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      {/* Verification method choice */}
                      <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          ¿Cómo quieres verificar tu cuenta?
                        </Label>
                        <RadioGroup value={verifyMethod} onValueChange={(v) => setVerifyMethod(v as 'email' | 'phone')} className="space-y-2">
                          <div className="flex items-center gap-3 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="email" id="verify-email" />
                            <Label htmlFor="verify-email" className="flex-1 cursor-pointer flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">Email</p>
                                <p className="text-xs text-muted-foreground">Recibirás un enlace en tu correo</p>
                              </div>
                            </Label>
                          </div>
                          <div className="flex items-center gap-3 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                            <RadioGroupItem value="phone" id="verify-phone" />
                            <Label htmlFor="verify-phone" className="flex-1 cursor-pointer flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">SMS</p>
                                <p className="text-xs text-muted-foreground">Recibirás un código por mensaje de texto</p>
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>

                        {verifyMethod === 'phone' && (
                          <div className="space-y-2 pt-1">
                            <Label className="text-xs">Teléfono (Chile)</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                type="tel"
                                inputMode="tel"
                                placeholder="+569XXXXXXXX"
                                value={signupPhone}
                                onChange={(e) => setSignupPhone(e.target.value)}
                                className="pl-10 h-9 text-sm"
                                disabled={loading}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta...</> : 'Crear Cuenta'}
                      </Button>

                      <div className="relative my-5">
                        <Separator />
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                          O continuar con
                        </span>
                      </div>

                      <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading || googleLoading}>
                        {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                        )}
                        Google
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              )}

              <p className="text-center text-xs text-muted-foreground mt-5">
                Al continuar, aceptas nuestros{' '}
                <a href="#" className="text-primary hover:underline">Términos de Servicio</a>{' '}y{' '}
                <a href="#" className="text-primary hover:underline">Política de Privacidad</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
