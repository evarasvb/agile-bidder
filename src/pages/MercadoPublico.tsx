import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Calendar, 
  Building2, 
  DollarSign, 
  Clock,
  FileText,
  TrendingUp,
  Filter,
  Download,
  Eye
} from 'lucide-react';
import { useMercadoPublicoQuery } from '@/hooks/useMercadoPublico';
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface LicitacionMP {
  id: string;
  titulo: string;
  descripcion?: string;
  organismo?: string;
  estado?: string;
  tipo?: string;
  fecha_cierre: string;
  fecha_publicacion?: string;
  presupuesto?: number;
  moneda?: string;
}

interface OrdenCompraMP {
  codigo: string;
  nombre: string;
  estado: string;
  tipo: string;
  fecha_envio: string;
  fecha_aceptacion?: string;
  proveedor: string;
  rut_proveedor: string;
  total: number;
  moneda: string;
  organismo: string;
}

const MercadoPublico = () => {
  const [activeTab, setActiveTab] = useState('licitaciones');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLicitacion, setSelectedLicitacion] = useState<LicitacionMP | null>(null);
  const [licitaciones, setLicitaciones] = useState<LicitacionMP[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompraMP[]>([]);
  const [totalLicitaciones, setTotalLicitaciones] = useState(0);
  const [totalOrdenes, setTotalOrdenes] = useState(0);
  
  const mpQuery = useMercadoPublicoQuery();

  const buscarLicitaciones = async () => {
    try {
      const data = await mpQuery.mutateAsync({
        action: 'licitaciones',
        params: {}
      });
      setLicitaciones(data.licitaciones || []);
      setTotalLicitaciones(data.total || 0);
      toast.success(`Se encontraron ${data.total || 0} licitaciones`);
    } catch (error) {
      console.error('Error buscando licitaciones:', error);
    }
  };

  const buscarOrdenes = async () => {
    try {
      const data = await mpQuery.mutateAsync({
        action: 'ordenes-compra',
        params: {}
      });
      setOrdenes(data.ordenes || []);
      setTotalOrdenes(data.total || 0);
      toast.success(`Se encontraron ${data.total || 0} órdenes de compra`);
    } catch (error) {
      console.error('Error buscando órdenes:', error);
    }
  };

  const filteredLicitaciones = licitaciones.filter(lic => 
    lic.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lic.organismo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lic.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrdenes = ordenes.filter(oc => 
    oc.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    oc.organismo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    oc.proveedor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getEstadoBadge = (estado?: string) => {
    const estadoLower = estado?.toLowerCase() || '';
    if (estadoLower.includes('publicada') || estadoLower.includes('abierta')) {
      return <Badge className="bg-green-500">Abierta</Badge>;
    }
    if (estadoLower.includes('cerrada')) {
      return <Badge variant="secondary">Cerrada</Badge>;
    }
    if (estadoLower.includes('adjudicada')) {
      return <Badge className="bg-blue-500">Adjudicada</Badge>;
    }
    return <Badge variant="outline">{estado || 'N/A'}</Badge>;
  };

  const getTimeRemaining = (fechaCierre: string) => {
    try {
      const cierre = parseISO(fechaCierre);
      const now = new Date();
      const hoursLeft = differenceInHours(cierre, now);
      
      if (hoursLeft < 0) return <span className="text-muted-foreground">Cerrada</span>;
      if (hoursLeft < 24) return <span className="text-red-500 font-semibold">{hoursLeft}h restantes</span>;
      if (hoursLeft < 72) return <span className="text-orange-500">{Math.floor(hoursLeft / 24)}d restantes</span>;
      return <span className="text-muted-foreground">{Math.floor(hoursLeft / 24)}d restantes</span>;
    } catch {
      return <span className="text-muted-foreground">-</span>;
    }
  };

  const formatCurrency = (amount?: number, moneda?: string) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: moneda === 'USD' ? 'USD' : 'CLP',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">MercadoPúblico en Vivo</h1>
          <p className="text-muted-foreground">
            Explora licitaciones y órdenes de compra directamente desde la API oficial
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.mercadopublico.cl" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ir a MercadoPúblico
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Licitaciones Cargadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLicitaciones.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Órdenes Cargadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdenes.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Filtradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeTab === 'licitaciones' ? filteredLicitaciones.length : filteredOrdenes.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estado API</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className="bg-green-500">Conectada</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="licitaciones" className="gap-2">
              <FileText className="h-4 w-4" />
              Licitaciones
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Órdenes de Compra
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, organismo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              onClick={activeTab === 'licitaciones' ? buscarLicitaciones : buscarOrdenes}
              disabled={mpQuery.isPending}
            >
              {mpQuery.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden md:inline">Actualizar</span>
            </Button>
          </div>
        </div>

        <TabsContent value="licitaciones">
          <Card>
            <CardHeader>
              <CardTitle>Licitaciones Activas</CardTitle>
              <CardDescription>
                Licitaciones públicas vigentes obtenidas desde MercadoPúblico
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mpQuery.isPending ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredLicitaciones.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sin licitaciones cargadas</h3>
                  <p className="text-muted-foreground mb-4">
                    Haz clic en "Actualizar" para cargar licitaciones desde MercadoPúblico
                  </p>
                  <Button onClick={buscarLicitaciones}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Cargar Licitaciones
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead className="min-w-[300px]">Título</TableHead>
                        <TableHead>Organismo</TableHead>
                        <TableHead>Cierre</TableHead>
                        <TableHead>Tiempo</TableHead>
                        <TableHead>Presupuesto</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLicitaciones.map((lic) => (
                        <TableRow key={lic.id}>
                          <TableCell className="font-mono text-sm">{lic.id}</TableCell>
                          <TableCell>
                            <div className="font-medium line-clamp-2">{lic.titulo}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{lic.organismo || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {lic.fecha_cierre ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {format(parseISO(lic.fecha_cierre), 'dd/MM/yy HH:mm', { locale: es })}
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{getTimeRemaining(lic.fecha_cierre)}</TableCell>
                          <TableCell>
                            {lic.presupuesto ? (
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {formatCurrency(lic.presupuesto, lic.moneda)}
                                </span>
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => setSelectedLicitacion(lic)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Detalle de Licitación</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div>
                                      <span className="font-mono text-sm text-muted-foreground">{lic.id}</span>
                                      <h3 className="text-lg font-semibold mt-1">{lic.titulo}</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Organismo</p>
                                        <p className="font-medium">{lic.organismo || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Estado</p>
                                        {getEstadoBadge(lic.estado)}
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Fecha de Cierre</p>
                                        <p className="font-medium">
                                          {lic.fecha_cierre ? format(parseISO(lic.fecha_cierre), 'PPPp', { locale: es }) : '-'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Presupuesto</p>
                                        <p className="font-medium">{formatCurrency(lic.presupuesto, lic.moneda)}</p>
                                      </div>
                                    </div>
                                    {lic.descripcion && (
                                      <div>
                                        <p className="text-sm text-muted-foreground">Descripción</p>
                                        <p className="mt-1">{lic.descripcion}</p>
                                      </div>
                                    )}
                                    <div className="flex gap-2 pt-4">
                                      <Button asChild className="flex-1">
                                        <a 
                                          href={`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=kBDeEF77BfkJb2i76c1g4A==&IdLicitacion=${lic.id}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Ver en MercadoPúblico
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <Button variant="ghost" size="sm" asChild>
                                <a 
                                  href={`https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=kBDeEF77BfkJb2i76c1g4A==&IdLicitacion=${lic.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ordenes">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes de Compra</CardTitle>
              <CardDescription>
                Órdenes de compra emitidas por organismos públicos - útil para análisis de competencia
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mpQuery.isPending ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredOrdenes.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Sin órdenes cargadas</h3>
                  <p className="text-muted-foreground mb-4">
                    Haz clic en "Actualizar" para cargar órdenes de compra
                  </p>
                  <Button onClick={buscarOrdenes}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Cargar Órdenes
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead className="min-w-[250px]">Nombre</TableHead>
                        <TableHead>Organismo</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrdenes.map((oc) => (
                        <TableRow key={oc.codigo}>
                          <TableCell className="font-mono text-sm">{oc.codigo}</TableCell>
                          <TableCell>
                            <div className="font-medium line-clamp-2">{oc.nombre}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{oc.organismo || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-sm">{oc.proveedor}</div>
                              <div className="text-xs text-muted-foreground">{oc.rut_proveedor}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(oc.total, oc.moneda)}</span>
                          </TableCell>
                          <TableCell>
                            {oc.fecha_envio ? format(parseISO(oc.fecha_envio), 'dd/MM/yy', { locale: es }) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={oc.estado === 'Aceptada' ? 'default' : 'secondary'}>
                              {oc.estado}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MercadoPublico;
