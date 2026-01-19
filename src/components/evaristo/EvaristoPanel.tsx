// Panel de control para Evaristo
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEvaristoStatus, useEvaristoRevisar, useEvaristoMision } from '@/hooks/useEvaristo';
import { Bot, Play, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export function EvaristoPanel() {
  const { data: status, isLoading: statusLoading } = useEvaristoStatus();
  const revisar = useEvaristoRevisar();
  const mision = useEvaristoMision();
  
  const [misionFile, setMisionFile] = useState('mision_completa_firmavb.json');
  const [output, setOutput] = useState('');

  const handleRevisar = async () => {
    try {
      const result = await revisar.mutateAsync();
      setOutput(result.message);
      
      if (result.success) {
        toast.success('✅ Evaristo completó la revisión');
      } else {
        toast.error('❌ Error en la revisión');
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      setOutput(error.message);
    }
  };

  const handleMision = async () => {
    try {
      const result = await mision.mutateAsync({ mision_file: misionFile });
      setOutput(result.message);
      
      if (result.success) {
        toast.success('✅ Misión completada');
      } else {
        toast.error('❌ Error en la misión');
      }
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
      setOutput(error.message);
    }
  };

  const isLoading = revisar.isPending || mision.isPending;

  return (
    <div className="space-y-6">
      <Card className="border-firmavb-blue/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-firmavb-blue" />
            Evaristo - Control Panel
          </CardTitle>
          <CardDescription>
            Ejecuta Evaristo para mantener y mejorar el código (frontend-only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Estado:</span>
            {statusLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status?.status === 'online' ? (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Offline
              </Badge>
            )}
            {status?.is_authorized && (
              <Badge variant="outline" className="text-xs">
                ✓ Autorizado
              </Badge>
            )}
          </div>

          {/* User info */}
          {status?.user_email && (
            <div className="text-sm text-muted-foreground">
              Usuario: {status.user_email}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleRevisar}
              disabled={isLoading}
              className="bg-firmavb-blue hover:bg-firmavb-blue/90"
            >
              {revisar.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Revisar Proyecto
            </Button>
            
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="mision_completa_firmavb.json"
                value={misionFile}
                onChange={(e) => setMisionFile(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleMision}
                disabled={isLoading || !misionFile}
                variant="outline"
                className="border-firmavb-blue text-firmavb-blue hover:bg-firmavb-blue/10"
              >
                {mision.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Ejecutar Misión
              </Button>
            </div>
          </div>

          {/* Output */}
          {output && (
            <div>
              <Label>Salida de Evaristo</Label>
              <ScrollArea className="h-64 w-full rounded-md border p-4 bg-muted/50">
                <pre className="text-xs font-mono whitespace-pre-wrap">{output}</pre>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
