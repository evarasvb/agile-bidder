// @ts-nocheck
import { useParams, useNavigate } from 'react-router-dom';
import { useCompraAgil } from '@/hooks/useComprasAgiles';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { ArrowLeft, Building2, Calendar, DollarSign, Package, Clock, FileText, Download, Sparkles } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCliente } from '@/hooks/useCliente';
import { descargarFichaTecnicaPDF } from '@/services/fichaTecnicaPdf';

export default function CompraAgilDetalle() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { data: compra, isLoading, error } = useCompraAgil(codigo || null);
  const { data: cliente } = useCliente();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !compra) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Compra ágil no encontrada</p>
            <Button onClick={() => navigate('/compras-agiles')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isUrgent = compra.fecha_cierre && differenceInHours(parseISO(compra.fecha_cierre), new Date()) < 24;

  // Ficha técnica generada por el robot (IA) y guardada en la compra ágil.
  const fichaTecnica = (compra.datos_json as any)?.ficha_tecnica ?? null;

  const descargarFicha = () => {
    if (!fichaTecnica?.fichas?.length) return;
    void descargarFichaTecnicaPDF({
      compra: { codigo: compra.codigo, nombre: compra.nombre, organismo: compra.organismo },
      empresa: {
        nombre: cliente?.empresa_nombre || 'FirmaVB',
        rut: cliente?.rut || undefined,
        direccion: cliente?.direccion || undefined,
        telefono: cliente?.telefono || undefined,
        email: cliente?.email || 'contacto@firmavb.cl',
        logoUrl: cliente?.logo_url || undefined,
      },
      fecha: fichaTecnica.generada_en ? new Date(fichaTecnica.generada_en) : new Date(),
      fichas: fichaTecnica.fichas,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/compras-agiles')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{compra.nombre}</h1>
          <p className="text-sm text-muted-foreground">Código: {compra.codigo}</p>
        </div>
      </div>

      {/* Info General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Organismo</p>
                <p className="font-medium">{compra.organismo}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Presupuesto</p>
                <p className="font-medium">
                  {compra.monto ? `$${compra.monto.toLocaleString('es-CL')}` : 'Sin monto'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className={`h-5 w-5 ${isUrgent ? 'text-red-500' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Fecha Cierre</p>
                <p className={`font-medium ${isUrgent ? 'text-red-600' : ''}`}>
                  {compra.fecha_cierre
                    ? format(parseISO(compra.fecha_cierre), "dd MMM yyyy HH:mm", { locale: es })
                    : 'Sin fecha'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Productos</p>
                <p className="font-medium">{compra.items?.length || 0} items</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Descripción */}
      {compra.descripcion && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Descripción</h2>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{compra.descripcion}</p>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Productos Solicitados</h2>
        </CardHeader>
        <CardContent>
          {compra.items && compra.items.length > 0 ? (
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
                {compra.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nombre_producto}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {item.descripcion_producto}
                    </TableCell>
                    <TableCell className="text-right">{item.cantidad}</TableCell>
                    <TableCell>{item.unidad}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No se encontraron items para esta compra ágil.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Match Score */}
      {compra.match_encontrado && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Match con tu Catálogo</h2>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-lg px-4 py-2">
                {compra.match_score}% Match
              </Badge>
              <p className="text-muted-foreground">
                Esta compra coincide con productos de tu inventario.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ficha técnica (generada por IA y guardada en la compra ágil) */}
      {fichaTecnica?.fichas?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Ficha técnica</h2>
                {fichaTecnica.fuente === 'ia' && (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="h-3 w-3" /> Generada con IA
                  </Badge>
                )}
              </div>
              <Button onClick={descargarFicha} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              {fichaTecnica.fichas.length} producto{fichaTecnica.fichas.length === 1 ? '' : 's'} documentado
              {fichaTecnica.fichas.length === 1 ? '' : 's'}. Lista para descargar y adjuntar en Mercado Público.
            </p>
            <div className="flex flex-wrap gap-2">
              {fichaTecnica.fichas.map((f: any, i: number) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {f.nombre}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
