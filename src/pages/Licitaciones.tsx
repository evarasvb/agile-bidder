import { FileSearch, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LicitacionesNuevas } from '@/components/licitaciones/LicitacionesNuevas';
import { LicitacionesConMatch } from '@/components/licitaciones/LicitacionesConMatch';
import { LicitacionesTable } from '@/components/licitaciones/LicitacionesTable';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Licitaciones() {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['licitaciones'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSearch className="h-6 w-6 text-primary" />
            Licitaciones
          </h1>
          <p className="text-muted-foreground mt-1">
            Oportunidades de Compra Ágil desde Mercado Público
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="space-y-6">
        <LicitacionesNuevas />
        <LicitacionesConMatch />
      </div>

      <Tabs defaultValue="todas" className="w-full">
        <TabsList>
          <TabsTrigger value="todas">Todas las Licitaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="todas">
          <LicitacionesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
