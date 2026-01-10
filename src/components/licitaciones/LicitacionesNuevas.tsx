import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Sparkles, AlertCircle } from 'lucide-react';
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
import { useLicitacionesNuevas, useAnalizarMatch, type Licitacion } from '@/hooks/useLicitaciones';
import { toast } from 'sonner';

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

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
      <TableCell className="font-medium max-w-[300px] truncate">
        {licitacion.titulo}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {licitacion.organismo}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(licitacion.presupuesto)}
      </TableCell>
      <TableCell>
        {licitacion.fecha_cierre
          ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy', { locale: es })
          : '-'}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Licitaciones Nuevas
        </CardTitle>
        <CardDescription>
          Licitaciones sin procesar que requieren análisis de match
        </CardDescription>
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
          <div className="py-8 text-center text-muted-foreground">
            No hay licitaciones nuevas por procesar
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Organismo</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead>Fecha Cierre</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licitaciones.map((licitacion) => (
                  <LicitacionNuevaRow key={licitacion.id_licitacion} licitacion={licitacion} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
