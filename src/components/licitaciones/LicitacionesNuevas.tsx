import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Sparkles, AlertCircle, Database } from 'lucide-react';
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
import { mockLicitaciones } from '@/data/mockLicitaciones';
import { toast } from 'sonner';

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function LicitacionNuevaRow({ licitacion, isMock = false }: { licitacion: Licitacion; isMock?: boolean }) {
  const analizarMatch = useAnalizarMatch();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalizar = async () => {
    if (isMock) {
      setIsAnalyzing(true);
      // Simulate API call for mock data
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockScore = Math.floor(Math.random() * 40) + 60; // 60-99
      toast.success(`¡Match encontrado! Score: ${mockScore}%`);
      setIsAnalyzing(false);
      return;
    }
    
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
      <TableCell className="text-right font-mono">
        {formatCurrency(licitacion.presupuesto)}
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
  const { data: licitaciones, isLoading, error } = useLicitacionesNuevas();
  
  // Use mock data if no real data is available
  const hasRealData = licitaciones && licitaciones.length > 0;
  const displayData = hasRealData ? licitaciones : mockLicitaciones;
  const isMockData = !hasRealData;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Licitaciones Nuevas
            </CardTitle>
            <CardDescription>
              Licitaciones sin procesar que requieren análisis de match
            </CardDescription>
          </div>
          {isMockData && !isLoading && (
            <Badge variant="secondary" className="gap-1">
              <Database className="h-3 w-3" />
              Datos de prueba
            </Badge>
          )}
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
                {displayData.map((licitacion) => (
                  <LicitacionNuevaRow 
                    key={licitacion.id_licitacion} 
                    licitacion={licitacion}
                    isMock={isMockData}
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
