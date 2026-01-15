import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Sparkles, AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useLicitacionesNuevas, useAnalizarMatch, type Licitacion } from '@/hooks/useLicitaciones';
import { toast } from 'sonner';
import { clasificarProceso, formatCurrency, montoEnUTM } from '@/utils/clasificacion';
import { Badge } from '@/components/ui/badge';

function LicitacionNuevaRow({ licitacion }: { licitacion: Licitacion }) {
  const analizarMatch = useAnalizarMatch();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalizar = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analizarMatch.mutateAsync(licitacion.id_licitacion);
      toast.success(`¡Match encontrado! Score: ${result.matchScore}%`);
    } catch (error) {
      toast.error('Error al analizar licitación');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {licitacion.id_licitacion}
      </TableCell>
      <TableCell className="font-medium max-w-[250px] truncate">
        {licitacion.titulo}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {licitacion.organismo}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono font-medium">{formatCurrency(licitacion.presupuesto)}</span>
          {licitacion.presupuesto && (() => {
            const clasificacion = clasificarProceso(licitacion.presupuesto);
            const montoUTM = montoEnUTM(licitacion.presupuesto);
            return (
              <Badge 
                variant={clasificacion.tipo === 'compra_agil' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {clasificacion.categoria}
                {montoUTM && ` (${montoUTM.toFixed(1)} UTM)`}
              </Badge>
            );
          })()}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {licitacion.created_at
          ? format(new Date(licitacion.created_at), 'dd MMM yyyy', { locale: es })
          : '-'}
      </TableCell>
      <TableCell>
        {licitacion.fecha_cierre
          ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy', { locale: es })
          : '-'}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {licitacion.estado || 'publicada'}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          onClick={handleAnalizar}
          disabled={isAnalyzing}
          size="sm"
          className="gap-2"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Analizar Match
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function LicitacionesNuevas() {
  const { data: licitaciones, isLoading, error, refetch, isFetching } = useLicitacionesNuevas();
  
  const handleRefresh = () => {
    refetch();
    toast.info('Actualizando licitaciones...');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Compras Ágiles Nuevas
              {licitaciones && licitaciones.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {licitaciones.length} pendientes
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Compras ágiles sin procesar que requieren análisis de match
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            Error al cargar: {error.message}
          </div>
        ) : !licitaciones || licitaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay compras ágiles nuevas</p>
            <p className="text-sm">Las compras ágiles del scraper aparecerán aquí</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Organismo</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead>Publicación</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licitaciones.map((licitacion) => (
                  <LicitacionNuevaRow 
                    key={licitacion.id_licitacion} 
                    licitacion={licitacion}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
