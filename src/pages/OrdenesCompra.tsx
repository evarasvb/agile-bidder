import { useState } from "react";
import { useOrdenesCompra, useOrdenCompra, type OrdenCompra, type OrdenCompraItem } from "@/hooks/useOrdenesCompra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, Building2, User, Calendar, DollarSign, Package, X, Filter } from "lucide-react";
import { formatCurrency } from "@/utils/clasificacion";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function OrdenesCompra() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroRut, setFiltroRut] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Construir filtros
  const filters = {
    ...(searchTerm && { search: searchTerm }),
    ...(filtroRut && { institucion_rut: filtroRut, proveedor_rut: filtroRut }),
    ...(filtroNombre && { institucion_nombre: filtroNombre, proveedor_nombre: filtroNombre }),
    ...(filtroEstado && { estado: filtroEstado }),
  };

  const { data: ordenes = [], isLoading } = useOrdenesCompra(
    Object.keys(filters).length > 0 ? filters : undefined,
    false // No cargar items en el listado inicial
  );

  const { data: ordenDetalle, isLoading: isLoadingDetalle } = useOrdenCompra(
    ordenSeleccionada,
    true // Cargar items del detalle
  );

  const limpiarFiltros = () => {
    setSearchTerm("");
    setFiltroRut("");
    setFiltroNombre("");
    setFiltroEstado("");
  };

  const tieneFiltros = searchTerm || filtroRut || filtroNombre || filtroEstado;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
            Órdenes de Compra
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y consulta todas las órdenes de compra con detalle completo
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-firmavb-blue/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5 text-firmavb-blue" />
              Filtros de Búsqueda
            </CardTitle>
            {tieneFiltros && (
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                <X className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda general */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, nombre, RUT de institución o proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros avanzados */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">RUT (Institución o Proveedor)</label>
              <Input
                placeholder="Ej: 12.345.678-9"
                value={filtroRut}
                onChange={(e) => setFiltroRut(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Nombre (Institución o Proveedor)</label>
              <Input
                placeholder="Nombre de institución o proveedor"
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Estado</label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="enviada">Enviada</option>
                <option value="aceptada">Aceptada</option>
                <option value="rechazada">Rechazada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de órdenes */}
      <Card className="border-firmavb-blue/10">
        <CardHeader className="pb-3 bg-gradient-to-r from-firmavb-blue/5 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-firmavb-blue" />
            Órdenes de Compra
            <Badge variant="secondary" className="ml-2">{ordenes.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : ordenes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
              <p className="text-muted-foreground font-medium">No se encontraron órdenes de compra</p>
              <p className="text-sm text-muted-foreground mt-1">
                {tieneFiltros ? "Intenta ajustar los filtros de búsqueda" : "Aún no hay órdenes de compra registradas"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Código</TableHead>
                    <TableHead className="font-semibold">Nombre</TableHead>
                    <TableHead className="font-semibold">Institución</TableHead>
                    <TableHead className="font-semibold">Proveedor</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                    <TableHead className="font-semibold">Fecha</TableHead>
                    <TableHead className="font-semibold">Estado</TableHead>
                    <TableHead className="font-semibold text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((orden) => (
                    <TableRow
                      key={orden.id}
                      className="cursor-pointer hover:bg-firmavb-blue/5 transition-colors"
                    >
                      <TableCell className="font-mono text-sm font-medium">
                        {orden.codigo}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="truncate" title={orden.nombre || ''}>
                          {orden.nombre || 'Sin nombre'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate max-w-[200px]" title={orden.institucion_nombre || ''}>
                              {orden.institucion_nombre || 'N/A'}
                            </span>
                          </div>
                          {orden.institucion_rut && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {orden.institucion_rut}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-sm">
                            <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate max-w-[200px]" title={orden.proveedor_nombre || ''}>
                              {orden.proveedor_nombre || 'N/A'}
                            </span>
                          </div>
                          {orden.proveedor_rut && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {orden.proveedor_rut}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {orden.total ? formatCurrency(orden.total) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {orden.fecha_creacion ? (
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span>
                              {format(parseISO(orden.fecha_creacion), "dd MMM yyyy", { locale: es })}
                            </span>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            orden.estado === 'aceptada' ? 'success' :
                            orden.estado === 'rechazada' ? 'destructive' :
                            orden.estado === 'enviada' ? 'default' :
                            'secondary'
                          }
                        >
                          {orden.estado || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setOrdenSeleccionada(orden.codigo)}
                            >
                              Ver Detalle
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-firmavb-blue" />
                                Detalle de Orden de Compra
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] pr-4">
                              {isLoadingDetalle ? (
                                <div className="space-y-4">
                                  <Skeleton className="h-20 w-full" />
                                  <Skeleton className="h-40 w-full" />
                                </div>
                              ) : ordenDetalle ? (
                                <OrdenCompraDetalle orden={ordenDetalle} />
                              ) : (
                                <p className="text-muted-foreground">No se pudo cargar el detalle</p>
                              )}
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrdenCompraDetalle({ orden }: { orden: OrdenCompra }) {
  return (
    <div className="space-y-6">
      {/* Información general */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Código</label>
              <p className="font-mono font-medium">{orden.codigo}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Estado</label>
              <div>
                <Badge
                  variant={
                    orden.estado === 'aceptada' ? 'success' :
                    orden.estado === 'rechazada' ? 'destructive' :
                    orden.estado === 'enviada' ? 'default' :
                    'secondary'
                  }
                >
                  {orden.estado || 'N/A'}
                </Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Nombre</label>
              <p>{orden.nombre || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total</label>
              <p className="font-semibold text-lg">
                {orden.total ? formatCurrency(orden.total) : 'N/A'}
              </p>
            </div>
          </div>

          {orden.descripcion && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Descripción</label>
              <p className="text-sm">{orden.descripcion}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Institución */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-firmavb-blue" />
            Institución
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nombre</label>
            <p>{orden.institucion_nombre || 'N/A'}</p>
          </div>
          {orden.institucion_rut && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">RUT</label>
              <p className="font-mono">{orden.institucion_rut}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proveedor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-firmavb-blue" />
            Proveedor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Nombre</label>
            <p>{orden.proveedor_nombre || 'N/A'}</p>
          </div>
          {orden.proveedor_rut && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">RUT</label>
              <p className="font-mono">{orden.proveedor_rut}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fechas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-firmavb-blue" />
            Fechas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {orden.fecha_creacion && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Creación</label>
              <p className="text-sm">
                {format(parseISO(orden.fecha_creacion), "dd MMM yyyy HH:mm", { locale: es })}
              </p>
            </div>
          )}
          {orden.fecha_envio && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Envío</label>
              <p className="text-sm">
                {format(parseISO(orden.fecha_envio), "dd MMM yyyy HH:mm", { locale: es })}
              </p>
            </div>
          )}
          {orden.fecha_aceptacion && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Aceptación</label>
              <p className="text-sm">
                {format(parseISO(orden.fecha_aceptacion), "dd MMM yyyy HH:mm", { locale: es })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      {orden.items && orden.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-firmavb-blue" />
              Productos ({orden.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Producto</TableHead>
                    <TableHead className="font-semibold">Descripción</TableHead>
                    <TableHead className="font-semibold text-right">Cantidad</TableHead>
                    <TableHead className="font-semibold">Unidad</TableHead>
                    <TableHead className="font-semibold text-right">Precio Unit.</TableHead>
                    <TableHead className="font-semibold text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orden.items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_index}</TableCell>
                      <TableCell className="font-medium max-w-[200px]">
                        <div className="truncate" title={item.nombre_producto || ''}>
                          {item.nombre_producto || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="truncate text-sm text-muted-foreground" title={item.descripcion || ''}>
                          {item.descripcion || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.cantidad ?? 'N/A'}
                      </TableCell>
                      <TableCell>{item.unidad || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        {item.precio_unitario ? formatCurrency(item.precio_unitario) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {item.subtotal ? formatCurrency(item.subtotal) : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totales */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end gap-6">
            {orden.total_neto && (
              <div className="text-right">
                <label className="text-sm font-medium text-muted-foreground">Total Neto</label>
                <p className="font-semibold text-lg">{formatCurrency(orden.total_neto)}</p>
              </div>
            )}
            {orden.total && (
              <div className="text-right">
                <label className="text-sm font-medium text-muted-foreground">Total</label>
                <p className="font-semibold text-xl text-firmavb-blue">
                  {formatCurrency(orden.total)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
