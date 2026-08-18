import { useState } from "react";
import { useOrdenesCompra, useOrdenCompra, type OrdenCompra, type OrdenesCompraFilters } from "@/hooks/useOrdenesCompra";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, Building2, User, Calendar, Package, X, Filter, ArrowDownWideNarrow, Download, FileSearch } from "lucide-react";
import { formatCurrency } from "@/utils/clasificacion";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { esTratoDirecto, getTipoOCLabel } from "@/utils/tipoOrdenCompra";
import { descargarOrdenCompraPDF, descargarTopOrdenesCompraPDF } from "@/services/ordenesCompraPdf";

const TIPOS = [
  { value: "todos", label: "Todos los tipos" },
  { value: "TD", label: "Trato Directo" },
  { value: "AG", label: "Compra Ágil" },
  { value: "SE", label: "Por Licitación" },
  { value: "CM", label: "Convenio Marco" },
  { value: "CC", label: "Compra Coordinada" },
];

const emptyForm = { fechaDesde: "", fechaHasta: "", tipo: "todos", proveedor: "", comprador: "", search: "" };

export default function OrdenesCompra() {
  const [form, setForm] = useState({ ...emptyForm });
  const [applied, setApplied] = useState<OrdenesCompraFilters | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<string | null>(null);
  const [ordenarPorMonto, setOrdenarPorMonto] = useState(false);

  const { data: ordenes = [], isLoading } = useOrdenesCompra(applied ?? {}, false, { enabled: hasSearched });
  const { data: ordenDetalle, isLoading: isLoadingDetalle } = useOrdenCompra(ordenSeleccionada, true);

  const buscar = () => {
    const f: OrdenesCompraFilters = {};
    if (form.fechaDesde) f.fecha_desde = new Date(form.fechaDesde).toISOString();
    if (form.fechaHasta) { const d = new Date(form.fechaHasta); d.setHours(23, 59, 59, 999); f.fecha_hasta = d.toISOString(); }
    if (form.tipo && form.tipo !== "todos") f.tipo = form.tipo;
    if (form.proveedor.trim()) f.proveedor_nombre = form.proveedor.trim();
    if (form.comprador.trim()) f.institucion_nombre = form.comprador.trim();
    if (form.search.trim()) f.search = form.search.trim();
    setApplied(f);
    setHasSearched(true);
  };

  const limpiar = () => { setForm({ ...emptyForm }); setApplied(null); setHasSearched(false); };

  const ordenesMostradas = ordenarPorMonto ? [...ordenes].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)) : ordenes;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
          Órdenes de Compra
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Filtra por fecha, tipo, proveedor o comprador y presiona <strong>Buscar</strong>.
        </p>
      </div>

      {/* Filtros */}
      <Card className="border-firmavb-blue/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5 text-firmavb-blue" />
            Filtros de búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha desde</Label>
              <Input type="date" value={form.fechaDesde} onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fecha hasta</Label>
              <Input type="date" value={form.fechaHasta} onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proveedor</Label>
              <Input placeholder="Nombre del proveedor" value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Comprador (institución)</Label>
              <Input placeholder="Nombre del organismo" value={form.comprador} onChange={(e) => setForm({ ...form, comprador: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs">Búsqueda libre (código, nombre, RUT)</Label>
              <Input placeholder="Ej: 2591-33-TD26, papel, 96.xxx.xxx-x…" value={form.search}
                onChange={(e) => setForm({ ...form, search: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && buscar()} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={buscar} className="gap-2 bg-firmavb-blue hover:bg-firmavb-blue/90">
              <Search className="h-4 w-4" /> Buscar
            </Button>
            <Button variant="outline" onClick={limpiar} className="gap-2">
              <X className="h-4 w-4" /> Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Antes de buscar: estado vacío */}
      {!hasSearched ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSearch className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="font-medium">Configura tus filtros y presiona Buscar</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Así ves solo las órdenes de compra que te interesan, sin cargar todo el mercado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-firmavb-blue/10">
          <CardHeader className="pb-3 bg-gradient-to-r from-firmavb-blue/5 to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-firmavb-blue" />
                Resultados
                <Badge variant="secondary">{ordenes.length}</Badge>
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setOrdenarPorMonto((v) => !v)} variant={ordenarPorMonto ? "default" : "outline"} className="gap-2">
                  <ArrowDownWideNarrow className="h-4 w-4" /> Por monto
                </Button>
                <Button size="sm" variant="outline" className="gap-2"
                  onClick={() => descargarTopOrdenesCompraPDF([...ordenes].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 20), "Top Órdenes de Compra")}
                  disabled={ordenesMostradas.length === 0}>
                  <Download className="h-4 w-4" /> Exportar PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : ordenes.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                <p className="text-muted-foreground font-medium">No se encontraron órdenes de compra</p>
                <p className="text-sm text-muted-foreground mt-1">Prueba ampliar el rango de fechas o cambiar los filtros.</p>
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
                      <TableHead className="font-semibold whitespace-nowrap">Fecha</TableHead>
                      <TableHead className="font-semibold">Tipo</TableHead>
                      <TableHead className="font-semibold text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordenesMostradas.map((orden) => (
                      <TableRow key={orden.id} className="hover:bg-firmavb-blue/5 transition-colors">
                        <TableCell className="font-mono text-xs font-medium whitespace-nowrap">{orden.codigo}</TableCell>
                        <TableCell className="max-w-[240px]"><div className="truncate" title={orden.nombre || ""}>{orden.nombre || "Sin nombre"}</div></TableCell>
                        <TableCell><div className="flex items-center gap-1.5 text-sm"><Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="truncate max-w-[180px]" title={orden.institucion_nombre || ""}>{orden.institucion_nombre || "N/A"}</span></div></TableCell>
                        <TableCell><div className="flex items-center gap-1.5 text-sm"><User className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="truncate max-w-[160px]" title={orden.proveedor_nombre || ""}>{orden.proveedor_nombre || "N/A"}</span></div></TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{orden.total ? formatCurrency(orden.total) : "N/A"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{orden.fecha_creacion ? format(parseISO(orden.fecha_creacion), "dd MMM yyyy", { locale: es }) : "N/A"}</TableCell>
                        <TableCell>{esTratoDirecto(orden.tipo) ? <Badge variant="destructive" className="whitespace-nowrap">Trato Directo</Badge> : <Badge variant="outline" className="whitespace-nowrap">{getTipoOCLabel(orden.tipo)}</Badge>}</TableCell>
                        <TableCell className="text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setOrdenSeleccionada(orden.codigo)}>Ver</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh]">
                              <DialogHeader>
                                <div className="flex items-center justify-between gap-2 pr-8">
                                  <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-firmavb-blue" />Detalle de Orden de Compra</DialogTitle>
                                  {ordenDetalle && (
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => descargarOrdenCompraPDF(ordenDetalle)}>
                                      <Download className="h-4 w-4" /> Exportar PDF
                                    </Button>
                                  )}
                                </div>
                              </DialogHeader>
                              <ScrollArea className="max-h-[70vh] pr-4">
                                {isLoadingDetalle ? (
                                  <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>
                                ) : ordenDetalle ? <OrdenCompraDetalle orden={ordenDetalle} /> : <p className="text-muted-foreground">No se pudo cargar el detalle</p>}
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
      )}
    </div>
  );
}

