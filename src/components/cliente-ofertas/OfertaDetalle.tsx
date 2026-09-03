import { useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  FileDown,
  FileText,
  Save,
  User,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ClienteOferta, useActualizarEstadoOfertaCliente } from '@/hooks/useClienteOfertas';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { IVA_RATE } from '@/lib/constants';

interface OfertaDetalleProps {
  oferta: ClienteOferta;
  onClose: () => void;
}

const estadoConfig: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-gray-500' },
  revision: { label: 'En Revisión', color: 'bg-blue-500' },
  aprobada: { label: 'Aprobada', color: 'bg-green-500' },
  enviada: { label: 'Enviada', color: 'bg-purple-500' },
  rechazada: { label: 'Rechazada', color: 'bg-red-500' },
};

export function OfertaDetalle({ oferta, onClose }: OfertaDetalleProps) {
  const { toast } = useToast();
  const actualizarEstado = useActualizarEstadoOfertaCliente();

  const presupuesto = oferta.licitacion?.presupuesto || 0;
  const valorNeto = oferta.valor_total || 0;
  const iva = valorNeto * IVA_RATE;
  const valorTotal = valorNeto + iva;
  const excedePresupuesto = presupuesto > 0 && valorNeto > presupuesto;
  const diferenciaPresupuesto = valorNeto - presupuesto;

  const estadoInfo = estadoConfig[oferta.estado] || estadoConfig.borrador;

  const handleAprobar = async () => {
    try {
      await actualizarEstado.mutateAsync({
        ofertaId: oferta.id,
        estado: 'aprobada',
        notas: 'Cotización aprobada por el cliente',
      });
    } catch (error) {
      console.error('Error al aprobar:', error);
    }
  };

  const handleGuardarBorrador = async () => {
    try {
      await actualizarEstado.mutateAsync({
        ofertaId: oferta.id,
        estado: 'borrador',
      });
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  };

  const handlePrevisualizarPDF = () => {
    toast({
      title: 'Vista previa PDF',
      description: 'Funcionalidad próximamente disponible',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-4 md:inset-8 lg:inset-12 bg-background border rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${estadoInfo.color}`} />
            <div>
              <h2 className="font-semibold text-lg">
                {oferta.licitacion?.id_licitacion || 'Oferta'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Estado: {estadoInfo.label}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Warning si excede presupuesto */}
          {excedePresupuesto && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-700">Esta oferta excede el presupuesto</p>
                <p className="text-sm text-yellow-600">
                  La oferta supera el presupuesto en ${diferenciaPresupuesto.toLocaleString('es-CL')} CLP
                </p>
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Comprador */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Información del Comprador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Entidad Compradora</p>
                  <p className="font-medium">{oferta.licitacion?.organismo || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado Licitación</p>
                  <Badge variant="outline">
                    {oferta.licitacion?.estado || 'Abierta'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Fechas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Fechas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Publicación</span>
                  <span>
                    {oferta.licitacion?.created_at
                      ? format(new Date(oferta.licitacion.created_at), 'dd/MM/yyyy', { locale: es })
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cierre</span>
                  <span className="font-medium text-destructive">
                    {oferta.licitacion?.fecha_cierre
                      ? format(new Date(oferta.licitacion.fecha_cierre), 'dd/MM/yyyy HH:mm', { locale: es })
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Oferta Creada</span>
                  <span>
                    {format(new Date(oferta.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Presupuesto vs Oferta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Presupuesto Licitación</p>
                  <p className="text-xl font-bold">
                    ${presupuesto.toLocaleString('es-CL')}
                  </p>
                </div>
                <div className={`text-center p-4 rounded-lg ${excedePresupuesto ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
                  <p className="text-sm text-muted-foreground mb-1">Total Tu Oferta</p>
                  <p className={`text-xl font-bold ${excedePresupuesto ? 'text-yellow-600' : 'text-green-600'}`}>
                    ${valorNeto.toLocaleString('es-CL')}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Margen Total</p>
                  <p className="text-xl font-bold text-primary">
                    {oferta.margen_total || 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Descripción */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Descripción de la Licitación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {oferta.licitacion?.titulo || 'Sin descripción disponible'}
              </p>
            </CardContent>
          </Card>

          {/* Tabla de items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalle de Productos Ofertados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Requerimiento</TableHead>
                      <TableHead>Tu Oferta</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead className="text-center">Unidad</TableHead>
                      <TableHead className="text-right">Precio Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oferta.productos_ofertados.length > 0 ? (
                      oferta.productos_ofertados.map((producto, index) => (
                        <TableRow key={producto.inventory_id || index}>
                          <TableCell className="font-medium text-sm">
                            {producto.descripcion || producto.nombre_producto}
                          </TableCell>
                          <TableCell className="text-sm">
                            {producto.nombre_producto}
                            <span className="text-xs text-muted-foreground block">
                              SKU: {producto.sku}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{producto.cantidad}</TableCell>
                          <TableCell className="text-center">{producto.unidad_medida}</TableCell>
                          <TableCell className="text-right">
                            ${producto.precio_unitario.toLocaleString('es-CL')}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${producto.precio_total.toLocaleString('es-CL')}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No hay productos ofertados
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totales */}
              <div className="mt-4 space-y-2 max-w-xs ml-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Neto</span>
                  <span>${valorNeto.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span>${iva.toLocaleString('es-CL')}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">${valorTotal.toLocaleString('es-CL')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notas */}
          {oferta.notas && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {oferta.notas}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer con acciones */}
        <div className="border-t p-4 bg-muted/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevisualizarPDF}>
              <FileDown className="w-4 h-4 mr-2" />
              Previsualizar PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGuardarBorrador}
              disabled={actualizarEstado.isPending || oferta.estado === 'borrador'}
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar Borrador
            </Button>
          </div>
          <Button
            size="sm"
            onClick={handleAprobar}
            disabled={actualizarEstado.isPending || oferta.estado === 'aprobada' || oferta.estado === 'enviada'}
            className="bg-green-600 hover:bg-green-700"
          >
            {actualizarEstado.isPending ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Aprobar Cotización
          </Button>
        </div>
      </div>
    </div>
  );
}
