import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  Package,
  Settings,
  LogOut,
  Sparkles,
  DollarSign,
  Target,
  TrendingUp,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCliente, getClienteId } from '@/hooks/useCliente';
import { useAuth } from '@/hooks/useAuth';
import {
  useClienteOfertas,
  useClienteOfertasConMatch,
  useClienteOfertasStats,
  ClienteOferta,
} from '@/hooks/useClienteOfertas';
import { OfertaCard } from '@/components/cliente-ofertas/OfertaCard';
import { OfertaDetalle } from '@/components/cliente-ofertas/OfertaDetalle';

// Datos mock para demostración
const MOCK_OFERTAS: ClienteOferta[] = [
  {
    id: 'mock-1',
    cliente_id: 'demo',
    licitacion_id: '1057986-45-LE24',
    estado: 'borrador',
    match_score: 95,
    valor_total: 12500000,
    margen_total: 22,
    notas: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    productos_ofertados: [
      {
        inventory_id: '1',
        sku: 'MED-001',
        nombre_producto: 'Guantes de Nitrilo Caja x100',
        descripcion: 'Guantes desechables de nitrilo, talla M',
        cantidad: 500,
        unidad_medida: 'Caja',
        precio_unitario: 15000,
        precio_total: 7500000,
        margen_aplicado: 20,
      },
      {
        inventory_id: '2',
        sku: 'MED-002',
        nombre_producto: 'Mascarillas N95 Caja x50',
        descripcion: 'Mascarillas de protección N95',
        cantidad: 200,
        unidad_medida: 'Caja',
        precio_unitario: 25000,
        precio_total: 5000000,
        margen_aplicado: 25,
      },
    ],
    licitacion: {
      id_licitacion: '1057986-45-LE24',
      titulo: 'Adquisición de Insumos Médicos para Hospital Regional de Valparaíso - Guantes, Mascarillas y Elementos de Protección Personal',
      organismo: 'Hospital Regional de Valparaíso',
      presupuesto: 15000000,
      fecha_cierre: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      estado: 'Publicada',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'mock-2',
    cliente_id: 'demo',
    licitacion_id: '1058234-12-LP24',
    estado: 'aprobada',
    match_score: 88,
    valor_total: 8900000,
    margen_total: 18,
    notas: 'Cotización revisada y aprobada por gerencia',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    productos_ofertados: [
      {
        inventory_id: '3',
        sku: 'MED-005',
        nombre_producto: 'Jeringas Desechables 10ml',
        descripcion: 'Jeringas estériles de 10ml con aguja',
        cantidad: 2000,
        unidad_medida: 'Unidad',
        precio_unitario: 350,
        precio_total: 700000,
        margen_aplicado: 15,
      },
      {
        inventory_id: '4',
        sku: 'MED-010',
        nombre_producto: 'Alcohol Gel 500ml',
        descripcion: 'Alcohol gel antiséptico',
        cantidad: 1000,
        unidad_medida: 'Unidad',
        precio_unitario: 3500,
        precio_total: 3500000,
        margen_aplicado: 20,
      },
      {
        inventory_id: '5',
        sku: 'MED-015',
        nombre_producto: 'Termómetro Digital',
        descripcion: 'Termómetro digital infrarrojo',
        cantidad: 100,
        unidad_medida: 'Unidad',
        precio_unitario: 47000,
        precio_total: 4700000,
        margen_aplicado: 18,
      },
    ],
    licitacion: {
      id_licitacion: '1058234-12-LP24',
      titulo: 'Suministro de Material Médico Fungible para CESFAM Comunal - Convenio Marco 2024',
      organismo: 'Municipalidad de Santiago',
      presupuesto: 10000000,
      fecha_cierre: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      estado: 'Publicada',
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'mock-3',
    cliente_id: 'demo',
    licitacion_id: '1059001-88-LE24',
    estado: 'borrador',
    match_score: 100,
    valor_total: 25000000,
    margen_total: 25,
    notas: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    productos_ofertados: [
      {
        inventory_id: '6',
        sku: 'MED-020',
        nombre_producto: 'Batas Quirúrgicas Desechables',
        descripcion: 'Batas estériles para procedimientos',
        cantidad: 1000,
        unidad_medida: 'Unidad',
        precio_unitario: 8500,
        precio_total: 8500000,
        margen_aplicado: 22,
      },
      {
        inventory_id: '7',
        sku: 'MED-025',
        nombre_producto: 'Gorros Quirúrgicos Caja x100',
        descripcion: 'Gorros desechables para cirugía',
        cantidad: 300,
        unidad_medida: 'Caja',
        precio_unitario: 12000,
        precio_total: 3600000,
        margen_aplicado: 20,
      },
      {
        inventory_id: '8',
        sku: 'MED-030',
        nombre_producto: 'Cubrezapatos Desechables',
        descripcion: 'Cubrezapatos antideslizantes',
        cantidad: 500,
        unidad_medida: 'Par',
        precio_unitario: 2500,
        precio_total: 1250000,
        margen_aplicado: 18,
      },
      {
        inventory_id: '9',
        sku: 'MED-035',
        nombre_producto: 'Kit EPP Completo',
        descripcion: 'Kit de protección personal completo',
        cantidad: 200,
        unidad_medida: 'Kit',
        precio_unitario: 58250,
        precio_total: 11650000,
        margen_aplicado: 30,
      },
    ],
    licitacion: {
      id_licitacion: '1059001-88-LE24',
      titulo: 'Licitación Pública para Adquisición de Equipamiento de Protección Personal (EPP) - Servicio de Salud Metropolitano Sur',
      organismo: 'Servicio de Salud Metropolitano Sur',
      presupuesto: 22000000,
      fecha_cierre: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      estado: 'Publicada',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
];

export default function ClienteOfertasDashboard() {
  const navigate = useNavigate();
  const clienteId = getClienteId();
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState<ClienteOferta | null>(null);

  const { data: cliente, isLoading: loadingCliente } = useCliente();
  const { data: dbOfertas = [], isLoading: loadingOfertas } = useClienteOfertas();
  const { data: dbOfertasMatch = [] } = useClienteOfertasConMatch(80);
  const { data: dbStats } = useClienteOfertasStats();

  // Combinar datos reales con mock si no hay datos
  const todasOfertas = useMemo(() => {
    return dbOfertas.length > 0 ? dbOfertas : MOCK_OFERTAS;
  }, [dbOfertas]);

  const ofertasMatch = useMemo(() => {
    if (dbOfertasMatch.length > 0) return dbOfertasMatch;
    return MOCK_OFERTAS.filter(o => (o.match_score || 0) >= 80);
  }, [dbOfertasMatch]);

  const stats = useMemo(() => {
    if (dbStats && dbStats.total > 0) return dbStats;
    return {
      total: MOCK_OFERTAS.length,
      borradores: MOCK_OFERTAS.filter(o => o.estado === 'borrador').length,
      revision: 0,
      aprobadas: MOCK_OFERTAS.filter(o => o.estado === 'aprobada').length,
      enviadas: 0,
      valorTotal: MOCK_OFERTAS.reduce((sum, o) => sum + (o.valor_total || 0), 0),
      promedioMatch: Math.round(
        MOCK_OFERTAS.reduce((sum, o) => sum + (o.match_score || 0), 0) / MOCK_OFERTAS.length
      ),
    };
  }, [dbStats]);

  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  // Permitir ver la página sin clienteId para demostración
  const isDemo = !clienteId;

  if (loadingCliente && !isDemo) {
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
          <span className="font-bold text-lg">FirmaVB</span>
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
            <p className="text-sm font-medium">{cliente?.empresa_nombre || 'Empresa Demo'}</p>
            <p className="text-xs text-muted-foreground">{cliente?.email || 'demo@empresa.cl'}</p>
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
                {isDemo && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded">
                    DEMO
                  </span>
                )}
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
                    <p className="text-sm text-muted-foreground">Match ≥80%</p>
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
                Match ≥80% ({ofertasMatch.length})
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
                  {loadingOfertas && !isDemo ? (
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

            {/* Tab: Match ≥80% */}
            <TabsContent value="match">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-500" />
                    Ofertas con Match Alto
                  </CardTitle>
                  <CardDescription>
                    Productos emparejados con score ≥80% - Ordenados por fecha de cierre más próxima
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ofertasMatch.length === 0 ? (
                    <div className="text-center py-12">
                      <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay ofertas con match alto</p>
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
