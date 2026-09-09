import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase';
import { useCampaigns, useCampaignPiezas, useCampaignMetricas } from '@/hooks/useMarketingCampaigns';
import { NuevaCampanaRapida } from '@/components/marketing/NuevaCampanaRapida';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, BarChart3, Rocket, Plus, Send } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function MarketingControlCenter() {
  const { campaigns, isLoading } = useCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const queryClient = useQueryClient();

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const { piezas } = useCampaignPiezas(selectedCampaignId || '');
  const { metricas, totalEnviados, totalConversiones, promTasaApertura } = useCampaignMetricas(selectedCampaignId || '');

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
                      <div key={pieza.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{pieza.nombre}</p>
                          <p className="text-sm text-muted-foreground">{pieza.tipo} • {pieza.canal}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleExecutePieza(pieza.id)}
                          disabled={pieza.estado === 'ejecutado'}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {pieza.estado === 'ejecutado' ? 'Ejecutado' : 'Ejecutar'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
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
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aquí se mostrará el historial detallado de envíos, entregas, aperturas y clicks de cada pieza ejecutada.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      <NuevaCampanaRapida
        open={showNewCampaign}
        onOpenChange={setShowNewCampaign}
        onCampaignCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['marketing_campaigns'] });
        }}
      />
    </div>
  );
}