function OrdenCompraDetalle({ orden }: { orden: OrdenCompra }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg">Información General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-muted-foreground">Código</label><p className="font-mono font-medium">{orden.codigo}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Estado</label><div><Badge variant="secondary">{orden.estado || "N/A"}</Badge></div></div>
            <div className="sm:col-span-2"><label className="text-sm font-medium text-muted-foreground">Nombre</label><p>{orden.nombre || "N/A"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Total</label><p className="font-semibold text-lg">{orden.total ? formatCurrency(orden.total) : "N/A"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Tipo</label><div>{esTratoDirecto(orden.tipo) ? <Badge variant="destructive">Trato Directo</Badge> : <Badge variant="outline">{getTipoOCLabel(orden.tipo)}</Badge>}</div></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5 text-firmavb-blue" />Institución</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><label className="text-sm font-medium text-muted-foreground">Nombre</label><p>{orden.institucion_nombre || "N/A"}</p></div>
            {orden.institucion_rut && <div><label className="text-sm font-medium text-muted-foreground">RUT</label><p className="font-mono">{orden.institucion_rut}</p></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-firmavb-blue" />Proveedor</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div><label className="text-sm font-medium text-muted-foreground">Nombre</label><p>{orden.proveedor_nombre || "N/A"}</p></div>
            {orden.proveedor_rut && <div><label className="text-sm font-medium text-muted-foreground">RUT</label><p className="font-mono">{orden.proveedor_rut}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-firmavb-blue" />Fechas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-muted-foreground">Emisión</label><p>{orden.fecha_creacion ? format(parseISO(orden.fecha_creacion), "dd MMM yyyy HH:mm", { locale: es }) : "N/A"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Envío</label><p>{orden.fecha_envio ? format(parseISO(orden.fecha_envio), "dd MMM yyyy HH:mm", { locale: es }) : "N/A"}</p></div>
          </div>
        </CardContent>
      </Card>

      {orden.items && orden.items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Package className="h-5 w-5 text-firmavb-blue" />Ítems ({orden.items.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-center">Cantidad</TableHead>
                    <TableHead className="text-center">Unidad</TableHead>
                    <TableHead className="text-right">Precio Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orden.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium max-w-[220px]"><div className="truncate" title={item.nombre_producto}>{item.nombre_producto}</div></TableCell>
                      <TableCell className="text-center">{item.cantidad}</TableCell>
                      <TableCell className="text-center">{item.unidad || "-"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{item.precio_unitario_neto ? formatCurrency(item.precio_unitario_neto) : "-"}</TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">{item.total_neto ? formatCurrency(item.total_neto) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
