import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Search, FileText, Package, Settings, LogOut,
  TrendingUp, Target, Send, DollarSign, Eye, FileDown, Sparkles,
  ChevronRight, Clock, Building2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCliente, useClienteInventario } from '@/hooks/useCliente';
import { useAuth } from '@/hooks/useAuth';
import { useLicitaciones } from '@/hooks/useLicitaciones';

// Función de scoring simplificada
function calcularScore(licitacion: any, inventario: any[], categoriaNegocio: string | null): number {
  if (inventario.length === 0) return 0;

  const tituloLower = licitacion.titulo?.toLowerCase() || '';
  let score = 0;
  let matches = 0;

  // Match por palabras clave del inventario
  for (const prod of inventario) {
    const palabras = prod.palabras_clave || [];
    for (const palabra of palabras) {
      if (tituloLower.includes(palabra.toLowerCase())) {
        matches++;
        score += 15;
      }
    }
    // Match por nombre de producto
    if (tituloLower.includes(prod.nombre.toLowerCase().slice(0, 10))) {
      matches++;
      score += 10;
    }
  }

  // Bonus por categoría de negocio
  if (categoriaNegocio) {
    const categoriaKeywords: Record<string, string[]> = {
      medico: ['medico', 'salud', 'hospital', 'clinica', 'insumo', 'medicamento'],
      oficina: ['oficina', 'papel', 'escritorio', 'material'],
      alimentos: ['alimento', 'comida', 'catering', 'alimentacion'],
      tecnologia: ['computador', 'tecnologia', 'software', 'equipo'],
      aseo: ['aseo', 'limpieza', 'desinfectante', 'higiene'],
      mobiliario: ['mueble', 'silla', 'escritorio', 'mobiliario'],
    };
    
    const keywords = categoriaKeywords[categoriaNegocio] || [];
    for (const kw of keywords) {
      if (tituloLower.includes(kw)) {
        score += 20;
      }
    }
  }

  return Math.min(score, 100);
}

