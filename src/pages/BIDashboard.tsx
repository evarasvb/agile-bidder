import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area
} from 'recharts';
import { 
  TrendingUp, Building2, Search, RefreshCw, DollarSign, 
  FileText, Users, Calendar, ArrowUpRight, ArrowDownRight,
  Target, Award, BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { useMercadoPublicoQuery } from '@/hooks/useMercadoPublico';
import { toast } from 'sonner';

interface OrdenCompra {
  codigo: string;
  nombre: string;
  estado: string;
  proveedor: string;
  rut_proveedor: string;
  total: number;
  moneda: string;
  organismo: string;
  fecha_envio: string;
}

interface ProveedorStats {
  nombre: string;
  rut: string;
  totalOrdenes: number;
  montoTotal: number;
  porcentaje: number;
}

interface AnalisisData {
  ordenes: OrdenCompra[];
  totalOrdenes: number;
  montoTotal: number;
  proveedores: ProveedorStats[];
  distribucionMensual: { mes: string; monto: number; cantidad: number }[];
  distribucionEstado: { estado: string; cantidad: number }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CL', { 
    style: 'currency', 
    currency: 'CLP',
    maximumFractionDigits: 0 
  }).format(value);
};

export default function BIDashboard() {
  const [organismo, setOrganismo] = useState('');
  const [periodoAnalisis, setPeriodoAnalisis] = useState('30');
  const [analisis, setAnalisis] = useState<AnalisisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const queryMutation = useMercadoPublicoQuery();

  const analizarOrganismo = async () => {
    if (!organismo.trim()) {
      toast.error('Ingresa un código de organismo');
      return;
    }

    setIsLoading(true);
    const ordenes: OrdenCompra[] = [];
    const dias = parseInt(periodoAnalisis);
    
    try {
      // Obtener órdenes de los últimos N días
      for (let i = 0; i < dias; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        const fechaStr = fecha.toLocaleDateString('es-CL', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }).replace(/\//g, '');
        
        try {
          const data = await queryMutation.mutateAsync({
            action: 'ordenes-compra',
            params: { organismo, fecha: fechaStr }
          });
          
          if (data.ordenes?.length > 0) {
            ordenes.push(...data.ordenes);
          }
        } catch (e) {
          // Continuar con siguiente día si no hay datos
        }
      }

      if (ordenes.length === 0) {
        toast.warning('No se encontraron órdenes de compra para este organismo');
        setAnalisis(null);
        setIsLoading(false);
        return;
      }

      // Procesar datos para análisis
      const montoTotal = ordenes.reduce((sum, o) => sum + (o.total || 0), 0);
      
      // Agrupar por proveedor
      const proveedoresMap = new Map<string, ProveedorStats>();
      ordenes.forEach(orden => {
        const key = orden.rut_proveedor || orden.proveedor;
        if (proveedoresMap.has(key)) {
          const prov = proveedoresMap.get(key)!;
          prov.totalOrdenes++;
          prov.montoTotal += orden.total || 0;
        } else {
          proveedoresMap.set(key, {
            nombre: orden.proveedor,
            rut: orden.rut_proveedor,
            totalOrdenes: 1,
            montoTotal: orden.total || 0,
            porcentaje: 0
          });
        }
      });

      const proveedores = Array.from(proveedoresMap.values())
        .map(p => ({ ...p, porcentaje: (p.montoTotal / montoTotal) * 100 }))
        .sort((a, b) => b.montoTotal - a.montoTotal)
        .slice(0, 10);

      // Distribución por estado
      const estadosMap = new Map<string, number>();
      ordenes.forEach(orden => {
        const estado = orden.estado || 'Sin estado';
        estadosMap.set(estado, (estadosMap.get(estado) || 0) + 1);
      });
      const distribucionEstado = Array.from(estadosMap.entries())
        .map(([estado, cantidad]) => ({ estado, cantidad }));

      // Distribución mensual (simulada basada en fecha_envio)
      const mesesMap = new Map<string, { monto: number; cantidad: number }>();
      ordenes.forEach(orden => {
        const fecha = orden.fecha_envio ? new Date(orden.fecha_envio) : new Date();
        const mes = fecha.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
        if (mesesMap.has(mes)) {
          const m = mesesMap.get(mes)!;
          m.monto += orden.total || 0;
          m.cantidad++;
        } else {
          mesesMap.set(mes, { monto: orden.total || 0, cantidad: 1 });
        }
      });
      const distribucionMensual = Array.from(mesesMap.entries())
        .map(([mes, data]) => ({ mes, ...data }));

      setAnalisis({
        ordenes,
        totalOrdenes: ordenes.length,
        montoTotal,
        proveedores,
        distribucionEstado,
        distribucionMensual
      });

      toast.success(`Análisis completado: ${ordenes.length} órdenes encontradas`);
    } catch (error) {
      console.error('Error analizando organismo:', error);
      toast.error('Error al analizar el organismo');
    } finally {
      setIsLoading(false);
    }
  };

  const topProveedor = analisis?.proveedores[0];
  const promedioOrden = analisis ? analisis.montoTotal / analisis.totalOrdenes : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Business Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Analiza patrones de compra de organismos públicos
          </p>
        </div>
      </div>

      {/* Filtros de búsqueda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Análisis de Organismo
          </CardTitle>
          <CardDescription>
            Ingresa el código del organismo para analizar sus patrones de compra
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Código de organismo (ej: 6530)"
                value={organismo}
                onChange={(e) => setOrganismo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && analizarOrganismo()}
              />
            </div>
            <Select value={periodoAnalisis} onValueChange={setPeriodoAnalisis}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="15">Últimos 15 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="60">Últimos 60 días</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={analizarOrganismo} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Analizar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados del análisis */}
      {analisis && (
        <>
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analisis.totalOrdenes.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  en los últimos {periodoAnalisis} días
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(analisis.montoTotal)}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600 flex items-center gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    Volumen de compras
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Promedio por Orden</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(promedioOrden)}</div>
                <p className="text-xs text-muted-foreground">
                  valor promedio
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Proveedores Únicos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analisis.proveedores.length}</div>
                <p className="text-xs text-muted-foreground">
                  proveedores activos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos y tablas */}
          <Tabs defaultValue="proveedores" className="space-y-4">
            <TabsList>
              <TabsTrigger value="proveedores" className="flex items-center gap-2">
                <Award className="h-4 w-4" />
                Top Proveedores
              </TabsTrigger>
              <TabsTrigger value="distribucion" className="flex items-center gap-2">
                <PieChartIcon className="h-4 w-4" />
                Distribución
              </TabsTrigger>
              <TabsTrigger value="tendencia" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Tendencia
              </TabsTrigger>
              <TabsTrigger value="detalle" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Detalle
              </TabsTrigger>
            </TabsList>

            <TabsContent value="proveedores" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Gráfico de barras - Top proveedores */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 Proveedores por Monto</CardTitle>
                    <CardDescription>Distribución de compras por proveedor</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analisis.proveedores} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                          <YAxis 
                            type="category" 
                            dataKey="nombre" 
                            width={150}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip 
                            formatter={(value: number) => formatCurrency(value)}
                            labelFormatter={(label) => `Proveedor: ${label}`}
                          />
                          <Bar dataKey="montoTotal" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabla de proveedores */}
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
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analisis.proveedores.map((prov, idx) => (
                          <TableRow key={prov.rut || idx}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {idx === 0 && <Badge variant="default">Top</Badge>}
                                <span className="truncate max-w-[150px]" title={prov.nombre}>
                                  {prov.nombre}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{prov.totalOrdenes}</TableCell>
                            <TableCell className="text-right">{formatCurrency(prov.montoTotal)}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{prov.porcentaje.toFixed(1)}%</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="distribucion" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Pie chart - Distribución por proveedor */}
                <Card>
                  <CardHeader>
                    <CardTitle>Concentración de Proveedores</CardTitle>
                    <CardDescription>Participación en el monto total</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analisis.proveedores.slice(0, 5)}
                            dataKey="montoTotal"
                            nameKey="nombre"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            label={({ name, percent }) => `${name.substring(0, 15)}... (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {analisis.proveedores.slice(0, 5).map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Distribución por estado */}
                <Card>
                  <CardHeader>
                    <CardTitle>Estado de Órdenes</CardTitle>
                    <CardDescription>Distribución por estado de las órdenes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analisis.distribucionEstado}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="estado" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="cantidad" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tendencia" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tendencia de Compras</CardTitle>
                  <CardDescription>Evolución del volumen de compras en el período</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analisis.distribucionMensual}>
                        <defs>
                          <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="mes" />
                        <YAxis yAxisId="left" tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip 
                          formatter={(value: number, name: string) => [
                            name === 'monto' ? formatCurrency(value) : value,
                            name === 'monto' ? 'Monto' : 'Cantidad'
                          ]}
                        />
                        <Legend />
                        <Area 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="monto" 
                          stroke="hsl(var(--primary))" 
                          fillOpacity={1} 
                          fill="url(#colorMonto)" 
                          name="Monto"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="cantidad" 
                          stroke="hsl(var(--chart-2))" 
                          strokeWidth={2}
                          name="Cantidad"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="detalle" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Últimas Órdenes de Compra</CardTitle>
                  <CardDescription>Detalle de las órdenes más recientes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Proveedor</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analisis.ordenes.slice(0, 20).map((orden, idx) => (
                          <TableRow key={orden.codigo || idx}>
                            <TableCell className="font-mono text-sm">{orden.codigo}</TableCell>
                            <TableCell>
                              <span className="truncate max-w-[200px] block" title={orden.nombre}>
                                {orden.nombre}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="truncate max-w-[150px] block" title={orden.proveedor}>
                                {orden.proveedor}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{orden.estado}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(orden.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Insights */}
          {topProveedor && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Insights Clave
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Proveedor Dominante</p>
                    <p className="font-medium">{topProveedor.nombre}</p>
                    <p className="text-sm text-primary">
                      {topProveedor.porcentaje.toFixed(1)}% del total
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Concentración</p>
                    <p className="font-medium">
                      Top 3 = {analisis.proveedores.slice(0, 3).reduce((s, p) => s + p.porcentaje, 0).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      del monto total
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Oportunidad</p>
                    <p className="font-medium">
                      {analisis.proveedores.length > 5 ? 'Mercado diversificado' : 'Mercado concentrado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {analisis.proveedores.length} proveedores activos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!analisis && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Building2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Analiza un Organismo Público</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Ingresa el código de un organismo para ver sus patrones de compra, 
              proveedores frecuentes y tendencias de gasto.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
