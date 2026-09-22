import { CampaignFeedback, CampaignHistoryError } from '@/components/marketing/CampaignFeedback';
import { useState, useEffect, useRef } from 'react';
import { campaignAudience } from '@/services/campaignResult';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampaigns, useCampaignPiezas, useCampaignMetricas, useMarketingEjecucionesRecientes, type MarketingPieza, type MarketingCampaign } from '@/hooks/useMarketingCampaigns';
import { NuevaCampanaRapida } from '@/components/marketing/NuevaCampanaRapida';
import { EditarCampanaDialog } from '@/components/marketing/EditarCampanaDialog';
import { PiezaDetalleDialog } from '@/components/marketing/PiezaDetalleDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ContactosSaludPanel } from '@/components/marketing/ContactosSaludPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertCircle, BarChart3, Rocket, Plus, Send, Users, Download, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

interface MarketingContacto {
  id: string;
  email: string;
  nombre: string;
  empresa: string;
  categoria: string;
  rubro: string | null;
  fuente_datos: string;
  estado_suscripcion: string;
  creado_en: string;
}

const fechaCL = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-CL') : '—');

const COLUMNAS_CONTACTOS: DataTableColumn<MarketingContacto>[] = [
  { id: 'email', header: 'Email', cell: (c) => <span className="font-medium">{c.email}</span>, sortValue: (c) => c.email },
  { id: 'nombre', header: 'Nombre', cell: (c) => c.nombre || '—', sortValue: (c) => c.nombre },
  { id: 'empresa', header: 'Empresa', cell: (c) => c.empresa || '—', sortValue: (c) => c.empresa },
  { id: 'categoria', header: 'Categoría', cell: (c) => c.categoria || '—', sortValue: (c) => c.categoria },
  { id: 'rubro', header: 'Rubro', cell: (c) => c.rubro || <span className="text-muted-foreground">Sin información</span>, sortValue: (c) => c.rubro, exportValue: (c) => c.rubro ?? '' },
  { id: 'fuente', header: 'Fuente', cell: (c) => <Badge variant="outline" className="text-xs">{c.fuente_datos}</Badge>, sortValue: (c) => c.fuente_datos },
  {
    id: 'estado',
    header: 'Estado',
    cell: (c) => <Badge variant={c.estado_suscripcion === 'suscrito' ? 'default' : 'secondary'} className="text-xs">{c.estado_suscripcion}</Badge>,
    sortValue: (c) => c.estado_suscripcion,
  },
  { id: 'fecha', header: 'Fecha', cell: (c) => <span className="text-muted-foreground">{fechaCL(c.creado_en)}</span>, sortValue: (c) => c.creado_en, exportValue: (c) => fechaCL(c.creado_en) },
];

