import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Upload, Users, Filter, Trash2, Download, Youtube, Settings, X, Check, ChevronDown } from 'lucide-react';
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
  rubro: string | null;
  email_validado: boolean | null;
  estado_email: string | null;
}

interface SortConfig {
  key: keyof Contacto | null;
  direction: 'asc' | 'desc';
}

export default function MarketingContactosAdmin() {
  const [stats, setStats] = useState<ContactoStats[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [contactosFiltrados, setContactosFiltrados] = useState<Contacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingContacto, setEditingContacto] = useState<Contacto | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

  // Filtros
  const [searchText, setSearchText] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [filtroFuente, setFiltroFuente] = useState<string>('');
  const [filtroRubro, setFiltroRubro] = useState<string>('');
  const [filtroEstadoEmail, setFiltroEstadoEmail] = useState<string>('');
  const [filtroSuscripcion, setFiltroSuscripcion] = useState<string>('');

  // Estados únicos para dropdowns
  const [fuentes, setFuentes] = useState<string[]>([]);
  const [rubros, setRubros] = useState<string[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    aplicarFiltrosYOrdenamiento();
  }, [contactos, searchText, filtroCategoria, filtroFuente, filtroRubro, filtroEstadoEmail, filtroSuscripcion, sortConfig]);

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

      // Cargar todos los contactos (sin límite inicial)
      const { data: contactosData, error: contactosError } = await supabase
        .from('marketing_contactos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (!contactosError && contactosData) {
        setContactos(contactosData);

        // Extraer valores únicos para filtros
        const uniqueFuentes = [...new Set(contactosData.map(c => c.fuente_datos).filter(Boolean))].sort();
        const uniqueRubros = [...new Set(contactosData.map(c => c.rubro).filter(Boolean))].sort();
        const uniqueCategorias = [...new Set(contactosData.map(c => c.categoria).filter(Boolean))].sort();

        setFuentes(uniqueFuentes);
        setRubros(uniqueRubros);
        setCategorias(uniqueCategorias);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando datos de contactos');
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltrosYOrdenamiento = () => {
    let filtered = contactos;

    // Buscar texto en email, nombre, empresa
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(c =>
        (c.email?.toLowerCase().includes(search)) ||
        (c.nombre?.toLowerCase().includes(search)) ||
        (c.empresa?.toLowerCase().includes(search))
      );
    }

    // Filtrar por campos específicos
    if (filtroCategoria) filtered = filtered.filter(c => c.categoria === filtroCategoria);
    if (filtroFuente) filtered = filtered.filter(c => c.fuente_datos === filtroFuente);
    if (filtroRubro) filtered = filtered.filter(c => c.rubro === filtroRubro);
    if (filtroEstadoEmail) filtered = filtered.filter(c => c.estado_email === filtroEstadoEmail);
    if (filtroSuscripcion) filtered = filtered.filter(c => c.estado_suscripcion === filtroSuscripcion);

    // Ordenamiento
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];

        if (aVal === null || aVal === undefined) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'asc' ? -1 : 1;

        if (typeof aVal === 'string') {
          return sortConfig.direction === 'asc'
            ? aVal.localeCompare(bVal as string)
            : (bVal as string).localeCompare(aVal);
        }

        return sortConfig.direction === 'asc' ? (aVal as any) - (bVal as any) : (bVal as any) - (aVal as any);
      });
    }

    setContactosFiltrados(filtered);
  };

  const toggleSort = (key: keyof Contacto) => {
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      setSortConfig({ key, direction: 'asc' });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contactosFiltrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contactosFiltrados.map(c => c.id)));
    }
  };

  const toggleSelectContacto = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
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

  const handleImportarDeClientes = async () => {
    try {
      setLoading(true);

      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('email, empresa_nombre, nombre_responsable, rut')
        .limit(1000);

      if (clientesError) {
        toast.error('No se encontró tabla de clientes o error al acceder');
        return;
      }

      if (!clientes || clientes.length === 0) {
        toast.info('No hay registros en clientes para importar');
        return;
      }

      const contactosParaImportar = clientes.map((c: any) => ({
        email: c.email,
        nombre: c.nombre_responsable,
        empresa: c.empresa_nombre,
        categoria: 'cliente',
        fuente_datos: 'clientes',
        estado_suscripcion: 'suscrito',
        estado_contacto: 'activo',
        consentimiento_marketing: true,
        consentimiento_fecha: new Date().toISOString(),
      }));

      const { error: insertError } = await supabase
        .from('marketing_contactos')
        .upsert(contactosParaImportar, { onConflict: 'email' });

      if (insertError) throw insertError;

      await supabase.rpc('marketing_registrar_auditoria', {
        p_accion: 'importacion',
        p_fuente: 'clientes',
        p_cantidad: clientes.length,
      });

      toast.success(`Importados ${clientes.length} clientes`);
      setTimeout(cargarDatos, 1000);
    } catch (error) {
      console.error('Error importando clientes:', error);
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

  const handleGuardarContacto = async (contacto: Contacto) => {
    try {
      const { error } = await supabase
        .from('marketing_contactos')
        .update({
          nombre: contacto.nombre,
          empresa: contacto.empresa,
          categoria: contacto.categoria,
          rubro: contacto.rubro,
          estado_suscripcion: contacto.estado_suscripcion,
          etiquetas: contacto.etiquetas
        })
        .eq('id', contacto.id);

      if (error) throw error;

      toast.success('Contacto guardado');
      setEditingContacto(null);
      cargarDatos();
    } catch (error) {
      toast.error('Error guardando contacto');
    }
  };

  const handleEliminarSeleccionados = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona contactos para eliminar');
      return;
    }

    if (!confirm(`¿Eliminar ${selectedIds.size} contactos?`)) return;

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('marketing_contactos')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      toast.success(`${selectedIds.size} contactos eliminados`);
      setSelectedIds(new Set());
      cargarDatos();
    } catch (error) {
      toast.error('Error eliminando contactos');
    }
  };

  const handleActualizarSuscripcion = async (nuevoEstado: string) => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona contactos para actualizar');
      return;
    }

    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('marketing_contactos')
        .update({ estado_suscripcion: nuevoEstado })
        .in('id', idsArray);

      if (error) throw error;

      toast.success(`${selectedIds.size} contactos actualizados`);
      setSelectedIds(new Set());
      cargarDatos();
    } catch (error) {
      toast.error('Error actualizando contactos');
    }
  };

  const handleAñadirEtiqueta = async (etiqueta: string) => {
    if (selectedIds.size === 0) {
      toast.error('Selecciona contactos para etiquetar');
      return;
    }

    try {
      const idsArray = Array.from(selectedIds);
      const contactosAActualizar = contactosFiltrados.filter(c => selectedIds.has(c.id));

      for (const contacto of contactosAActualizar) {
        const etiquetas = new Set(contacto.etiquetas || []);
        etiquetas.add(etiqueta);

        await supabase
          .from('marketing_contactos')
          .update({ etiquetas: Array.from(etiquetas) })
          .eq('id', contacto.id);
      }

      toast.success(`Etiqueta "${etiqueta}" añadida a ${selectedIds.size} contactos`);
      setSelectedIds(new Set());
      cargarDatos();
    } catch (error) {
      toast.error('Error añadiendo etiqueta');
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
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
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
            <h2 className="text-2xl font-bold">Base de Datos de Contactos ({contactosFiltrados.length})</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>

          {/* Búsqueda global */}
          <div>
            <Label className="text-sm">Buscar (email, nombre, empresa)</Label>
            <Input
              placeholder="Escribe para buscar..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Filtros avanzados */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <Label className="text-xs">Categoría</Label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                <option value="">Todas</option>
                {categorias.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Fuente</Label>
              <select
                value={filtroFuente}
                onChange={(e) => setFiltroFuente(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                <option value="">Todas</option>
                {fuentes.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Rubro</Label>
              <select
                value={filtroRubro}
                onChange={(e) => setFiltroRubro(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                <option value="">Todos</option>
                {rubros.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <select
                value={filtroEstadoEmail}
                onChange={(e) => setFiltroEstadoEmail(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                <option value="">Todos</option>
                <option value="valido">Válido</option>
                <option value="invalido">Inválido</option>
                <option value="bounce">Bounce</option>
                <option value="no_verificado">No verificado</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Suscripción</Label>
              <select
                value={filtroSuscripcion}
                onChange={(e) => setFiltroSuscripcion(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded"
              >
                <option value="">Todos</option>
                <option value="suscrito">Suscrito</option>
                <option value="no_suscrito">No suscrito</option>
              </select>
            </div>
            {(searchText || filtroCategoria || filtroFuente || filtroRubro || filtroEstadoEmail || filtroSuscripcion) && (
              <div className="flex items-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearchText('');
                    setFiltroCategoria('');
                    setFiltroFuente('');
                    setFiltroRubro('');
                    setFiltroEstadoEmail('');
                    setFiltroSuscripcion('');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>

          {/* Toolbar de acciones en lote */}
          {selectedIds.size > 0 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 flex items-center justify-between">
                <div className="text-sm font-medium">
                  {selectedIds.size} contacto{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActualizarSuscripcion('suscrito')}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Suscribir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActualizarSuscripcion('no_suscrito')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Desuscribir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const etiqueta = prompt('¿Qué etiqueta añadir?');
                      if (etiqueta) handleAñadirEtiqueta(etiqueta);
                    }}
                  >
                    + Etiquetar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleEliminarSeleccionados}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {loading ? (
            <div className="text-center py-8">Cargando contactos...</div>
          ) : contactosFiltrados.length === 0 ? (
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
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-2 w-8">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === contactosFiltrados.length && contactosFiltrados.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('email')}
                        >
                          Email {sortConfig.key === 'email' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('nombre')}
                        >
                          Nombre {sortConfig.key === 'nombre' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('empresa')}
                        >
                          Empresa {sortConfig.key === 'empresa' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-left py-2 px-2">Rubro</th>
                        <th className="text-left py-2 px-2">Fuente</th>
                        <th className="text-left py-2 px-2">Email</th>
                        <th
                          className="text-left py-2 px-2 cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('estado_suscripcion')}
                        >
                          Estado {sortConfig.key === 'estado_suscripcion' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="py-2 px-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {contactosFiltrados.map((contacto) => (
                        <tr key={contacto.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(contacto.id)}
                              onChange={() => toggleSelectContacto(contacto.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="py-2 px-2 text-xs font-mono">{contacto.email}</td>
                          <td className="py-2 px-2 text-sm">{contacto.nombre || '-'}</td>
                          <td className="py-2 px-2 text-sm">{contacto.empresa || '-'}</td>
                          <td className="py-2 px-2 text-xs capitalize">{contacto.rubro || '-'}</td>
                          <td className="py-2 px-2 text-xs capitalize">{contacto.fuente_datos || '-'}</td>
                          <td className="py-2 px-2 text-xs">
                            {contacto.email_validado ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-100 text-green-800">
                                <Check className="w-3 h-3" /> {contacto.estado_email}
                              </span>
                            ) : (
                              <span className="text-gray-500">No validado</span>
                            )}
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
                          <td className="py-2 px-2 text-right flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContacto(contacto)}
                            >
                              Editar
                            </Button>
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

          {/* Modal de edición */}
          {editingContacto && (
            <Card className="fixed inset-0 z-50 m-4 overflow-y-auto bg-white">
              <CardHeader className="flex justify-between items-center">
                <CardTitle>Editar Contacto</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingContacto(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 max-w-2xl">
                <div>
                  <Label>Email (no editable)</Label>
                  <Input value={editingContacto.email} disabled />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={editingContacto.nombre || ''}
                      onChange={(e) => setEditingContacto({ ...editingContacto, nombre: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Empresa</Label>
                    <Input
                      value={editingContacto.empresa || ''}
                      onChange={(e) => setEditingContacto({ ...editingContacto, empresa: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Categoría</Label>
                    <select
                      value={editingContacto.categoria || ''}
                      onChange={(e) => setEditingContacto({ ...editingContacto, categoria: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="">Seleccionar</option>
                      {categorias.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Rubro</Label>
                    <select
                      value={editingContacto.rubro || ''}
                      onChange={(e) => setEditingContacto({ ...editingContacto, rubro: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="">Seleccionar</option>
                      {rubros.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Estado de Suscripción</Label>
                    <select
                      value={editingContacto.estado_suscripcion || ''}
                      onChange={(e) => setEditingContacto({ ...editingContacto, estado_suscripcion: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      <option value="suscrito">Suscrito</option>
                      <option value="no_suscrito">No suscrito</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Etiquetas (separadas por coma)</Label>
                  <Input
                    value={(editingContacto.etiquetas || []).join(', ')}
                    onChange={(e) => setEditingContacto({
                      ...editingContacto,
                      etiquetas: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    })}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditingContacto(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => handleGuardarContacto(editingContacto)}>
                    Guardar
                  </Button>
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

            <Card className="cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Importar contactos de la tabla clientes. Se clasifican automáticamente.
                </p>
                <Button
                  onClick={handleImportarDeClientes}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Importando...' : 'Importar Clientes'}
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

        {/* YOUTUBE TAB */}
        <TabsContent value="youtube" className="space-y-4">
          <h2 className="text-2xl font-bold">Integración con YouTube</h2>

          <Alert>
            <Youtube className="h-4 w-4" />
            <AlertDescription>
              Conecta tu canal de YouTube para sincronizar suscriptores como contactos de marketing. Tus suscriptores se importarán automáticamente a la base de datos unificada.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-600" />
                Conectar Canal de YouTube
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Pasos para conectar:</Label>
                  <ol className="text-sm text-muted-foreground mt-2 space-y-1 ml-4 list-decimal">
                    <li>Ve a <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                    <li>Crea un nuevo proyecto (o selecciona uno existente)</li>
                    <li>Habilita la YouTube Data API v3</li>
                    <li>Crea credenciales OAuth 2.0 (tipo: Aplicación Web)</li>
                    <li>Descarga el archivo JSON con las credenciales</li>
                    <li>Pega aquí tu <code className="bg-gray-100 px-2 py-1 rounded text-xs">client_id</code> y <code className="bg-gray-100 px-2 py-1 rounded text-xs">client_secret</code></li>
                  </ol>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium">OAuth Redirect URI:</p>
                  <code className="block bg-white p-2 rounded text-xs border text-gray-600 truncate">
                    {`${window.location.origin}/auth/youtube/callback`}
                  </code>
                  <p className="text-xs text-blue-600">Agrega esta URL a los "Orígenes autorizados" en Google Cloud</p>
                </div>

                <Button disabled className="w-full gap-2 mt-4">
                  <Settings className="w-4 h-4" />
                  Configurar cuando tengas credenciales
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Esta función se activará cuando proporciones tus credenciales OAuth de YouTube
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Canales Conectados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay canales conectados aún. Completa la configuración arriba para empezar.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
