import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Settings, Lock, ExternalLink, Info, Shield, Key } from 'lucide-react';

export function OdooConfiguration() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuración de Odoo
        </CardTitle>
        <CardDescription>
          Configura las credenciales para conectar con tu instancia de Odoo CRM
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Configuración Segura</AlertTitle>
          <AlertDescription>
            Las credenciales de Odoo se almacenan de forma segura como secrets en el backend. 
            Nunca se exponen en el código del cliente.
          </AlertDescription>
        </Alert>

        {/* Required Secrets */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Key className="h-4 w-4" />
            Secrets Requeridos
          </h4>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                name: 'ODOO_URL',
                description: 'URL de tu instancia Odoo',
                example: 'https://tu-empresa.odoo.com',
              },
              {
                name: 'ODOO_DB',
                description: 'Nombre de la base de datos',
                example: 'tu-empresa-production',
              },
              {
                name: 'ODOO_USER_ID',
                description: 'ID del usuario (número)',
                example: '2',
              },
              {
                name: 'ODOO_PASSWORD',
                description: 'Contraseña o API Key del usuario',
                example: '••••••••••••',
              },
            ].map((secret) => (
              <div 
                key={secret.name}
                className="p-4 rounded-lg border border-border bg-muted/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <code className="text-sm font-mono font-medium text-primary">
                    {secret.name}
                  </code>
                </div>
                <p className="text-sm text-muted-foreground mb-1">
                  {secret.description}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Ejemplo: {secret.example}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-4">
          <h4 className="font-medium text-foreground flex items-center gap-2">
            <Info className="h-4 w-4" />
            Cómo Configurar
          </h4>
          
          <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Obtén las credenciales de Odoo:</strong>
              <ul className="ml-6 mt-1 list-disc list-inside space-y-1">
                <li>URL: La dirección de tu instancia Odoo</li>
                <li>Base de datos: El nombre de la BD (visible en la pantalla de login)</li>
                <li>User ID: Tu ID de usuario en Odoo (ve a Ajustes → Usuarios)</li>
                <li>API Key: Genera una en Odoo → Preferencias → Claves API</li>
              </ul>
            </li>
            <li>
              <strong className="text-foreground">Configura los secrets en Lovable Cloud:</strong>
              <ul className="ml-6 mt-1 list-disc list-inside space-y-1">
                <li>Ve a la configuración del proyecto</li>
                <li>Accede a la sección de Secrets</li>
                <li>Agrega cada secret con su valor correspondiente</li>
              </ul>
            </li>
            <li>
              <strong className="text-foreground">Prueba la conexión:</strong> Usa el botón "Probar Conexión" arriba para verificar
            </li>
          </ol>
        </div>

        {/* Odoo API Documentation Link */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
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

        {/* Tag for Custom Fields */}
        <div className="p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">Campo Personalizado</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            La integración busca oportunidades con el tag <code className="text-primary font-mono">Compra Ágil</code>.
            Asegúrate de crear esta etiqueta en Odoo para filtrar las oportunidades correctamente.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