export default function ClienteDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: cliente, isLoading: loadingCliente } = useCliente();
  const { data: inventario = [] } = useClienteInventario();
  const { data: licitaciones = [], isLoading: loadingLicitaciones } = useLicitaciones();

  useEffect(() => {
    // If loading is done and there's no client record, redirect to registration
    if (!loadingCliente && cliente === null) {
      navigate('/clientes/registro');
      return;
    }
    // If client exists but onboarding not completed, redirect to onboarding
    if (!loadingCliente && cliente && !cliente.onboarding_completado) {
      navigate('/clientes/onboarding');
    }
  }, [cliente, loadingCliente, navigate]);

  // Calcular scores para cada licitación
  const licitacionesConScore = useMemo(() => {
    return licitaciones
      .map(lic => ({
        ...lic,
        score: calcularScore(lic, inventario, cliente?.categoria_negocio || null),
      }))
      .sort((a, b) => b.score - a.score);
  }, [licitaciones, inventario, cliente]);

  const licitacionesMatch = licitacionesConScore.filter(l => l.score >= 30);

  // Métricas
  const metricas = useMemo(() => ({
    totalAnalizadas: licitaciones.length,
    matchRate: licitaciones.length > 0 
      ? Math.round((licitacionesMatch.length / licitaciones.length) * 100) 
      : 0,
    ofertasEnviadas: 0, // TODO: conectar con ofertas reales
    valorPotencial: licitacionesMatch.reduce((sum, l) => sum + (l.presupuesto || 0), 0),
  }), [licitaciones, licitacionesMatch]);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // Show loading while checking
  if (loadingCliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // If no client, the useEffect will redirect - show loading in the meantime
  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary rounded-lg">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold">FirmaVB</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{cliente.email}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-1" />
            Salir
          </Button>
        </div>
      </div>

      {/* Sidebar - Desktop */}
      <div className="fixed left-0 top-0 h-full w-64 border-r bg-card p-4 hidden lg:block">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-primary rounded-lg">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">FirmaVB</span>
        </div>

        <nav className="space-y-2">
          <Button variant="secondary" className="w-full justify-start">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Search className="w-4 h-4 mr-2" />
            Licitaciones
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <FileText className="w-4 h-4 mr-2" />
            Mis Ofertas
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Package className="w-4 h-4 mr-2" />
            Inventario
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Settings className="w-4 h-4 mr-2" />
            Configuración
          </Button>
        </nav>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="p-3 bg-muted rounded-lg mb-3">
            <p className="text-sm font-medium">{cliente.empresa_nombre}</p>
            <p className="text-xs text-muted-foreground">{cliente.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">¡Hola, {cliente.nombre_responsable.split(' ')[0]}!</h1>
            <p className="text-muted-foreground">
              Aquí tienes un resumen de tus oportunidades de hoy
            </p>
          </div>

          {/* Métricas */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Search className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metricas.totalAnalizadas}</p>
                    <p className="text-sm text-muted-foreground">Analizadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Target className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metricas.matchRate}%</p>
                    <p className="text-sm text-muted-foreground">Match rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Send className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{metricas.ofertasEnviadas}</p>
                    <p className="text-sm text-muted-foreground">Ofertas enviadas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      ${(metricas.valorPotencial / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-sm text-muted-foreground">Valor potencial</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs de contenido */}
          <Tabs defaultValue="matches" className="space-y-6">
            <TabsList>
              <TabsTrigger value="matches">
                Matches ({licitacionesMatch.length})
              </TabsTrigger>
              <TabsTrigger value="todas">
                Todas ({licitaciones.length})
              </TabsTrigger>
              <TabsTrigger value="inventario">
                Mi Inventario ({inventario.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="matches">
              <Card>
                <CardHeader>
                  <CardTitle>Licitaciones con Match</CardTitle>
                  <CardDescription>
                    Oportunidades que coinciden con tu inventario y categoría
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingLicitaciones ? (
                    <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                  ) : licitacionesMatch.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay matches aún</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Agrega más productos a tu inventario para mejorar los resultados
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {licitacionesMatch.slice(0, 10).map((lic) => (
                        <div
                          key={lic.id_licitacion}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={lic.score >= 70 ? 'default' : 'secondary'}>
                                  {lic.score}% match
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {lic.id_licitacion}
                                </span>
                              </div>
                              <h3 className="font-medium line-clamp-2">{lic.titulo}</h3>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {lic.organismo}
                                </span>
                                {lic.fecha_cierre && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Cierra: {new Date(lic.fecha_cierre).toLocaleDateString('es-CL')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              {lic.presupuesto && (
                                <p className="font-semibold">
                                  ${lic.presupuesto.toLocaleString('es-CL')}
                                </p>
                              )}
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="outline">
                                  <Eye className="w-3 h-3 mr-1" />
                                  Ver
                                </Button>
                                <Button size="sm">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  Ofertar
                                </Button>
                              </div>
                            </div>
                          </div>
                          <Progress value={lic.score} className="mt-3 h-1" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="todas">
              <Card>
                <CardHeader>
                  <CardTitle>Todas las Licitaciones</CardTitle>
                  <CardDescription>
                    Últimas licitaciones publicadas en MercadoPúblico
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Organismo</TableHead>
                          <TableHead>Match</TableHead>
                          <TableHead className="text-right">Presupuesto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {licitacionesConScore.slice(0, 20).map((lic) => (
                          <TableRow key={lic.id_licitacion}>
                            <TableCell className="font-mono text-xs">
                              {lic.id_licitacion.slice(0, 15)}...
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {lic.titulo}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {lic.organismo}
                            </TableCell>
                            <TableCell>
                              <Badge variant={lic.score >= 50 ? 'default' : lic.score >= 30 ? 'secondary' : 'outline'}>
                                {lic.score}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {lic.presupuesto 
                                ? `$${lic.presupuesto.toLocaleString('es-CL')}`
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventario">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Mi Inventario</CardTitle>
                      <CardDescription>
                        Productos que ofreces - usados para el matching automático
                      </CardDescription>
                    </div>
                    <Button onClick={() => navigate('/clientes/onboarding')}>
                      Editar Inventario
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {inventario.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay productos en tu inventario</p>
                      <Button className="mt-4" onClick={() => navigate('/clientes/onboarding')}>
                        Agregar Productos
                      </Button>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead className="text-right">Precio</TableHead>
                            <TableHead className="text-right">Stock</TableHead>
                            <TableHead>Keywords</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {inventario.map((prod) => (
                            <TableRow key={prod.id}>
                              <TableCell className="font-mono text-xs">{prod.sku}</TableCell>
                              <TableCell>{prod.nombre}</TableCell>
                              <TableCell>{prod.categoria || '-'}</TableCell>
                              <TableCell className="text-right">
                                ${prod.precio_unitario.toLocaleString('es-CL')}
                              </TableCell>
                              <TableCell className="text-right">{prod.stock}</TableCell>
                              <TableCell className="max-w-xs">
                                <div className="flex flex-wrap gap-1">
                                  {(prod.palabras_clave || []).slice(0, 3).map((kw) => (
                                    <Badge key={kw} variant="outline" className="text-xs">
                                      {kw}
                                    </Badge>
                                  ))}
                                  {(prod.palabras_clave?.length || 0) > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{prod.palabras_clave!.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
