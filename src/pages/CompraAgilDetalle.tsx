// @ts-nocheck
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCompraAgil } from '@/hooks/useComprasAgiles';
import { useLicitacionAsignacion } from '@/hooks/useVendedores';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Clock,
  UserPlus,
  User,
  ExternalLink,
  MapPin,
  Truck,
  Copy,
  CheckCircle2,
  FileText,
  Users,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { format, parseISO, differenceInHours, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { AsignarVendedorModal } from '@/components/compras-agiles/AsignarVendedorModal';
import { cn } from '@/lib/utils';
import { PagadorCard, PagadorBadge, calcularPagadorInfo } from '@/components/shared/PagadorBadge';

function formatCurrency(v: number | null) {
  if (!v) return 'No especificado';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
}

function getMercadoPublicoLink(codigo: string): string {
  return `https://compra-agil.mercadopublico.cl/compra-agil/${codigo}`;
}

export default function CompraAgilDetalle() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const { data: compra, isLoading, error } = useCompraAgil(codigo || null);
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !compra) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">Compra ágil no encontrada</p>
            <p className="text-sm text-muted-foreground mt-1">El código "{codigo}" no existe en el sistema</p>
            <Button onClick={() => navigate('/compras-agiles')} className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fechaCierre = compra.fecha_cierre ? parseISO(compra.fecha_cierre) : null;
  const diasRestantes = fechaCierre ? differenceInDays(fechaCierre, new Date()) : null;
  const isUrgent = diasRestantes !== null && diasRestantes <= 2 && diasRestantes >= 0;
  const estaAbierta = fechaCierre ? fechaCierre > new Date() : true;

  // Obtener asignación
  const { data: asignacion } = useLicitacionAsignacion(compra.id);

  // Extraer datos adicionales de datos_json
  const json = compra.datos_json || {};
  const direccionEntrega = json.direccion_entrega || null;
  const plazoEntrega = json.plazo_entrega || null;
  const rutOrganismo = json.rut_organismo || null;
  const division = json.division || null;
  const cantidadProveedores = json.cantidad_proveedores || json.cantidad_proveedores_invitados || null;
  const multaSancion = json.multa_sancion || null;

  const copyCodigo = () => {
    navigator.clipboard.writeText(compra.codigo);
    setCopied(true);
    toast.success('Código copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const mpLink = getMercadoPublicoLink(compra.codigo);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 space-y-3">
            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="font-mono text-sm cursor-pointer hover:bg-muted gap-1"
                onClick={copyCodigo}
              >
                {compra.codigo}
                {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Badge>

              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                Compra Ágil
              </Badge>

              {estaAbierta ? (
                isUrgent ? (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Urgente - {diasRestantes === 0 ? 'Hoy' : `${diasRestantes}d`}
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    {compra.estado || 'Publicada'}
                  </Badge>
                )
              ) : (
                <Badge variant="secondary">Cerrada</Badge>
              )}

              {compra.match_score > 0 && (
                <Badge className="bg-firmavb-blue/10 text-firmavb-blue border-firmavb-blue/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {compra.match_score}% Match
                </Badge>
              )}

              <PagadorBadge
                info={calcularPagadorInfo({
                  buenPagador: json.buen_pagador,
                  diasPagoPromedio: json.dias_pago_promedio,
                  reclamos12m: json.reclamos_12m,
                })}
                size="md"
              />
            </div>

            {/* Título */}
            <h1 className="text-xl sm:text-2xl font-bold">{compra.nombre}</h1>

            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4" />
                {compra.organismo}
              </span>
              {rutOrganismo && (
                <span className="text-xs">RUT: {rutOrganismo}</span>
              )}
              {division && (
                <span className="text-xs">{division}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(mpLink, '_blank')}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Ver en MercadoPúblico
          </Button>
          <Button
            size="sm"
            onClick={() => setAsignarOpen(true)}
            className="gap-2"
          >
            <UserPlus className="h-4 w-4" />
            {asignacion ? 'Reasignar' : 'Asignar Ejecutivo'}
          </Button>
        </div>
      </div>

      {/* Asignación actual */}
      {asignacion && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Asignado a</p>
                <p className="font-semibold">{asignacion.vendedor_nombre}</p>
                <p className="text-xs text-muted-foreground">{asignacion.vendedor_email}</p>
              </div>
              <Badge className={cn(
                asignacion.estado === 'adjudicada' ? 'bg-green-100 text-green-700' :
                asignacion.estado === 'postulada' ? 'bg-amber-100 text-amber-700' :
                asignacion.estado === 'perdida' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              )}>
                {asignacion.estado}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          {compra.descripcion && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Descripción
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {compra.descripcion}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Items / Productos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Productos Solicitados ({compra.items?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {compra.items && compra.items.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[5%]">#</TableHead>
                      <TableHead className="w-[25%]">Producto</TableHead>
                      <TableHead className="w-[45%]">Descripción</TableHead>
                      <TableHead className="text-right w-[12%]">Cantidad</TableHead>
                      <TableHead className="w-[13%]">Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compra.items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{item.nombre_producto}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.descripcion_producto || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.cantidad}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.unidad || 'EA'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No se encontraron items detallados</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Match Score */}
          {compra.match_encontrado && (
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-4">
                  <Badge variant="default" className="text-lg px-4 py-2 bg-green-600">
                    {compra.match_score}% Match
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Esta compra coincide con productos de tu inventario.
                  </p>
                  <Button variant="outline" size="sm" className="ml-auto gap-2" onClick={() => navigate('/compras-agiles')}>
                    Ver Match Detallado
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Presupuesto */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Presupuesto Estimado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono text-primary">
                {formatCurrency(compra.monto)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{compra.moneda || 'CLP'}</p>
            </CardContent>
          </Card>

          {/* Institución */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comprador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Institución</p>
                  <p className="text-sm font-medium">{compra.organismo}</p>
                </div>
              </div>
              {rutOrganismo && (
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">RUT</p>
                    <p className="text-sm font-mono">{rutOrganismo}</p>
                  </div>
                </div>
              )}
              {division && (
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">División</p>
                    <p className="text-sm">{division}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fechas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fechas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {compra.fecha_publicacion && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Publicación</p>
                    <p className="text-sm">{format(parseISO(compra.fecha_publicacion), "d MMM yyyy, HH:mm", { locale: es })}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Clock className={cn("h-4 w-4 mt-0.5", isUrgent ? "text-red-500" : "text-muted-foreground")} />
                <div>
                  <p className="text-xs text-muted-foreground">Cierre</p>
                  <p className={cn("text-sm font-medium", isUrgent && "text-red-600")}>
                    {fechaCierre
                      ? format(fechaCierre, "d MMM yyyy, HH:mm", { locale: es })
                      : 'No especificada'}
                  </p>
                  {diasRestantes !== null && estaAbierta && (
                    <p className={cn("text-xs mt-0.5", isUrgent ? "text-red-500 font-medium" : "text-muted-foreground")}>
                      {diasRestantes === 0 ? 'Cierra hoy' : `Quedan ${diasRestantes} días`}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comportamiento de Pago - ATRIBUTO DIFERENCIADOR */}
          <PagadorCard
            info={calcularPagadorInfo({
              buenPagador: json.buen_pagador,
              diasPagoPromedio: json.dias_pago_promedio,
              reclamos12m: json.reclamos_12m,
            })}
            organismo={compra.organismo}
          />

          {/* Entrega */}
          {(direccionEntrega || plazoEntrega) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Entrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {direccionEntrega && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Dirección</p>
                      <p className="text-sm">{direccionEntrega}</p>
                    </div>
                  </div>
                )}
                {plazoEntrega && (
                  <div className="flex items-start gap-3">
                    <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Plazo de entrega</p>
                      <p className="text-sm font-medium">{plazoEntrega} días</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Info adicional */}
          {(cantidadProveedores !== null || multaSancion) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Información Adicional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cantidadProveedores !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Proveedores cotizando</span>
                    <Badge variant="secondary">{cantidadProveedores}</Badge>
                  </div>
                )}
                {multaSancion > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Multa/Sanción</span>
                    <Badge variant="destructive">{multaSancion}</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Link directo a MP */}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open(mpLink, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Ver en MercadoPúblico
          </Button>
        </div>
      </div>

      {/* Modal de Asignación */}
      <AsignarVendedorModal
        open={asignarOpen}
        onOpenChange={setAsignarOpen}
        compra={compra}
      />
    </div>
  );
}
