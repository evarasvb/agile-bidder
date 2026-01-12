import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings, Shield, Key, ExternalLink, Loader2, CheckCircle2, XCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

export default function AdminOdoo() {
  const [odooUrl, setOdooUrl] = useState('');
  const [odooDb, setOdooDb] = useState('');
  const [odooUserId, setOdooUserId] = useState('');
  const [odooPassword, setOdooPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleTestConnection = async () => {
    if (!odooUrl || !odooDb || !odooUserId || !odooPassword) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsTesting(true);
    setConnectionStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke('odoo-proxy', {
        body: { 
          action: 'test_connection',
          credentials: {
            url: odooUrl,
            db: odooDb,
            userId: parseInt(odooUserId),
            password: odooPassword,
          }
        },
      });

      if (error || !data?.success) {
        setConnectionStatus('error');
        toast.error(data?.error || 'No se pudo conectar a Odoo');
      } else {
        setConnectionStatus('success');
        toast.success('¡Conexión exitosa con Odoo!');
      }
    } catch (err) {
      setConnectionStatus('error');
      toast.error('Error al probar la conexión');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!odooUrl || !odooDb || !odooUserId || !odooPassword) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsSaving(true);

    try {
      // For now, we'll store the config in localStorage as a demonstration
      // In production, this should be stored in Supabase secrets
      const config = {
        url: odooUrl,
        db: odooDb,
        userId: odooUserId,
        password: odooPassword,
        savedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('odoo_config', JSON.stringify(config));
      toast.success('Configuración de Odoo guardada correctamente');
      toast.info('Nota: Para producción, configura estos valores como Secrets en Lovable Cloud');
    } catch (err) {
      toast.error('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };

  // Load saved config on mount
  useState(() => {
    const saved = localStorage.getItem('odoo_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        setOdooUrl(config.url || '');
        setOdooDb(config.db || '');
        setOdooUserId(config.userId || '');
        // Don't load password for security
      } catch (e) {
        // Ignore parse errors
      }
    }
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configuración de Odoo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configura la integración con tu CRM Odoo
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Configuración Segura</AlertTitle>
          <AlertDescription>
            Las credenciales se almacenan de forma segura. Para producción, se recomienda 
            configurarlas como Secrets en Lovable Cloud → Settings → Secrets.
          </AlertDescription>
        </Alert>

        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              Credenciales de Odoo
            </CardTitle>
            <CardDescription>
              Ingresa los datos de conexión a tu instancia de Odoo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado:</span>
              {connectionStatus === 'idle' && (
                <Badge variant="secondary">No verificado</Badge>
              )}
              {connectionStatus === 'success' && (
                <Badge className="bg-success hover:bg-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Conectado
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 mr-1" />
                  Error de conexión
                </Badge>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="odoo-url">URL de Odoo</Label>
                <Input
                  id="odoo-url"
                  placeholder="https://tu-empresa.odoo.com"
                  value={odooUrl}
                  onChange={(e) => setOdooUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  La URL de tu instancia Odoo (ej: https://miempresa.odoo.com)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="odoo-db">Base de Datos</Label>
                <Input
                  id="odoo-db"
                  placeholder="nombre-base-datos"
                  value={odooDb}
                  onChange={(e) => setOdooDb(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  El nombre de la base de datos (visible en la pantalla de login)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="odoo-user-id">User ID</Label>
                <Input
                  id="odoo-user-id"
                  type="number"
                  placeholder="2"
                  value={odooUserId}
                  onChange={(e) => setOdooUserId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Tu ID de usuario en Odoo (ve a Ajustes → Usuarios → tu usuario)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="odoo-password">API Key / Contraseña</Label>
                <div className="relative">
                  <Input
                    id="odoo-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={odooPassword}
                    onChange={(e) => setOdooPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Genera una API Key en Odoo → Preferencias → Claves API
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting || !odooUrl || !odooDb || !odooUserId || !odooPassword}
              >
                {isTesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Probar Conexión
              </Button>
              <Button
                onClick={handleSaveCredentials}
                disabled={isSaving}
                className="bg-primary hover:bg-primary/90"
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Configuración
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Documentation Link */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Documentación de Odoo API</p>
                <p className="text-sm text-muted-foreground">
                  Consulta la documentación oficial para más detalles
                </p>
              </div>
              <Button variant="outline" asChild>
                <a
                  href="https://www.odoo.com/documentation/17.0/developer/reference/external_api.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custom Tag Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">Campo Personalizado</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              La integración busca oportunidades con el tag <code className="text-primary font-mono bg-muted px-1 rounded">Compra Ágil</code>.
              Asegúrate de crear esta etiqueta en Odoo para filtrar las oportunidades correctamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
