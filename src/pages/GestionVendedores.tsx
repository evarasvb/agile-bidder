import { EquipoTabs } from "@/components/equipo/EquipoTabs";
import { useState } from 'react';
import { Users, CalendarDays, BarChart3, UserPlus, Loader2, Trophy, Target, TrendingUp, DollarSign } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useVendedores,
  useReporteEquipo,
  useCalendarioVendedor,
  useAsignacionesDetalle,
  useCreateVendedor,
  useEsDuenoEquipo,
  type ReporteEquipo as ReporteVendedor,
} from '@/hooks/useVendedores';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function CalendarioVendedores() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedVendedor, setSelectedVendedor] = useState<string>('todos');
  const [selectedEstado, setSelectedEstado] = useState<string>('todos');
  
  const { data: vendedores } = useVendedores();
  const { data: eventos, isLoading } = useCalendarioVendedor(
    selectedVendedor !== 'todos' ? selectedVendedor : undefined
  );
  const { data: asignaciones } = useAsignacionesDetalle();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Agrupar asignaciones por fecha de cierre
  const asignacionesByDate = asignaciones?.reduce((acc, asig) => {
    if (!asig.fecha_cierre) return acc;
    const dateKey = format(new Date(asig.fecha_cierre), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    
    // Filtrar por vendedor y estado
    if (selectedVendedor !== 'todos' && asig.vendedor_id !== selectedVendedor) return acc;
    if (selectedEstado !== 'todos' && asig.estado !== selectedEstado) return acc;
    
    acc[dateKey].push(asig);
    return acc;
  }, {} as Record<string, typeof asignaciones>) || {};

  const estadoColors: Record<string, string> = {
    asignada: 'bg-blue-500',
    postulada: 'bg-amber-500',
    adjudicada: 'bg-green-500',
    perdida: 'bg-red-500',
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            ← Anterior
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Hoy
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            Siguiente →
          </Button>
        </div>
        
        <h2 className="text-lg font-semibold capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: es })}
        </h2>

        <div className="flex gap-2">
          <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todos los vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los vendedores</SelectItem>
              {vendedores?.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEstado} onValueChange={setSelectedEstado}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="asignada">Asignadas</SelectItem>
              <SelectItem value="postulada">Postuladas</SelectItem>
              <SelectItem value="adjudicada">Adjudicadas</SelectItem>
              <SelectItem value="perdida">Perdidas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendario */}
      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Headers de días */}
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Días vacíos al inicio */}
              {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="p-2 min-h-[100px]" />
              ))}
              
              {/* Días del mes */}
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayAsignaciones = asignacionesByDate[dateKey] || [];
                
                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "p-2 min-h-[100px] border rounded-lg transition-colors",
                      isToday(day) && "bg-primary/10 border-primary",
                      !isToday(day) && "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-medium mb-1",
                      isToday(day) && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayAsignaciones.slice(0, 3).map((asig) => (
                        <div
                          key={asig.id}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded text-white truncate",
                            estadoColors[asig.estado] || 'bg-gray-500'
                          )}
                          title={`${asig.licitacion_codigo} - ${asig.vendedor_nombre}`}
                        >
                          {asig.vendedor_nombre?.split(' ')[0]}: {formatCurrency(asig.monto_estimado)}
                        </div>
                      ))}
                      {dayAsignaciones.length > 3 && (
                        <div className="text-[10px] text-muted-foreground text-center">
                          +{dayAsignaciones.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 justify-center">
        {Object.entries(estadoColors).map(([estado, color]) => (
          <div key={estado} className="flex items-center gap-2 text-sm">
            <div className={cn("w-3 h-3 rounded", color)} />
            <span className="capitalize">{estado}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const formatMontoCompacto = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', notation: 'compact' }).format(value);

const COLUMNAS_VENDEDORES: DataTableColumn<ReporteVendedor>[] = [
  {
    id: 'vendedor',
    header: 'Vendedor',
    sortValue: (v) => v.nombre,
    exportValue: (v) => `${v.nombre} <${v.email}>`,
    cell: (v) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {v.nombre.split(' ').map((n) => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{v.nombre}</div>
          <div className="text-xs text-muted-foreground">{v.email}</div>
        </div>
      </div>
    ),
  },
  { id: 'negocios', header: 'Negocios', align: 'center', sortValue: (v) => v.total_negocios, cell: (v) => <Badge variant="outline">{v.total_negocios}</Badge> },
  { id: 'postulados', header: 'Postulados', align: 'center', sortValue: (v) => v.postulados, cell: (v) => <Badge variant="secondary">{v.postulados}</Badge> },
  {
    id: 'adjudicados',
    header: 'Adjudicados',
    align: 'center',
    sortValue: (v) => v.adjudicados,
    cell: (v) => <Badge className="bg-green-500/10 text-green-600 border-green-500/30">{v.adjudicados}</Badge>,
  },
  {
    id: 'tasa',
    header: 'Tasa',
    align: 'center',
    sortValue: (v) => v.tasa_adjudicacion,
    exportValue: (v) => `${v.tasa_adjudicacion}%`,
    cell: (v) => (
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-sm font-medium">{v.tasa_adjudicacion}%</span>
        <Progress value={v.tasa_adjudicacion} className="h-1.5 w-16" />
      </div>
    ),
  },
  {
    id: 'monto',
    header: 'Monto Adjudicado',
    align: 'right',
    sortValue: (v) => v.monto_adjudicado,
    exportValue: (v) => v.monto_adjudicado,
    className: 'font-mono font-medium',
    cell: (v) => formatMontoCompacto(v.monto_adjudicado),
  },
];

function ReporteEquipo() {
  const { data: reporte, isLoading } = useReporteEquipo();
  const formatCurrency = formatMontoCompacto;

  // Calcular totales
  const totales = reporte?.reduce((acc, v) => ({
    negocios: acc.negocios + v.total_negocios,
    postulados: acc.postulados + v.postulados,
    adjudicados: acc.adjudicados + v.adjudicados,
    monto: acc.monto + v.monto_adjudicado,
  }), { negocios: 0, postulados: 0, adjudicados: 0, monto: 0 });

  const tasaGeneral = totales && totales.postulados > 0 
    ? ((totales.adjudicados / totales.postulados) * 100).toFixed(1) 
    : '0';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Generales */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Negocios</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totales?.negocios || 0}</div>
            <p className="text-xs text-muted-foreground">Licitaciones asignadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Postulados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totales?.postulados || 0}</div>
            <p className="text-xs text-muted-foreground">Ofertas enviadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adjudicados</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totales?.adjudicados || 0}</div>
            <p className="text-xs text-muted-foreground">
              Tasa: {tasaGeneral}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monto Adjudicado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totales?.monto || 0)}</div>
            <p className="text-xs text-muted-foreground">Total ganado</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de vendedores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Rendimiento por Vendedor
          </CardTitle>
          <CardDescription>
            KPIs individuales del equipo comercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable<ReporteVendedor>
            storageKey="equipo-rendimiento"
            rows={reporte ?? []}
            rowKey={(v) => v.vendedor_id}
            columns={COLUMNAS_VENDEDORES}
            itemLabel="vendedores"
            searchText={(v) => `${v.nombre} ${v.email}`}
            searchPlaceholder="Buscar vendedor…"
            defaultSort={{ id: 'monto', dir: 'desc' }}
            exportFileName="rendimiento-vendedores"
            emptyMessage="No hay vendedores con asignaciones"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ListaVendedores() {
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newVendedor, setNewVendedor] = useState({ nombre: '', email: '' });
  
  const { data: vendedores, isLoading } = useVendedores();
  const { data: reporte } = useReporteEquipo();
  const createMutation = useCreateVendedor();
  // Solo el dueño puede crear vendedores: la fila quedaría con invitado_por =
  // el propio auth.uid() de quien la crea (única opción que el trigger de la
  // tabla permite), y el roster la scopea por el dueño efectivo — si la crea
  // un miembro invitado, nadie (ni el dueño ni ese mismo miembro) la vuelve a ver.
  const { data: esDueno } = useEsDuenoEquipo();

  const handleCreate = () => {
    if (!newVendedor.nombre || !newVendedor.email) {
      toast.error('Completa todos los campos');
      return;
    }
    
    createMutation.mutate({
      nombre: newVendedor.nombre,
      email: newVendedor.email,
      rol: 'vendedor',
      activo: true,
      user_id: null,
    }, {
      onSuccess: () => {
        setShowNewDialog(false);
        setNewVendedor({ nombre: '', email: '' });
      },
    });
  };

  const getVendedorStats = (vendedorId: string) => {
    return reporte?.find(r => r.vendedor_id === vendedorId);
  };

  return (
    <div className="space-y-4">
      {esDueno && (
        <div className="flex justify-end">
          <Button onClick={() => setShowNewDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nuevo Vendedor
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vendedores?.map((vendedor) => {
            const stats = getVendedorStats(vendedor.id);
            return (
              <Card key={vendedor.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {vendedor.nombre.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-semibold">{vendedor.nombre}</h3>
                      <p className="text-sm text-muted-foreground">{vendedor.email}</p>
                      <Badge variant="secondary" className="mt-1">{vendedor.rol}</Badge>
                    </div>
                  </div>
                  
                  {stats && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold">{stats.total_negocios}</div>
                        <div className="text-xs text-muted-foreground">Negocios</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-600">{stats.adjudicados}</div>
                        <div className="text-xs text-muted-foreground">Ganados</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{stats.tasa_adjudicacion}%</div>
                        <div className="text-xs text-muted-foreground">Tasa</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog nuevo vendedor */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input
                value={newVendedor.nombre}
                onChange={(e) => setNewVendedor({ ...newVendedor, nombre: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newVendedor.email}
                onChange={(e) => setNewVendedor({ ...newVendedor, email: e.target.value })}
                placeholder="juan@empresa.cl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function GestionVendedores() {
  return (
    <div className="space-y-6">
      <EquipoTabs />
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Gestión de Vendedores
        </h1>
        <p className="text-muted-foreground mt-1">
          Administra tu equipo comercial y sus asignaciones
        </p>
      </div>

      <Tabs defaultValue="calendario" className="w-full">
        <TabsList>
          <TabsTrigger value="calendario" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="reporte" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Reporte de Equipo
          </TabsTrigger>
          <TabsTrigger value="vendedores" className="gap-2">
            <Users className="h-4 w-4" />
            Vendedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-6">
          <CalendarioVendedores />
        </TabsContent>

        <TabsContent value="reporte" className="mt-6">
          <ReporteEquipo />
        </TabsContent>

        <TabsContent value="vendedores" className="mt-6">
          <ListaVendedores />
        </TabsContent>
      </Tabs>
    </div>
  );
}
