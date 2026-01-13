import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Calendar,
  Building,
  AlertTriangle,
  Download,
  Save,
  Send,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOferta, useActualizarEstadoOferta } from '@/hooks/useOfertas';
import { AsignarVendedorModal } from '@/components/vendedores/AsignarVendedorModal';
import { useLicitacionAsignacion } from '@/hooks/useVendedores';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const estadoConfig: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  revision: { label: 'En Revisión', color: 'bg-warning/10 text-warning' },
  aprobada: { label: 'Aprobada', color: 'bg-success/10 text-success' },
  enviada: { label: 'Enviada', color: 'bg-firmavb-blue/10 text-firmavb-blue' },
  rechazada: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive' },
  ganada: { label: 'Ganada', color: 'bg-success text-success-foreground' },
  perdida: { label: 'Perdida', color: 'bg-muted text-muted-foreground' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function OfertaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: oferta, isLoading } = useOferta(id || null);
  const { data: asignacion } = useLicitacionAsignacion(oferta?.licitacion_id || '');
  const actualizarEstado = useActualizarEstadoOferta();
  const [showAsignarModal, setShowAsignarModal] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!oferta) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-medium">Oferta no encontrada</h2>
        <Button variant="link" onClick={() => navigate('/ofertas')}>
          Volver a ofertas
        </Button>
      </div>
    );
  }

  const { label: estadoLabel, color: estadoColor } = estadoConfig[oferta.estado] || estadoConfig.borrador;
  const presupuesto = oferta.licitacion?.presupuesto || 0;
  const totalNeto = oferta.valor_total_oferta;
  const iva = Math.round(totalNeto * 0.19);
  const totalConIva = totalNeto + iva;
  const excedido = presupuesto > 0 && totalNeto > presupuesto;

  const handleGuardarBorrador = async () => {
    try {
      await actualizarEstado.mutateAsync({
        ofertaId: oferta.id,
        estado: 'borrador',
      });
      toast.success('Borrador guardado');
    } catch (error) {
      toast.error('Error al guardar borrador');
    }
  };

  const handleEnviarOferta = async () => {
    if (excedido) {
      toast.error('La oferta excede el presupuesto de la licitación');
      return;
    }
    try {
      await actualizarEstado.mutateAsync({
        ofertaId: oferta.id,
        estado: 'enviada',
      });
      toast.success('Oferta enviada correctamente');
    } catch (error) {
      toast.error('Error al enviar oferta');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ofertas')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground font-mono">
                {oferta.licitacion?.id_licitacion || 'Sin código'}
              </h1>
              <Badge className={estadoColor}>{estadoLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Oferta generada automáticamente
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowAsignarModal(true)}
            className="border-firmavb-blue text-firmavb-blue hover:bg-firmavb-blue/10"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {asignacion ? 'Reasignar' : 'Asignar responsable'}
          </Button>
        </div>
      </div>

      {/* Alert if over budget */}
      {excedido && (
        <Alert variant="destructive" className="border-firmavb-red bg-firmavb-red/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            La oferta excede el presupuesto estimado de la licitación por{' '}
            {formatCurrency(totalNeto - presupuesto)}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de la Licitación</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Comprador</p>
                  <p className="text-sm font-medium">{oferta.licitacion?.organismo || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de Cierre</p>
                  <p className="text-sm font-medium">
                    {oferta.licitacion?.fecha_cierre
                      ? format(new Date(oferta.licitacion.fecha_cierre), "d 'de' MMMM yyyy, HH:mm", {
                          locale: es,
                        })
                      : '-'}
                  </p>
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground mb-1">Título</p>
                <p className="text-sm">{oferta.licitacion?.titulo || '-'}</p>
              </div>
              {asignacion && (
                <div className="sm:col-span-2 p-3 bg-firmavb-blue/5 rounded-lg">
                  <p className="text-xs text-muted-foreground">Vendedor Asignado</p>
                  <p className="text-sm font-medium">{asignacion.vendedor_nombre}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Items de la Oferta</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Requerimiento</TableHead>
                    <TableHead className="w-[25%]">Tu Oferta</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">P. Unitario</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oferta.productos_ofertados?.map((producto, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <p className="font-medium text-sm">{producto.descripcion || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{producto.nombre_producto}</p>
                        <p className="text-xs text-muted-foreground font-mono">{producto.sku}</p>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {producto.cantidad} {producto.unidad_medida}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(producto.precio_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(producto.precio_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!oferta.productos_ofertados || oferta.productos_ofertados.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No hay productos en esta oferta
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Presupuesto Card */}
          <Card className="border-firmavb-blue/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Presupuesto Licitación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">
                {presupuesto > 0 ? formatCurrency(presupuesto) : 'No especificado'}
              </p>
            </CardContent>
          </Card>

          {/* Totals Card */}
          <Card className={excedido ? 'border-firmavb-red' : 'border-firmavb-blue'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Resumen Oferta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Neto</span>
                <span className="font-mono font-medium">{formatCurrency(totalNeto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">IVA (19%)</span>
                <span className="font-mono">{formatCurrency(iva)}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Total</span>
                <span
                  className={`text-xl font-bold font-mono ${
                    excedido ? 'text-firmavb-red' : 'text-firmavb-blue'
                  }`}
                >
                  {formatCurrency(totalConIva)}
                </span>
              </div>
              {oferta.margen_total > 0 && (
                <div className="flex justify-between pt-2">
                  <span className="text-xs text-muted-foreground">Margen</span>
                  <Badge variant="secondary">{oferta.margen_total}%</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Button variant="outline" className="w-full justify-start" disabled>
                <Download className="mr-2 h-4 w-4" />
                Previsualizar PDF
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={handleGuardarBorrador}
                disabled={actualizarEstado.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Guardar Borrador
              </Button>
              <Button
                className="w-full justify-start bg-firmavb-blue hover:bg-firmavb-blue/90"
                onClick={handleEnviarOferta}
                disabled={actualizarEstado.isPending || oferta.estado === 'enviada'}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar Oferta
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Asignar Vendedor Modal */}
      {oferta.licitacion && (
        <AsignarVendedorModal
          open={showAsignarModal}
          onOpenChange={setShowAsignarModal}
          licitacion={{
            id_licitacion: oferta.licitacion.id_licitacion,
            titulo: oferta.licitacion.titulo,
            organismo: oferta.licitacion.organismo,
            presupuesto: oferta.licitacion.presupuesto,
            fecha_cierre: oferta.licitacion.fecha_cierre,
          }}
        />
      )}
    </div>
  );
}
