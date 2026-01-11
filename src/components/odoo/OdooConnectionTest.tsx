import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, RefreshCw, Zap, Server, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OdooStatus {
  configured: boolean;
  opportunityCount?: number;
  message?: string;
  error?: string;
}

interface OdooConnectionTestProps {
  status: OdooStatus | undefined;
  isLoading: boolean;
  onRefresh: () => void;
}

export function OdooConnectionTest({ status, isLoading, onRefresh }: OdooConnectionTestProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('odoo-proxy', {
        body: { action: 'fetch_opportunities' },
      });

      if (error) {
        setTestResult({
          success: false,
          message: 'Error de conexión',
          details: error.message,
        });
        toast.error('Error al conectar con Odoo');
      } else if (data?.message?.includes('not configured')) {
        setTestResult({
          success: false,
          message: 'No configurado',
          details: 'Las credenciales de Odoo no están configuradas',
        });
        toast.warning('Odoo no está configurado');
      } else {
        setTestResult({
          success: true,
          message: 'Conexión exitosa',
          details: `Se encontraron ${data?.opportunities?.length || 0} oportunidades`,
        });
        toast.success('Conexión con Odoo exitosa');
        onRefresh();
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Error inesperado',
        details: err instanceof Error ? err.message : 'Error desconocido',
      });
      toast.error('Error inesperado al probar conexión');
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado de Conexión</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Server className="h-5 w-5" />
          Estado de Conexión
        </CardTitle>
        <CardDescription>
          Verifica la conexión con tu instancia de Odoo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {status?.configured ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <div>
              <p className="font-medium text-foreground">
                {status?.configured ? 'Conectado' : 'Desconectado'}
              </p>
              {status?.configured && status.opportunityCount !== undefined && (
                <p className="text-sm text-muted-foreground">
                  {status.opportunityCount} oportunidades activas
                </p>
              )}
              {!status?.configured && status?.message && (
                <p className="text-sm text-muted-foreground">
                  {status.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`font-medium ${
                testResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.message}
              </span>
            </div>
            {testResult.details && (
              <p className="text-sm text-muted-foreground ml-6">
                {testResult.details}
              </p>
            )}
          </div>
        )}

        {/* Test Button */}
        <Button 
          onClick={handleTestConnection} 
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Probando conexión...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Probar Conexión
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