export default function MarketingControlCenter() {
  const { campaigns, isLoading, updateCampaignAsync, actualizandoCampaign, deleteCampaign, eliminandoCampaign } = useCampaigns();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campanaEditando, setCampanaEditando] = useState<MarketingCampaign | null>(null);
  const [campanaBorrando, setCampanaBorrando] = useState<MarketingCampaign | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [piezaAbierta, setPiezaAbierta] = useState<MarketingPieza | null>(null);
  const [contactos, setContactos] = useState<MarketingContacto[]>([]);
  const [cargandoContactos, setCargandoContactos] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFuente, setFiltroFuente] = useState<string | null>(null);
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroSuscripcion, setFiltroSuscripcion] = useState('');
  const [errorContactos, setErrorContactos] = useState<string | null>(null);
  const [estadisticasContactos, setEstadisticasContactos] = useState({
    total: 0,
    prospects: 0,
    clientes: 0,
    webinar: 0,
    youtube: 0,
  });
  const queryClient = useQueryClient();
  const envioEnCurso = useRef(false);
  const [resultadosEnvio, setResultadosEnvio] = useState<Record<string, string>>({});
  const [bloqueados, setBloqueados] = useState<Record<string, boolean>>({});
  const [audienciaConfiable, setAudienciaConfiable] = useState(false);

  useEffect(() => {
    cargarContactos();
  }, []);

  const cargarContactos = async () => {
    setCargandoContactos(true);
    setAudienciaConfiable(false);
    setErrorContactos(null);
    try {
      const { data, error, count } = await supabase
        .from('marketing_contactos')
        .select('*', { count: 'exact' })
        .order('creado_en', { ascending: false });

      if (error) throw error;

      setContactos((data || []) as MarketingContacto[]);
      setAudienciaConfiable(count !== null && count === (data || []).length);

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
      setErrorContactos('No se pudieron actualizar los contactos. Los datos anteriores, si existen, se conservan.');
    } finally {
      setCargandoContactos(false);
    }
  };

  const contactosFiltrados = contactos.filter(c => {
    const coincideBusqueda = !busqueda ||
      (c.email || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) ||
      (c.empresa || '').toLowerCase().includes(busqueda.toLowerCase());

    const coincideFuente = !filtroFuente || c.fuente_datos === filtroFuente;

    return coincideBusqueda && coincideFuente &&
      (!filtroRubro || c.rubro === filtroRubro) &&
      (!filtroCategoria || c.categoria === filtroCategoria) &&
      (!filtroSuscripcion || c.estado_suscripcion === filtroSuscripcion);
  });

  const rubros = [...new Set(contactos.map(c => c.rubro).filter((v): v is string => Boolean(v)))].sort();
  const categorias = [...new Set(contactos.map(c => c.categoria).filter(Boolean))].sort();
  const suscripciones = [...new Set(contactos.map(c => c.estado_suscripcion).filter(Boolean))].sort();

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const { piezas, updatePiezaAsync, actualizandoPieza, ejecutarPieza, ejecutandoPieza } = useCampaignPiezas(selectedCampaignId || '');
  const { metricas, totalEnviados, totalConversiones, promTasaApertura } = useCampaignMetricas(selectedCampaignId || '');
  const { ejecuciones: ejecucionesRecientes, isLoading: cargandoEjecuciones, isError: errorEjecuciones } = useMarketingEjecucionesRecientes();

  const audiencia = campaignAudience(contactosFiltrados, audienciaConfiable && !cargandoContactos && !errorContactos);
  const piezaActual = piezaAbierta ? piezas.find(p => p.id === piezaAbierta.id) || null : null;
  const resultadoEnvio = piezaActual ? resultadosEnvio[piezaActual.id] : null;
  const handleExecutePieza = async (piezaId: string) => {
    if (envioEnCurso.current || bloqueados[piezaId]) return;
    const pieza = piezas.find(p => p.id === piezaId);
    if (!pieza || pieza.canal !== 'email' || pieza.estado !== 'draft') return;
    const showResult = (message: string) => setResultadosEnvio(current => ({ ...current, [piezaId]: message }));
    if (audiencia.error) { showResult(audiencia.error); return; }
    const ids = [...audiencia.ids];
    if (!window.confirm('¿Enviar «' + pieza.nombre + '» a los ' + ids.length + ' contactos suscritos del segmento de Gestión de Contactos? Se usará el contenido guardado. Esta acción enviará correos reales y no se puede deshacer.')) return;
    envioEnCurso.current = true;
    showResult('Enviando correos… Espera el resultado antes de intentar otro envío.');
    try {
      const result = await ejecutarPieza({ piezaId, contactosIds: ids });
      showResult(result.message);
      if (result.manualReview || result.status === 200) setBloqueados(current => ({ ...current, [piezaId]: true }));
    } catch {
      showResult('No se pudo confirmar el resultado. Revisa la sesión y el historial antes de volver a enviar.');
      setBloqueados(current => ({ ...current, [piezaId]: true }));
    } finally {
      envioEnCurso.current = false;
      queryClient.invalidateQueries({ queryKey: ['marketing_ejecucion_recientes'] });
      queryClient.invalidateQueries({ queryKey: ['marketing_ejecucion', piezaId] });
      queryClient.invalidateQueries({ queryKey: ['marketing_piezas', selectedCampaignId] });
    }
  };

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto px-4 py-6 pb-24 sm:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">Centro de Control de Marketing</h1>
        <p className="text-muted-foreground">Organiza tus campañas, contactos y resultados en un solo lugar</p>
      </div>

      <Alert>
        <Rocket className="h-4 w-4" />
        <AlertDescription>
          Consulta los envíos de correo en Ejecución. Las publicaciones en Facebook, Instagram y WhatsApp todavía se gestionan manualmente.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList aria-label="Secciones de marketing" className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5 [&>button]:min-h-11 [&>button]:whitespace-normal">
          <TabsTrigger value="campaigns">Mis Campañas</TabsTrigger>
          <TabsTrigger value="contactos">Gestión de Contactos</TabsTrigger>
          <TabsTrigger value="salud">Salud de Base</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="ejecucion">Ejecución</TabsTrigger>
        </TabsList>
        {resultadoEnvio && <Alert className="mt-4" role="status" aria-live="polite"><AlertDescription>{resultadoEnvio}</AlertDescription></Alert>}

        {/* CAMPAIGNS TAB */}
        <TabsContent value="campaigns" className="space-y-4">
          <p role="status" className="text-sm">{audiencia.error || `Audiencia seleccionada: ${audiencia.ids.length} contactos suscritos. Ajusta los filtros en Gestión de Contactos.`}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h2 className="text-xl sm:text-2xl font-bold">Tus campañas</h2>
            <Button onClick={() => setShowNewCampaign(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Campaña
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">Cargando campañas…</div>
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
                  className={`min-w-0 transition-colors focus-within:ring-2 focus-within:ring-ring ${selectedCampaignId === campaign.id ? 'border-primary bg-primary/5' : ''}`}

                >
                  <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                    <CardTitle className="text-lg break-words flex-1"><button type="button" className="min-h-11 w-full text-left rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-pressed={selectedCampaignId === campaign.id} onClick={() => setSelectedCampaignId(campaign.id)}>{campaign.nombre}</button></CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button" variant="ghost" size="icon" className="h-8 w-8"
                        aria-label={`Editar ${campaign.nombre}`}
                        onClick={(e) => { e.stopPropagation(); setCampanaEditando(campaign); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Eliminar ${campaign.nombre}`}
                        onClick={(e) => { e.stopPropagation(); setCampanaBorrando(campaign); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Estado</p>
                      <p className="font-semibold capitalize">{campaign.estado === 'draft' ? 'Borrador' : campaign.estado}</p>
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
                        className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:border-primary/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="min-h-11 rounded-sm text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setPiezaAbierta(pieza)}
                          >
                            <span className="block font-medium break-words">{pieza.nombre}</span>
                            <span className="block text-sm text-muted-foreground">{pieza.tipo} • {pieza.canal}</span>
                          </button>
                          <CampaignFeedback pieceId={pieza.id} results={resultadosEnvio} />
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleExecutePieza(pieza.id); }}
                          disabled={!!audiencia.error || !!bloqueados[pieza.id] || ejecutandoPieza || pieza.estado !== 'draft' || pieza.canal !== 'email'}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {ejecutandoPieza ? 'Enviando…' : pieza.estado === 'ejecutado' ? 'Ejecutado' : pieza.canal !== 'email' ? 'Manual' : 'Revisar envío'}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex-1">
                  <Input
                    aria-label="Buscar contactos" placeholder="Buscar por correo, nombre o empresa…"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filtrar contactos por origen" value={filtroFuente || ''}
                  onChange={(e) => setFiltroFuente(e.target.value || null)}
                  className="px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Todas las fuentes</option>
                  <option value="prospects">Prospects</option>
                  <option value="clientes">Clientes</option>
                  <option value="webinar">Webinar</option>
                  <option value="youtube">YouTube</option>
                </select>
                <select aria-label="Filtrar contactos por rubro" value={filtroRubro} onChange={e => setFiltroRubro(e.target.value)} className="min-h-11 min-w-0 px-3 py-2 border rounded-md text-sm bg-background">
                  <option value="">Todos los rubros</option>
                  {rubros.map(rubro => <option key={rubro} value={rubro}>{rubro}</option>)}
                </select>
                <select aria-label="Filtrar contactos por categoría" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="min-h-11 min-w-0 px-3 py-2 border rounded-md text-sm bg-background">
                  <option value="">Todas las categorías</option>
                  {categorias.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
                </select>
                <select aria-label="Filtrar contactos por suscripción" value={filtroSuscripcion} onChange={e => setFiltroSuscripcion(e.target.value)} className="min-h-11 min-w-0 px-3 py-2 border rounded-md text-sm bg-background">
                  <option value="">Todos los estados de suscripción</option>
                  {suscripciones.map(estado => <option key={estado} value={estado}>{estado}</option>)}
                </select>
                <Button variant="outline" onClick={() => { setBusqueda(''); setFiltroFuente(null); setFiltroRubro(''); setFiltroCategoria(''); setFiltroSuscripcion(''); }}>Limpiar filtros</Button>
              </div>
              <p className="text-sm text-muted-foreground">Combina filtros para revisar segmentos. Los envíos usan únicamente los contactos suscritos de este segmento ({contactosFiltrados.length} de {contactos.length}).</p>
            </CardContent>
          </Card>

          {/* CONTACTS TABLE */}
          {errorContactos && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{errorContactos}<Button variant="outline" className="ml-2" disabled={cargandoContactos} onClick={cargarContactos}>Reintentar</Button></AlertDescription></Alert>}
          {errorContactos && contactos.length === 0 ? null : (
            <Card>
              <CardHeader>
                <CardTitle>Lista de Contactos</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable<MarketingContacto>
                  storageKey="marketing-audiencia"
                  rows={contactosFiltrados}
                  rowKey={(c) => c.id}
                  loading={cargandoContactos}
                  itemLabel="contactos"
                  columns={COLUMNAS_CONTACTOS}
                  defaultSort={{ id: 'fecha', dir: 'desc' }}
                  exportFileName="audiencia-marketing"
                  emptyMessage={contactos.length === 0 ? 'No hay contactos aún. Importa desde prospects, clientes o webinars.' : 'No se encontraron contactos que coincidan con los filtros.'}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HEALTH TAB */}
        <TabsContent value="salud" className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Salud de la Base de Contactos</h2>
            <p className="text-muted-foreground">
              Monitoreo automático: validación de emails, eliminación de duplicados, enriquecimiento de datos.
            </p>
          </div>
          <ContactosSaludPanel />
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
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2 text-sm">
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
          ) : errorEjecuciones ? (<CampaignHistoryError />) : (
            <DataTable
              storageKey="marketing-envios"
              rows={ejecucionesRecientes}
              rowKey={(e) => String(e.id)}
              itemLabel="envíos"
              searchText={(e) => `${e.email ?? ''} ${e.marketing_piezas?.nombre ?? ''} ${e.marketing_piezas?.marketing_campanas?.nombre ?? ''} ${e.estado ?? ''}`}
              searchPlaceholder="Buscar por correo, pieza o campaña…"
              defaultSort={{ id: 'fecha', dir: 'desc' }}
              exportFileName="envios-marketing"
              emptyMessage="Todavía no se ha ejecutado ningún envío."
              columns={[
                { id: 'campana', header: 'Campaña', cell: (e) => e.marketing_piezas?.marketing_campanas?.nombre || '—', sortValue: (e) => e.marketing_piezas?.marketing_campanas?.nombre },
                { id: 'pieza', header: 'Pieza', cell: (e) => e.marketing_piezas?.nombre || '—', sortValue: (e) => e.marketing_piezas?.nombre },
                { id: 'email', header: 'Email', cell: (e) => e.email, sortValue: (e) => e.email },
                {
                  id: 'estado',
                  header: 'Estado',
                  cell: (e) => <Badge variant={e.estado === 'fallo' || e.estado === 'rebote' ? 'destructive' : 'secondary'} className="text-[10px]">{e.estado}</Badge>,
                  sortValue: (e) => e.estado,
                },
                { id: 'abierto', header: 'Abierto', cell: (e) => (e.abierto ? 'Sí' : 'No'), sortValue: (e) => (e.abierto ? 1 : 0), exportValue: (e) => (e.abierto ? 'Sí' : 'No'), align: 'center' },
                { id: 'clicks', header: 'Clicks', cell: (e) => e.clicks || 0, sortValue: (e) => e.clicks || 0, align: 'right' },
                { id: 'fecha', header: 'Fecha', cell: (e) => (e.fecha_envio ? new Date(e.fecha_envio).toLocaleString('es-CL') : '—'), sortValue: (e) => e.fecha_envio, exportValue: (e) => (e.fecha_envio ? new Date(e.fecha_envio).toLocaleString('es-CL') : '') },
              ]}
            />
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
        pieza={piezaActual}
        onOpenChange={(open) => !open && setPiezaAbierta(null)}
        onGuardar={async (id, updates) => {
          const saved = await updatePiezaAsync({ id, ...updates });
          setPiezaAbierta(current => current?.id === id ? { ...current, ...saved } : current);
          return saved;
        }}
        onEjecutar={handleExecutePieza}
        resultadoEnvio={resultadoEnvio}
        bloqueoEnvio={audiencia.error || (piezaActual && bloqueados[piezaActual.id] ? "Este envío ya fue procesado o requiere revisión manual; no se repetirá." : null)}
        guardando={actualizandoPieza}
        ejecutando={ejecutandoPieza}
      />

      <EditarCampanaDialog
        campana={campanaEditando}
        onOpenChange={(open) => !open && setCampanaEditando(null)}
        onGuardar={(id, updates) => updateCampaignAsync({ id, ...updates })}
        guardando={actualizandoCampaign}
      />

      <AlertDialog open={!!campanaBorrando} onOpenChange={(open) => !open && !eliminandoCampaign && setCampanaBorrando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{campanaBorrando?.nombre}" junto con todas sus piezas, métricas y envíos registrados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminandoCampaign}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={eliminandoCampaign}
              onClick={async (e) => {
                e.preventDefault();
                if (!campanaBorrando) return;
                try {
                  await deleteCampaign(campanaBorrando.id);
                  if (selectedCampaignId === campanaBorrando.id) setSelectedCampaignId(null);
                  toast.success('Campaña eliminada');
                  setCampanaBorrando(null);
                } catch (error) {
                  toast.error(`No se pudo eliminar: ${error instanceof Error ? error.message : 'error desconocido'}`);
                }
              }}
            >
              {eliminandoCampaign && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
