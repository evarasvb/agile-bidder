import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  Package,
  Settings,
  LogOut,
  Sparkles,
  Clock,
  DollarSign,
  Target,
  TrendingUp,
  AlertCircle,
  Filter,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCliente, clearClienteId, getClienteId } from '@/hooks/useCliente';
import {
  useClienteOfertas,
  useClienteOfertasConMatch,
  useClienteOfertasStats,
  ClienteOferta,
} from '@/hooks/useClienteOfertas';
import { OfertaCard } from '@/components/cliente-ofertas/OfertaCard';
import { OfertaDetalle } from '@/components/cliente-ofertas/OfertaDetalle';

export default function ClienteOfertasDashboard() {
  const navigate = useNavigate();
  const clienteId = getClienteId();
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState<ClienteOferta | null>(null);

  const { data: cliente, isLoading: loadingCliente } = useCliente();
  const { data: todasOfertas = [], isLoading: loadingOfertas } = useClienteOfertas();
  const { data: ofertasMatch = [] } = useClienteOfertasConMatch(80);
  const { data: stats } = useClienteOfertasStats();

  const handleLogout = () => {
    clearClienteId();
    navigate('/clientes');
  };

  if (!clienteId) {
    navigate('/clientes');
    return null;
  }

  if (loadingCliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Categorizar ofertas
  const ofertasPorEstado = {
    borrador: todasOfertas.filter((o) => o.estado === 'borrador'),
    revision: todasOfertas.filter((o) => o.estado === 'revision'),
    aprobadas: todasOfertas.filter((o) => o.estado === 'aprobada'),
    enviadas: todasOfertas.filter((o) => o.estado === 'enviada'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 border-r bg-card p-4 hidden lg:block">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-primary rounded-lg">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">LicitaBot</span>
        </div>

        <nav className="space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => navigate('/clientes/dashboard')}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Search className="w-4 h-4 mr-2" />
            Licitaciones
          </Button>
          <Button variant="secondary" className="w-full justify-start">
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
            <p className="text-sm font-medium">{cliente?.empresa_nombre}</p>
            <p className="text-xs text-muted-foreground">{cliente?.email}</p>
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
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => navigate('/clientes/dashboard')}
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-2xl font-bold">Ofertas Automáticas</h1>
              </div>
              <p className="text-muted-foreground">
                Cotizaciones generadas automáticamente basadas en tu inventario
              </p>
            </div>
          </div>

          {/* Métricas */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Ofertas</p>
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
                    <p className="text-2xl font-bold">{ofertasMatch.length}</p>
                    <p className="text-sm text-muted-foreground">Match 100%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.promedioMatch || 0}%</p>
                    <p className="text-sm text-muted-foreground">Match Promedio</p>
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
                      ${((stats?.valorTotal || 0) / 1000000).toFixed(1)}M
                    </p>
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="todas" className="space-y-6">
            <TabsList>
              <TabsTrigger value="todas">
                Todas ({todasOfertas.length})
              </TabsTrigger>
              <TabsTrigger value="match">
                Match 100% ({ofertasMatch.length})
              </TabsTrigger>
              <TabsTrigger value="borradores">
                Borradores ({ofertasPorEstado.borrador.length})
              </TabsTrigger>
              <TabsTrigger value="aprobadas">
                Aprobadas ({ofertasPorEstado.aprobadas.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab: Todas */}
            <TabsContent value="todas">
              <Card>
                <CardHeader>
                  <CardTitle>Todas las Ofertas</CardTitle>
                  <CardDescription>
                    Listado completo de ofertas generadas ordenadas por fecha de cierre
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingOfertas ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                      <p className="text-muted-foreground mt-4">Cargando ofertas...</p>
                    </div>
                  ) : todasOfertas.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay ofertas generadas</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Las ofertas se generan automáticamente cuando hay matches con licitaciones
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todasOfertas.map((oferta) => (
                        <OfertaCard
                          key={oferta.id}
                          oferta={oferta}
                          onClick={() => setOfertaSeleccionada(oferta)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Match 100% */}
            <TabsContent value="match">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-500" />
                    Ofertas con Match 100%
                  </CardTitle>
                  <CardDescription>
                    Productos emparejados completamente - Ordenados por fecha de cierre más próxima
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ofertasMatch.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay ofertas con match 100%</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ofertasMatch.map((oferta) => (
                        <OfertaCard
                          key={oferta.id}
                          oferta={oferta}
                          onClick={() => setOfertaSeleccionada(oferta)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Borradores */}
            <TabsContent value="borradores">
              <Card>
                <CardHeader>
                  <CardTitle>Borradores</CardTitle>
                  <CardDescription>Ofertas pendientes de revisión y aprobación</CardDescription>
                </CardHeader>
                <CardContent>
                  {ofertasPorEstado.borrador.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay borradores</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ofertasPorEstado.borrador.map((oferta) => (
                        <OfertaCard
                          key={oferta.id}
                          oferta={oferta}
                          onClick={() => setOfertaSeleccionada(oferta)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Aprobadas */}
            <TabsContent value="aprobadas">
              <Card>
                <CardHeader>
                  <CardTitle>Ofertas Aprobadas</CardTitle>
                  <CardDescription>Cotizaciones listas para enviar</CardDescription>
                </CardHeader>
                <CardContent>
                  {ofertasPorEstado.aprobadas.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay ofertas aprobadas</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ofertasPorEstado.aprobadas.map((oferta) => (
                        <OfertaCard
                          key={oferta.id}
                          oferta={oferta}
                          onClick={() => setOfertaSeleccionada(oferta)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Modal de detalle */}
      {ofertaSeleccionada && (
        <OfertaDetalle
          oferta={ofertaSeleccionada}
          onClose={() => setOfertaSeleccionada(null)}
        />
      )}
    </div>
  );
}
