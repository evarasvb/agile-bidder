import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, CheckCircle2, Eye, FileText, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useLicitacionesConMatch, useRechazarLicitacion, useLicitacionItems, type Licitacion } from '@/hooks/useLicitaciones';
import { toast } from 'sonner';

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getScoreBadgeVariant(score: number | null): 'default' | 'secondary' | 'destructive' {
  if (score === null) return 'secondary';
  if (score >= 80) return 'default';
  if (score >= 60) return 'secondary';
  return 'destructive';
}

function LicitacionDetalleDialog({ licitacion }: { licitacion: Licitacion }) {
  const { data: items, isLoading } = useLicitacionItems(licitacion.id_licitacion);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Eye className="h-4 w-4" />
          Ver Detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{licitacion.titulo}</DialogTitle>
          <DialogDescription>
            ID: {licitacion.id_licitacion}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Organismo</p>
              <p className="font-medium">{licitacion.organismo}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Presupuesto</p>
              <p className="font-medium font-mono">{formatCurrency(licitacion.presupuesto)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fecha Cierre</p>
              <p className="font-medium">
                {licitacion.fecha_cierre
                  ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy HH:mm', { locale: es })
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Match Score</p>
              <Badge variant={getScoreBadgeVariant(licitacion.match_score)}>
                {licitacion.match_score}%
              </Badge>
            </div>
          </div>
          
          {licitacion.link_oficial && (
            <div>
              <a
                href={licitacion.link_oficial}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Ver en Mercado Público
              </a>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">Items de la Licitación</h4>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : !items || items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay items asociados</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.nombre_producto}</TableCell>
                        <TableCell className="text-muted-foreground">{item.descripcion || '-'}</TableCell>
                        <TableCell className="text-right">{item.cantidad ?? '-'}</TableCell>
                        <TableCell>{item.unidad || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LicitacionConMatchRow({ licitacion }: { licitacion: Licitacion }) {
  const rechazarLicitacion = useRechazarLicitacion();
  const [isRejecting, setIsRejecting] = useState(false);

  const handleRechazar = async () => {
    setIsRejecting(true);
    try {
      await rechazarLicitacion.mutateAsync(licitacion.id_licitacion);
      toast.success('Licitación rechazada');
    } catch (error) {
      toast.error('Error al rechazar licitación');
    } finally {
      setIsRejecting(false);
    }
  };

  const handleGenerarOferta = () => {
    toast.info('Funcionalidad de generación de oferta próximamente');
  };

  return (
    <TableRow>
      <TableCell className="font-medium max-w-[250px] truncate">
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
        <Badge variant={getScoreBadgeVariant(licitacion.match_score)} className="font-mono">
          {licitacion.match_score}%
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <LicitacionDetalleDialog licitacion={licitacion} />
          <Button
            onClick={handleGenerarOferta}
            size="sm"
            variant="secondary"
            className="gap-1"
          >
            <FileText className="h-4 w-4" />
            Generar Oferta
          </Button>
          <Button
            onClick={handleRechazar}
            disabled={isRejecting}
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isRejecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function LicitacionesConMatch() {
  const { data: licitaciones, isLoading, error } = useLicitacionesConMatch();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          Licitaciones con Match
        </CardTitle>
        <CardDescription>
          Licitaciones que coinciden con tu inventario - listas para ofertar
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
            No hay licitaciones con match aún
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
                  <TableHead>Score</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licitaciones.map((licitacion) => (
                  <LicitacionConMatchRow key={licitacion.id_licitacion} licitacion={licitacion} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
