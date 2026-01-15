import { FileSearch, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LicitacionesNuevas } from '@/components/licitaciones/LicitacionesNuevas';
import { LicitacionesConMatch } from '@/components/licitaciones/LicitacionesConMatch';
import { LicitacionesTable } from '@/components/licitaciones/LicitacionesTable';
import { ResumidorBases } from '@/components/licitaciones/ResumidorBases';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAutoMatching } from '@/hooks/useMatching';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function Licitaciones() {
  const queryClient = useQueryClient();
  const { isProcessing, pendingCount, runMatching } = useAutoMatching();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
    queryClient.invalidateQueries({ queryKey: ['compras_agiles'] });
  };

  const handleRunMatching = () => {
    runMatching();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Compras Ágiles
            {isProcessing && (
              <Badge variant="secondary" className="ml-2 animate-pulse">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Analizando con IA...
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Oportunidades de Compra Ágil desde Mercado Público
          </p>
        </div>
        <div className="flex gap-2">
          {pendingCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={handleRunMatching} 
                  disabled={isProcessing}
                  className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Analizar {pendingCount} nuevas
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Analiza {pendingCount} compra{pendingCount > 1 ? 's' : ''} ágil{pendingCount > 1 ? 'es' : ''} nueva{pendingCount > 1 ? 's' : ''} con IA para encontrar matches con tu inventario</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={handleRefresh} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Actualizar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Actualiza la lista de compras ágiles desde MercadoPúblico</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="space-y-6">
        <LicitacionesNuevas />
        <LicitacionesConMatch />
      </div>

      <Tabs defaultValue="todas" className="w-full">
        <TabsList>
          <TabsTrigger value="todas">Todas las Compras Ágiles</TabsTrigger>
          <TabsTrigger value="resumidor">Resumidor IA</TabsTrigger>
        </TabsList>
        <TabsContent value="todas">
          <LicitacionesTable />
        </TabsContent>
        <TabsContent value="resumidor">
          <ResumidorBases />
        </TabsContent>
      </Tabs>
    </div>
  );
}
