import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ExternalLink, ChevronDown, ChevronUp, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLicitaciones, useLicitacionItems, type Licitacion } from '@/hooks/useLicitaciones';

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getEstadoBadge(estado: string | null) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    activa: 'default',
    cerrada: 'secondary',
    adjudicada: 'outline',
    desierta: 'destructive',
  };
  return (
    <Badge variant={variants[estado || 'default'] || 'outline'}>
      {estado || 'Sin estado'}
    </Badge>
  );
}

function LicitacionItems({ licitacionId }: { licitacionId: string }) {
  const { data: items, isLoading } = useLicitacionItems(licitacionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        No hay items para esta licitación
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/30">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs">Producto</TableHead>
            <TableHead className="text-xs">Descripción</TableHead>
            <TableHead className="text-xs text-right">Cantidad</TableHead>
            <TableHead className="text-xs">Unidad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{item.nombre_producto}</TableCell>
              <TableCell className="text-muted-foreground">
                {item.descripcion || '-'}
              </TableCell>
              <TableCell className="text-right">{item.cantidad ?? '-'}</TableCell>
              <TableCell>{item.unidad || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LicitacionRow({ licitacion }: { licitacion: Licitacion }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TableRow className="data-row">
        <TableCell className="font-mono text-xs text-muted-foreground">
          {licitacion.id_licitacion}
        </TableCell>
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
            ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy HH:mm', { locale: es })
            : '-'}
        </TableCell>
        <TableCell>{getEstadoBadge(licitacion.estado)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Package className="h-4 w-4" />
                Ver Items
                {isOpen ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
            {licitacion.link_oficial && (
              <Button variant="ghost" size="icon" asChild>
                <a
                  href={licitacion.link_oficial}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={7} className="p-4 bg-muted/20">
            <LicitacionItems licitacionId={licitacion.id_licitacion} />
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LicitacionesTable() {
  const { data: licitaciones, isLoading, error } = useLicitaciones();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-destructive">
        Error al cargar licitaciones: {error.message}
      </div>
    );
  }

  if (!licitaciones || licitaciones.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay licitaciones disponibles</p>
        <p className="text-sm mt-1">Los datos aparecerán cuando el scraper los envíe</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Organismo</TableHead>
            <TableHead className="text-right">Presupuesto</TableHead>
            <TableHead>Fecha Cierre</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {licitaciones.map((licitacion) => (
            <LicitacionRow key={licitacion.id_licitacion} licitacion={licitacion} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
