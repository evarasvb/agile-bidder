import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Search, TrendingUp, DollarSign, Phone, Mail, MapPin, Users } from 'lucide-react';
import { useInstituciones, useInstitucionesDashboard, useInstitucionesStats, useBIInstitucion } from '@/hooks/useInstituciones';
import { Skeleton } from '@/components/ui/skeleton';

const REGIONES = [
  'Metropolitana', 'Valparaíso', 'Biobío', 'Maule', 'Araucanía',
  'O\'Higgins', 'Los Lagos', 'Coquimbo', 'Antofagasta', 'Tarapacá',
  'Atacama', 'Los Ríos', 'Aysén', 'Magallanes', 'Arica y Parinacota', 'Ñuble'
];

export default function Instituciones() {
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  
  const { data: instituciones, isLoading } = useInstituciones({ 
    search, 
    region: selectedRegion || undefined,
    limit: 100 
  });
  const { data: dashboard } = useInstitucionesDashboard();
  const { data: stats } = useInstitucionesStats();
  const { data: biData } = useBIInstitucion();

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(monto);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              Instituciones
            </h1>
            <p className="text-muted-foreground">
              Gestión y análisis de instituciones públicas
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Instituciones</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalInstituciones?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monto Top 10</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMonto(stats?.montoTop10 || 0)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Dashboard</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Con BI Data</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{biData?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o RUT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Todas las regiones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las regiones</SelectItem>
                  {REGIONES.map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="listado" className="space-y-4">
          <TabsList>
            <TabsTrigger value="listado">Listado</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="bi">Business Intelligence</TabsTrigger>
          </TabsList>

          <TabsContent value="listado">
            <Card>
              <CardHeader>
                <CardTitle>Instituciones Registradas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>RUT</TableHead>
                        <TableHead>Región</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead className="text-right">Total Compras</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instituciones?.map((inst) => (
                        <TableRow key={inst.id}>
                          <TableCell className="font-medium">{inst.nombre}</TableCell>
                          <TableCell>{inst.rut}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              <MapPin className="h-3 w-3 mr-1" />
                              {inst.region || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell>{inst.sector || 'N/A'}</TableCell>
                          <TableCell className="text-right">{inst.total_ordenes?.toLocaleString() || 0}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMonto(inst.monto_total_compras || 0)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!instituciones?.length && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No se encontraron instituciones
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard">
            <Card>
              <CardHeader>
                <CardTitle>Dashboard de Oportunidades</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Institución</TableHead>
                      <TableHead>Total Compras</TableHead>
                      <TableHead>Promedio</TableHead>
                      <TableHead>Tendencia</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.instituciones?.nombre || 'N/A'}
                        </TableCell>
                        <TableCell>{item.total_compras}</TableCell>
                        <TableCell>{formatMonto(item.promedio_por_compra)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            item.tendencia_compras === 'creciente' ? 'default' :
                            item.tendencia_compras === 'estable' ? 'secondary' : 'destructive'
                          }>
                            {item.tendencia_compras || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.score_oportunidad}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!dashboard?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay datos de dashboard disponibles
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bi">
            <Card>
              <CardHeader>
                <CardTitle>Análisis BI por Institución</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Institución</TableHead>
                      <TableHead className="text-right">Órdenes</TableHead>
                      <TableHead className="text-right">Monto Total</TableHead>
                      <TableHead className="text-right">Promedio</TableHead>
                      <TableHead className="text-right">Proveedores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {biData?.map((item: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium max-w-[300px] truncate">
                          {item.institucion_nombre}
                        </TableCell>
                        <TableCell className="text-right">{item.total_ordenes?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatMonto(item.monto_total || 0)}</TableCell>
                        <TableCell className="text-right">{formatMonto(item.promedio_orden || 0)}</TableCell>
                        <TableCell className="text-right">{item.proveedores_distintos}</TableCell>
                      </TableRow>
                    ))}
                    {!biData?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No hay datos de BI disponibles
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
