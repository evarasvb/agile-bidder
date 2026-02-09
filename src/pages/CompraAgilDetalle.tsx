// @ts-nocheck
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompraAgil } from '@/hooks/useComprasAgiles';
import { useLicitacionAsignacion } from '@/hooks/useVendedores';
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
import { ArrowLeft, Building2, Calendar, DollarSign, Package, Clock, UserPlus, User } from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { AsignarVendedorModal } from '@/components/compras-agiles/AsignarVendedorModal';

export default function CompraAgilDetalle() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { data: compra, isLoading, error } = useCompraAgil(codigo || null);
  const [asignarOpen, setAsignarOpen] = useState(false);

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
  const { data: asignacion } = useLicitacionAsignacion(compra.id);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/compras-agiles')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{compra.nombre}</h1>
            <p className="text-sm text-muted-foreground">Código: {compra.codigo}</p>
          </div>
        </div>
        <Button onClick={() => setAsignarOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {asignacion ? 'Reasignar' : 'Asignar Ejecutivo'}
        </Button>
      </div>

      {/* Asignación actual */}
      {asignacion && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Asignado a</p>
                <p className="font-semibold text-lg">{asignacion.vendedor_nombre}</p>
                <p className="text-xs text-muted-foreground">{asignacion.vendedor_email}</p>
              </div>
              <Badge
                className={
                  asignacion.estado === 'adjudicada'
                    ? 'bg-green-100 text-green-700'
                    : asignacion.estado === 'postulada'
                    ? 'bg-amber-100 text-amber-700'
                    : asignacion.estado === 'perdida'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
                }
              >
                {asignacion.estado}
              </Badge>
              {asignacion.notas && (
                <p className="text-sm text-muted-foreground max-w-xs truncate" title={asignacion.notas}>
                  {asignacion.notas}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Modal de Asignación */}
      <AsignarVendedorModal
        open={asignarOpen}
        onOpenChange={setAsignarOpen}
        compra={compra}
      />
    </div>
  );
}
