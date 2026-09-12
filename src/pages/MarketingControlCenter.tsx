import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampaigns, useCampaignPiezas, useCampaignMetricas, useMarketingEjecucionesRecientes, type MarketingPieza } from '@/hooks/useMarketingCampaigns';
import { NuevaCampanaRapida } from '@/components/marketing/NuevaCampanaRapida';
import { PiezaDetalleDialog } from '@/components/marketing/PiezaDetalleDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertCircle, BarChart3, Rocket, Plus, Send, Users, Download } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MarketingContacto {
  id: string;
  email: string;
  nombre: string;
  empresa: string;
  categoria: string;
  fuente_datos: string;
  estado_suscripcion: string;
  creado_en: string;
}

export default function MarketingControlCenter() {
  const { campaigns, isLoading } = useCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [piezaAbierta, setPiezaAbierta] = useState<MarketingPieza | null>(null);
  const [contactos, setContactos] = useState<MarketingContacto[]>([]);
  const [cargandoContactos, setCargandoContactos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFuente, setFiltroFuente] = useState<string | null>(null);
  const [estadisticasContactos, setEstadisticasContactos] = useState({
    total: 0,
    prospects: 0,
    clientes: 0,
    webinar: 0,
    youtube: 0,
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    cargarContactos();
  }, []);

  const cargarContactos = async () => {
    setCargandoContactos(true);
    try {
      const { data, error } = await supabase
        .from('marketing_contactos')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) throw error;

      setContactos(data as MarketingContacto[]);

      const stats = {
        total: data?.length || 0,
        prospects: data?.filter(c => c.fuente_datos === 'prospects').length || 0,
        clientes: data?.filter(c => c.fuente_datos === 'clientes').length || 0,
        webinar: data?.filter(c => c.fuente_datos === 'webinar').length || 0,
        youtube: data?.filter(c => c.fuente_datos === 'youtube').length || 0,
      };
      setEstadisticasContactos(stats);
    } catch (error) {
      console.error('Error cargando contactos:', error);
    } finally {
      setCargandoContactos(false);
    }
  };

  const contactosFiltrados = contactos.filter(c => {
    const coincideBusqueda = !busqueda ||
      c.email.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.empresa.toLowerCase().includes(busqueda.toLowerCase());

    const coincideFuente = !filtroFuente || c.fuente_datos === filtroFuente;

    return coincideBusqueda && coincideFuente;
  });

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const { piezas, updatePieza, actualizandoPieza, ejecutarPieza, ejecutandoPieza } = useCampaignPiezas(selectedCampaignId || '');
  const { metricas, totalEnviados, totalConversiones, promTasaApertura } = useCampaignMetricas(selectedCampaignId || '');
  const { ejecuciones: ejecucionesRecientes, isLoading: cargandoEjecuciones } = useMarketingEjecucionesRecientes();

  const handleExecutePieza = async (piezaId: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/marketing-ejecutar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
          },
          body: JSON.stringify({ pieza_id: piezaId }),
        }
      );

      if (!response.ok) throw new Error('Error al ejecutar');

      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', selectedCampaignId] });
      queryClient.invalidateQueries({ queryKey: ['marketing_metricas', selectedCampaignId] });
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Centro de Control de Marketing</h1>
        <p className="text-muted-foreground">Planifica, ejecuta y monitorea tus campañas automáticamente</p>
      </div>

      <Alert>
        <Rocket className="h-4 w-4" />
        <AlertDescription>
          Sistema completamente automatizado: plan → execute → monitor → improve. Aquí es donde controlas todas tus campañas de marketing.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList>
          <TabsTrigger value="campaigns">Mis Campañas</TabsTrigger>
          <TabsTrigger value="contactos">Gestión de Contactos</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="ejecucion">Ejecución</TabsTrigger>
        </TabsList>

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Campañas Activas</h2>
            <Button onClick={() => setShowNewCampaign(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Campaña
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Cargando campañas...</div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center">
                <p className="text-muted-foreground mb-4">No hay campañas. Crea una para empezar.</p>
                <Button onClick={() => setShowNewCampaign(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primera Campaña
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map(campaign => (
                <Card
                  key={campaign.id}
                  className={`cursor-pointer transition-colors ${selectedCampaignId === campaign.id ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => setSelectedCampaignId(campaign.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{campaign.nombre}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Estado</p>
                      <p className="font-semibold capitalize">{campaign.estado}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Objetivo</p>
                      <p>{campaign.objetivo}</p>
                    </div>
                    {campaign.meta_registros && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground">Meta de registros: {campaign.meta_registros}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {selectedCampaign && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-xl">Piezas de "{selectedCampaign.nombre}"</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {piezas.length === 0 ? (
                  <p className="text-muted-foreground">Sin piezas. Crea la primera.</p>
                ) : (
                  <div className="space-y-2">
                    {piezas.map(pieza => (
                      <div
                        key={pieza.id}
                        className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:border-primary/40 transition-colors"
                        onClick={() => setPiezaAbierta(pieza)}
                      >
                        <div>
                          <p className="font-medium">{pieza.nombre}</p>
                          <p className="text-sm text-muted-foreground">{pieza.tipo} • {pieza.canal}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleExecutePieza(pieza.id); }}
                          disabled={pieza.estado === 'ejecutado' || pieza.canal !== 'email'}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {pieza.estado === 'ejecutado' ? 'Ejecutado' : pieza.canal !== 'email' ? 'Manual' : 'Ejecutar'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CONTACTS TAB */}
        <TabsContent value="contactos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gestión de Contactos</h2>
            <Button onClick={cargarContactos} disabled={cargandoContactos} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {/* STATISTICS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{estadisticasContactos.total}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Prospects</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{estadisticasContactos.prospects}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{estadisticasContactos.clientes}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Webinar</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{estadisticasContactos.webinar}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">YouTube</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{estadisticasContactos.youtube}</p>
              </CardContent>
            </Card>
          </div>

          {/* SEARCH AND FILTER */}
          <Card>
            <CardHeader>
              <CardTitle>Filtrar Contactos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Buscar por email, nombre o empresa..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
                <select
                  value={filtroFuente || ''}
                  onChange={(e) => setFiltroFuente(e.target.value || null)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Todas las fuentes</option>
                  <option value="prospects">Prospects</option>
                  <option value="clientes">Clientes</option>
                  <option value="webinar">Webinar</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                Mostrando {contactosFiltrados.length} de {contactos.length} contactos
              </p>
            </CardContent>
          </Card>

          {/* CONTACTS TABLE */}
          {cargandoContactos ? (
            <div className="text-center py-8 text-muted-foreground">Cargando contactos...</div>
          ) : contactosFiltrados.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {contactos.length === 0 ? 'No hay contactos aún. Importa desde prospects, clientes o webinars.' : 'No se encontraron contactos que coincidan con los filtros.'}
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Lista de Contactos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Fuente</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactosFiltrados.map((contacto) => (
                        <TableRow key={contacto.id}>
                          <TableCell className="text-sm font-medium">{contacto.email}</TableCell>
                          <TableCell className="text-sm">{contacto.nombre || '—'}</TableCell>
                          <TableCell className="text-sm">{contacto.empresa || '—'}</TableCell>
                          <TableCell className="text-sm">{contacto.categoria || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {contacto.fuente_datos}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={contacto.estado_suscripcion === 'suscrito' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {contacto.estado_suscripcion}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(contacto.creado_en).toLocaleDateString('es-CL')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* METRICS TAB */}
        <TabsContent value="metricas" className="space-y-4">
          <h2 className="text-2xl font-bold">Métricas de Campaña</h2>

          {selectedCampaignId && selectedCampaign ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Enviados</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalEnviados}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Conversiones</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalConversiones}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasa de Apertura</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{(promTasaApertura * 100).toFixed(1)}%</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Tasa de Conversión</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {totalEnviados > 0 ? ((totalConversiones / totalEnviados) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Selecciona una campaña para ver sus métricas</AlertDescription>
            </Alert>
          )}

          {metricas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Historial de Ejecuciones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metricas.map(metrica => (
                    <div key={metrica.fecha} className="p-3 border rounded-lg">
                      <p className="font-medium">{new Date(metrica.fecha).toLocaleDateString('es-CL')}</p>
                      <div className="grid grid-cols-4 gap-2 mt-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Enviados</p>
                          <p className="font-semibold">{metrica.total_enviados}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Abiertos</p>
                          <p className="font-semibold">{metrica.total_abiertos}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Clicks</p>
                          <p className="font-semibold">{metrica.total_clicks}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Conversiones</p>
                          <p className="font-semibold">{metrica.total_conversiones}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EXECUTION TAB */}
        <TabsContent value="ejecucion" className="space-y-4">
          <h2 className="text-2xl font-bold">Historial de Ejecuciones</h2>
          <p className="text-sm text-muted-foreground">
            Cada envío de email queda acá con a quién se le mandó y qué pasó. Facebook/Instagram/WhatsApp todavía se publican/mandan a mano, así que no aparecen en esta lista.
          </p>

          {cargandoEjecuciones ? (
            <div className="text-center py-8 text-muted-foreground">Cargando…</div>
          ) : ejecucionesRecientes.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Todavía no se ha ejecutado ningún envío.</AlertDescription>
            </Alert>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaña</TableHead>
                    <TableHead>Pieza</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Abierto</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ejecucionesRecientes.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{e.marketing_piezas?.marketing_campanas?.nombre || '—'}</TableCell>
                      <TableCell className="text-sm">{e.marketing_piezas?.nombre || '—'}</TableCell>
                      <TableCell className="text-sm">{e.email}</TableCell>
                      <TableCell>
                        <Badge variant={e.estado === 'fallo' || e.estado === 'rebote' ? 'destructive' : 'secondary'} className="text-[10px]">
                          {e.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{e.abierto ? 'Sí' : 'No'}</TableCell>
                      <TableCell className="text-sm">{e.clicks || 0}</TableCell>
                      <TableCell className="text-sm">{e.fecha_envio ? new Date(e.fecha_envio).toLocaleString('es-CL') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <NuevaCampanaRapida
        open={showNewCampaign}
        onOpenChange={setShowNewCampaign}
        onCampaignCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
        }}
      />

      <PiezaDetalleDialog
        pieza={piezaAbierta}
        onOpenChange={(open) => !open && setPiezaAbierta(null)}
        onGuardar={(id, updates) => updatePieza({ id, ...updates })}
        onEjecutar={(id) => { ejecutarPieza(id); setPiezaAbierta(null); }}
        guardando={actualizandoPieza}
        ejecutando={ejecutandoPieza}
      />
    </div>
  );
}
