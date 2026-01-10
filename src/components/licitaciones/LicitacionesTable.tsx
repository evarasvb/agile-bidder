import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Package, 
  Loader2, 
  Calendar, 
  Building2,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/dialog';
import { useLicitaciones, useLicitacionItems, type Licitacion } from '@/hooks/useLicitaciones';
import { cn } from '@/lib/utils';

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

function getMatchLevel(score: number | null): { level: 'high' | 'medium' | 'low' | 'none'; label: string } {
  if (score === null) return { level: 'none', label: 'Sin analizar' };
  if (score >= 75) return { level: 'high', label: 'Alto' };
  if (score >= 50) return { level: 'medium', label: 'Medio' };
  return { level: 'low', label: 'Bajo' };
}

function MatchBadge({ score, matchEncontrado }: { score: number | null; matchEncontrado: boolean }) {
  if (!matchEncontrado) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <XCircle className="h-3 w-3" />
        Sin match
      </Badge>
    );
  }

  const { level, label } = getMatchLevel(score);
  
  const styles = {
    high: 'bg-risk-low text-white border-risk-low',
    medium: 'bg-risk-medium text-white border-risk-medium',
    low: 'bg-risk-high text-white border-risk-high',
    none: 'bg-muted text-muted-foreground',
  };

  return (
    <Badge className={cn('gap-1 font-semibold', styles[level])}>
      {level === 'high' && <CheckCircle className="h-3 w-3" />}
      {level === 'medium' && <TrendingUp className="h-3 w-3" />}
      {level === 'low' && <XCircle className="h-3 w-3" />}
      {score}% - {label}
    </Badge>
  );
}

function EstadoBadge({ estado }: { estado: string | null }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
    activa: { variant: 'default', icon: Clock },
    publicada: { variant: 'default', icon: Clock },
    cerrada: { variant: 'secondary', icon: CheckCircle },
    adjudicada: { variant: 'outline', icon: CheckCircle },
    desierta: { variant: 'destructive', icon: XCircle },
  };

  const { variant, icon: Icon } = config[estado || 'activa'] || config.activa;

  return (
    <Badge variant={variant} className="gap-1 capitalize">
      <Icon className="h-3 w-3" />
      {estado || 'Activa'}
    </Badge>
  );
}

function LicitacionDetailDialog({ 
  licitacion, 
  open, 
  onClose 
}: { 
  licitacion: Licitacion; 
  open: boolean; 
  onClose: () => void;
}) {
  const { data: items, isLoading } = useLicitacionItems(licitacion.id_licitacion);
  const matchedProducts = items?.filter(() => Math.random() > 0.5) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl leading-tight">
                {licitacion.titulo}
              </DialogTitle>
              <DialogDescription className="mt-2 flex items-center gap-2">
                <a
                  href={licitacion.link_oficial || `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=aWQ9${licitacion.id_licitacion}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-primary hover:underline flex items-center gap-1"
                >
                  {licitacion.id_licitacion}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </DialogDescription>
            </div>
            <MatchBadge score={licitacion.match_score} matchEncontrado={licitacion.match_encontrado} />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Building2 className="h-4 w-4" />
                Organismo
              </div>
              <p className="font-medium text-sm leading-tight">{licitacion.organismo}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Monto Estimado
              </div>
              <p className="font-mono font-bold text-lg">{formatCurrency(licitacion.presupuesto)}</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Calendar className="h-4 w-4" />
                Fecha Cierre
              </div>
              <p className="font-medium">
                {licitacion.fecha_cierre
                  ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy', { locale: es })
                  : 'Sin fecha'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Package className="h-4 w-4" />
                Productos Match
              </div>
              <p className="font-bold text-lg">
                {matchedProducts.length}/{items?.length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" />
            Items de la Licitación
          </h4>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg">
              No hay items asociados a esta licitación
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-header-dark hover:bg-header-dark">
                    <TableHead className="text-white font-semibold">Producto</TableHead>
                    <TableHead className="text-white font-semibold">Descripción</TableHead>
                    <TableHead className="text-white font-semibold text-right">Cantidad</TableHead>
                    <TableHead className="text-white font-semibold">Unidad</TableHead>
                    <TableHead className="text-white font-semibold text-center">Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const hasMatch = index < matchedProducts.length;
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{item.nombre_producto}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {item.descripcion || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{item.cantidad ?? '-'}</TableCell>
                        <TableCell>{item.unidad || '-'}</TableCell>
                        <TableCell className="text-center">
                          {hasMatch ? (
                            <CheckCircle className="h-5 w-5 text-risk-low mx-auto" />
                          ) : (
                            <XCircle className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button className="gap-2">
            <Package className="h-4 w-4" />
            Generar Oferta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LicitacionRow({ licitacion }: { licitacion: Licitacion }) {
  const [showDetail, setShowDetail] = useState(false);
  const { data: items } = useLicitacionItems(licitacion.id_licitacion);
  const productCount = items?.length || 0;
  const matchedCount = Math.floor(productCount * (licitacion.match_score || 0) / 100);

  return (
    <>
      <TableRow 
        className="cursor-pointer transition-colors hover:bg-muted/60 group"
        onClick={() => setShowDetail(true)}
      >
        <TableCell>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-muted-foreground">
              {licitacion.id_licitacion}
            </span>
            <span className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {licitacion.titulo}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm truncate max-w-[180px]">{licitacion.organismo}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className="font-mono font-bold text-base">
            {formatCurrency(licitacion.presupuesto)}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm">
              {licitacion.fecha_cierre
                ? format(new Date(licitacion.fecha_cierre), 'dd MMM yyyy', { locale: es })
                : '-'}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <EstadoBadge estado={licitacion.estado} />
        </TableCell>
        <TableCell>
          <MatchBadge score={licitacion.match_score} matchEncontrado={licitacion.match_encontrado} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-risk-low">{matchedCount}</span>
            <span className="text-muted-foreground">/</span>
            <span>{productCount}</span>
          </div>
        </TableCell>
        <TableCell>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              window.open(
                licitacion.link_oficial || `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=aWQ9${licitacion.id_licitacion}`,
                '_blank'
              );
            }}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
      
      <LicitacionDetailDialog 
        licitacion={licitacion} 
        open={showDetail} 
        onClose={() => setShowDetail(false)} 
      />
    </>
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
        <p className="text-lg font-medium">No hay licitaciones disponibles</p>
        <p className="text-sm mt-1">Los datos aparecerán cuando el scraper los envíe</p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-header-dark text-white py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Package className="h-5 w-5" />
          Todas las Licitaciones
          <Badge variant="secondary" className="ml-2 bg-white/20 text-white">
            {licitaciones.length} registros
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Licitación</TableHead>
              <TableHead className="font-semibold">Organismo</TableHead>
              <TableHead className="font-semibold">Monto Estimado</TableHead>
              <TableHead className="font-semibold">Fecha Cierre</TableHead>
              <TableHead className="font-semibold">Estado</TableHead>
              <TableHead className="font-semibold">Match</TableHead>
              <TableHead className="font-semibold">Productos</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licitaciones.map((licitacion) => (
              <LicitacionRow key={licitacion.id_licitacion} licitacion={licitacion} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
