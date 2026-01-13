import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  BarChart3, TrendingUp, Building2, Users, Package, 
  DollarSign, FileText, Target, Award, PieChart as PieChartIcon,
  Lightbulb, RefreshCw
} from 'lucide-react';
import { BIFiltersPanel } from '@/components/bi/BIFiltersPanel';
import { PriceSuggestionCard } from '@/components/bi/PriceSuggestionCard';
import { 
  BIFilters, 
  useBIKPIs,
  useProveedorStats,
  useInstitucionStats,
  useProductoStats,
  useTendenciaMensual
} from '@/hooks/useBIAnalytics';
import { useSyncOrdenesCompra, useSyncLicitaciones, useBIStats } from '@/hooks/useMercadoPublico';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP',
    maximumFractionDigits: 0 
  }).format(value);
};

const formatShortCurrency = (value: number) => {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
};

export default function BIAdvanced() {
  const [filters, setFilters] = useState<BIFilters>({});
  
  // Hooks de datos
  const { data: kpis, isLoading: loadingKpis } = useBIKPIs(filters);
  const { data: proveedores, isLoading: loadingProveedores } = useProveedorStats(filters);
  const { data: instituciones, isLoading: loadingInstituciones } = useInstitucionStats(filters);
  const { data: productos, isLoading: loadingProductos } = useProductoStats(filters);
  const { data: tendencia, isLoading: loadingTendencia } = useTendenciaMensual(filters);
  const { data: biStats } = useBIStats();

  // Hooks de sincronización
  const syncOrdenes = useSyncOrdenesCompra();
  const syncLicitaciones = useSyncLicitaciones();

  const handleSync = async () => {
    const today = new Date().toLocaleDateString('es-CL', { 
      day: '2-digit', month: '2-digit', year: 'numeric' 
    }).replace(/\//g, '');
    
    try {
      await Promise.all([
        syncOrdenes.mutateAsync({ fecha: today }),
        syncLicitaciones.mutateAsync({ fecha: today })
      ]);
      toast.success('Datos sincronizados correctamente');
    } catch (error) {
      toast.error('Error al sincronizar datos');
    }
  };

  const top10Proveedores = proveedores?.slice(0, 10) || [];
  const top10Instituciones = instituciones?.slice(0, 10) || [];
  const top10Productos = productos?.slice(0, 10) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Business Intelligence Avanzado
          </h1>
          <p className="text-muted-foreground mt-1">
            Análisis completo de compras públicas con sugerencia de precios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {biStats?.totalOrdenes.toLocaleString() || 0} órdenes sincronizadas
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSync}
            disabled={syncOrdenes.isPending || syncLicitaciones.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(syncOrdenes.isPending || syncLicitaciones.isPending) ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <BIFiltersPanel filters={filters} onFiltersChange={setFilters} />

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingKpis ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.totalOrdenes.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">con filtros aplicados</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingKpis ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpis?.montoTotal || 0)}</div>
                <p className="text-xs text-muted-foreground">volumen de compras</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio por Orden</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingKpis ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(kpis?.promedioOrden || 0)}</div>
                <p className="text-xs text-muted-foreground">valor promedio</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingKpis ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.proveedoresUnicos}</div>
                <p className="text-xs text-muted-foreground">proveedores activos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Análisis */}
      <Tabs defaultValue="proveedores" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="proveedores" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Proveedores
          </TabsTrigger>
          <TabsTrigger value="instituciones" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Instituciones
          </TabsTrigger>
          <TabsTrigger value="productos" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Productos
          </TabsTrigger>
          <TabsTrigger value="tendencia" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Tendencias
          </TabsTrigger>
          <TabsTrigger value="precios" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Sugerencia Precios
          </TabsTrigger>
        </TabsList>

        {/* Tab Proveedores */}
        <TabsContent value="proveedores" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Proveedores por Monto</CardTitle>
                <CardDescription>Distribución de compras por proveedor</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProveedores ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10Proveedores} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={formatShortCurrency} />
                        <YAxis 
                          type="category" 
                          dataKey="nombre" 
                          width={150}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Proveedor: ${label}`}
                        />
                        <Bar dataKey="monto_total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ranking de Proveedores</CardTitle>
                <CardDescription>Detalle de participación</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Órdenes</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProveedores ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      top10Proveedores.map((prov, idx) => (
                        <TableRow key={prov.rut || idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {idx === 0 && <Badge variant="default">Top</Badge>}
                              <span className="truncate max-w-[150px]" title={prov.nombre}>
                                {prov.nombre}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{prov.total_ordenes}</TableCell>
                          <TableCell className="text-right">{formatCurrency(prov.monto_total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Instituciones */}
        <TabsContent value="instituciones" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Instituciones por Monto</CardTitle>
                <CardDescription>Principales compradores públicos</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingInstituciones ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10Instituciones} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={formatShortCurrency} />
                        <YAxis 
                          type="category" 
                          dataKey="nombre" 
                          width={150}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Institución: ${label}`}
                        />
                        <Bar dataKey="monto_total" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ranking de Instituciones</CardTitle>
                <CardDescription>Detalle de compras por institución</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Institución</TableHead>
                      <TableHead className="text-right">Órdenes</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingInstituciones ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      top10Instituciones.map((inst, idx) => (
                        <TableRow key={inst.rut || idx}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {idx === 0 && <Badge className="bg-chart-2">Top</Badge>}
                              <span className="truncate max-w-[150px]" title={inst.nombre}>
                                {inst.nombre}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{inst.total_ordenes}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inst.monto_total)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Productos */}
        <TabsContent value="productos" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Productos Más Frecuentes</CardTitle>
                <CardDescription>Productos con más transacciones</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingProductos ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top10Productos} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" />
                        <YAxis 
                          type="category" 
                          dataKey="nombre" 
                          width={150}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => v.length > 20 ? v.substring(0, 20) + '...' : v}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            if (name === 'ocurrencias') return [value, 'Transacciones'];
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Producto: ${label}`}
                        />
                        <Bar dataKey="ocurrencias" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análisis de Precios por Producto</CardTitle>
                <CardDescription>Rango de precios y totales</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Min</TableHead>
                      <TableHead className="text-right">Promedio</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingProductos ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      top10Productos.map((prod, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <span className="truncate max-w-[120px] block" title={prod.nombre}>
                              {prod.nombre}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(prod.precio_min)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(prod.precio_promedio)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatCurrency(prod.precio_max)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Tendencias */}
        <TabsContent value="tendencia" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tendencia de Compras Mensual</CardTitle>
                <CardDescription>Evolución del monto total y cantidad de órdenes</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTendencia ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={tendencia}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="mes" 
                          tickFormatter={(v, i) => `${v} ${tendencia?.[i]?.anio?.toString().slice(-2) || ''}`}
                        />
                        <YAxis yAxisId="left" tickFormatter={formatShortCurrency} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value: number, name: string) => {
                            if (name === 'monto_total') return [formatCurrency(value), 'Monto Total'];
                            if (name === 'total_ordenes') return [value, 'Órdenes'];
                            return [value, name];
                          }}
                        />
                        <Legend />
                        <Area 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="monto_total" 
                          name="Monto Total"
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="total_ordenes" 
                          name="Órdenes"
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Sugerencia de Precios */}
        <TabsContent value="precios" className="space-y-4">
          <PriceSuggestionCard filters={filters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
