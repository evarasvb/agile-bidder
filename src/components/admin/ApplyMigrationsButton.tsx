import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Database, Copy, Check, Play, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ApplyMigrationsButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [sql, setSql] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  const applyMigrationsMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Debes estar autenticado');

      const response = await fetch(`${supabaseUrl}/functions/v1/apply-migrations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Error ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('✅ Migraciones aplicadas exitosamente', {
          description: data.message,
          duration: 5000,
        });
        setIsOpen(false);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        // Si no se pudo aplicar automáticamente, mostrar SQL
        setSql(data.sql || '');
        toast.warning('⚠️ No se pudo aplicar automáticamente', {
          description: 'Copia el SQL y ejecútalo manualmente en Supabase',
          duration: 6000,
        });
      }
    },
    onError: (error: any) => {
      console.error('Error aplicando migraciones:', error);
      toast.error('Error al aplicar migraciones', {
        description: error.message || 'Revisa la consola para más detalles',
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('SQL copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const openSQLEditor = () => {
    if (projectId) {
      window.open(`https://supabase.com/dashboard/project/${projectId}/sql/new`, '_blank');
      toast.info('Abre Supabase SQL Editor. Pega el SQL y ejecútalo.');
    } else {
      window.open('https://supabase.com/dashboard', '_blank');
      toast.info('Ve a tu proyecto en Supabase → SQL Editor.');
    }
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="bg-firmavb-blue/10 hover:bg-firmavb-blue/20 border-firmavb-blue/30"
      >
        <Database className="h-4 w-4 mr-2" />
        Aplicar Migraciones SQL
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-firmavb-blue" />
              Aplicar Migraciones SQL Pendientes
            </DialogTitle>
            <DialogDescription>
              Aplicará las migraciones para crear tablas de órdenes de compra y funciones de limpieza de datos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!sql && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Se intentará aplicar las migraciones automáticamente. Si falla, se mostrará el SQL para ejecutarlo manualmente.
                </AlertDescription>
              </Alert>
            )}

            {sql ? (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No se pudo aplicar automáticamente. Copia el SQL de abajo y ejecútalo en Supabase SQL Editor.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(sql)}
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        SQL Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar SQL
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={openSQLEditor}
                    className="flex-1"
                  >
                    Abrir SQL Editor
                  </Button>
                </div>

                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  <pre className="text-xs">
                    <code>{sql}</code>
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <Button
                onClick={() => applyMigrationsMutation.mutate()}
                disabled={applyMigrationsMutation.isPending}
                className="w-full bg-firmavb-blue hover:bg-firmavb-blue/90"
                size="lg"
              >
                {applyMigrationsMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Aplicando migraciones...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Aplicar Migraciones Automáticamente
                  </>
                )}
              </Button>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Migraciones que se aplicarán:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Funciones para limpiar datos de prueba de compras ágiles</li>
                <li>Tabla <code>ordenes_compra</code> y <code>orden_compra_items</code></li>
                <li>Índices y políticas RLS</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
