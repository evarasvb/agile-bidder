import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Upload, Users, Filter, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface ContactoStats {
  fuente: string;
  cantidad: number;
  activos: number;
  suscritos: number;
}

interface Contacto {
  id: string;
  email: string;
  nombre: string | null;
  empresa: string | null;
  categoria: string | null;
  estado_suscripcion: string;
  fuente_datos: string | null;
  etiquetas: string[] | null;
}

export default function MarketingContactosAdmin() {
  const [stats, setStats] = useState<ContactoStats[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroFuente, setFiltroFuente] = useState<string>('');

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      // Cargar estadísticas
      const { data: statsData, error: statsError } = await supabase
        .from('marketing_contactos')
        .select('fuente_datos, estado_contacto, estado_suscripcion', { count: 'exact' });

      if (!statsError && statsData) {
        const statsMap = new Map<string, { total: number; activos: number; suscritos: number }>();

        statsData.forEach(row => {
          const fuente = row.fuente_datos || 'sin_fuente';
          const stat = statsMap.get(fuente) || { total: 0, activos: 0, suscritos: 0 };
          stat.total += 1;
          if (row.estado_contacto === 'activo') stat.activos += 1;
          if (row.estado_suscripcion === 'suscrito') stat.suscritos += 1;
          statsMap.set(fuente, stat);
        });

        const statsArray = Array.from(statsMap).map(([fuente, counts]) => ({
          fuente,
          cantidad: counts.total,
          activos: counts.activos,
          suscritos: counts.suscritos
        }));

        setStats(statsArray.sort((a, b) => b.cantidad - a.cantidad));
      }

      // Cargar contactos
      let query = supabase
        .from('marketing_contactos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filtroCategoria) query = query.eq('categoria', filtroCategoria);
      if (filtroFuente) query = query.eq('fuente_datos', filtroFuente);

      const { data: contactosData, error: contactosError } = await query;

      if (!contactosError && contactosData) {
        setContactos(contactosData);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando datos de contactos');
    } finally {
      setLoading(false);
    }
  };

  const handleImportarDeProspects = async () => {
    try {
      setLoading(true);

      // Esta función intenta fusionar desde la tabla prospects si existe
      const { data: prospects, error: prospectError } = await supabase
        .from('prospects')
        .select('email, nombre, empresa, categoria')
        .limit(1000);

      if (prospectError) {
        toast.error('No se encontró tabla de prospects o error al acceder');
        return;
      }

      if (!prospects || prospects.length === 0) {
        toast.info('No hay registros en prospects para importar');
        return;
      }

      // Insertar en marketing_contactos
      const contactosParaImportar = prospects.map((p: any) => ({
        email: p.email,
        nombre: p.nombre,
        empresa: p.empresa,
        categoria: p.categoria || 'prospect',
        origen: 'prospects',
        fuente_datos: 'prospects',
        estado_suscripcion: 'suscrito',
        estado_contacto: 'activo',
        consentimiento_marketing: true,
        consentimiento_fecha: new Date().toISOString(),
      }));

      const { error: insertError, data: insertedData } = await supabase
        .from('marketing_contactos')
        .upsert(contactosParaImportar, { onConflict: 'email' });

      if (insertError) throw insertError;

      await supabase.rpc('marketing_registrar_auditoria', {
        p_accion: 'importacion',
        p_fuente: 'prospects',
        p_cantidad: insertedData?.length || prospects.length,
      });

      toast.success(`Importados ${prospects.length} contactos de prospects`);
      setTimeout(cargarDatos, 1000);
    } catch (error) {
      console.error('Error importando prospects:', error);
      toast.error(`Error: ${error instanceof Error ? error.message : 'Desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarContacto = async (id: string) => {
    if (!confirm('¿Eliminar este contacto?')) return;

    try {
      const { error } = await supabase
        .from('marketing_contactos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Contacto eliminado');
      cargarDatos();
    } catch (error) {
      toast.error('Error eliminando contacto');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Gestión de Contactos</h1>
        <p className="text-muted-foreground">Administra y consolida tu base de datos de contactos</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Base de datos unificada: prospects, academia, clientes, webinars y más. Todos los contactos aquí pueden ser segmentados en campañas.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
        </TabsList>

        {/* RESUMEN TAB */}
        <TabsContent value="resumen" className="space-y-4">
          <h2 className="text-2xl font-bold">Estadísticas de Contactos</h2>

          {loading ? (
            <div className="text-center py-8">Cargando estadísticas...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map((stat) => (
                <Card key={stat.fuente}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium capitalize">
                      {stat.fuente.replace(/_/g, ' ')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="text-2xl font-bold">{stat.cantidad}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Activos</p>
                        <p className="font-semibold">{stat.activos}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Suscritos</p>
                        <p className="font-semibold">{stat.suscritos}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Card className="border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900">Total General</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-blue-600">
                    {stats.reduce((sum, s) => sum + s.cantidad, 0)}
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    {stats.reduce((sum, s) => sum + s.suscritos, 0)} listos para campaña
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* CONTACTOS TAB */}
        <TabsContent value="contactos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Base de Datos de Contactos</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <Label className="text-sm">Filtrar por Categoría</Label>
              <Input
                placeholder="Ej: lead, cliente, prospect..."
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-48"
              />
            </div>
            <div>
              <Label className="text-sm">Filtrar por Fuente</Label>
              <Input
                placeholder="Ej: prospects, academia..."
                value={filtroFuente}
                onChange={(e) => setFiltroFuente(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={cargarDatos} variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Aplicar filtros
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">Cargando contactos...</div>
          ) : contactos.length === 0 ? (
            <Card>
              <CardContent className="pt-8 text-center">
                <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No hay contactos con esos filtros</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Email</th>
                        <th className="text-left py-2 px-2">Nombre</th>
                        <th className="text-left py-2 px-2">Empresa</th>
                        <th className="text-left py-2 px-2">Categoría</th>
                        <th className="text-left py-2 px-2">Fuente</th>
                        <th className="text-left py-2 px-2">Estado</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactos.map((contacto) => (
                        <tr key={contacto.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 text-xs">{contacto.email}</td>
                          <td className="py-2 px-2">{contacto.nombre || '-'}</td>
                          <td className="py-2 px-2">{contacto.empresa || '-'}</td>
                          <td className="py-2 px-2 capitalize">
                            {contacto.categoria?.replace(/_/g, ' ') || '-'}
                          </td>
                          <td className="py-2 px-2 text-xs capitalize">
                            {contacto.fuente_datos || '-'}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              contacto.estado_suscripcion === 'suscrito'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {contacto.estado_suscripcion}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEliminarContacto(contacto.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IMPORTAR TAB */}
        <TabsContent value="importar" className="space-y-4">
          <h2 className="text-2xl font-bold">Importar Contactos</h2>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Consolida contactos de múltiples fuentes: prospects, academia, clientes, etc. Los duplicados (mismo email) se fusionan automáticamente.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Prospects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Importar contactos de la tabla prospects. Automáticamente fusiona duplicados.
                </p>
                <Button
                  onClick={handleImportarDeProspects}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Importando...' : 'Importar Prospects'}
                </Button>
              </CardContent>
            </Card>

            <Card className="opacity-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Academia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Próximamente: importar desde tabla academia_leads
                </p>
                <Button disabled className="w-full">
                  Próximamente
                </Button>
              </CardContent>
            </Card>

            <Card className="opacity-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Próximamente: importar desde tabla clientes
                </p>
                <Button disabled className="w-full">
                  Próximamente
                </Button>
              </CardContent>
            </Card>

            <Card className="opacity-50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  CSV Manual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Próximamente: carga manual de archivo CSV
                </p>
                <Button disabled className="w-full">
                  Próximamente
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
