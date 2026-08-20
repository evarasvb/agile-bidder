import { EquipoTabs } from "@/components/equipo/EquipoTabs";
import { useState } from 'react';
import { Users, CalendarDays, BarChart3, UserPlus, Loader2, Trophy, Target, TrendingUp, DollarSign, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useVendedores, 
  useReporteEquipo, 
  useCalendarioVendedor, 
  useAsignacionesDetalle,
  useCreateVendedor 
} from '@/hooks/useVendedores';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
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

function ReporteEquipo() {
  const { data: reporte, isLoading } = useReporteEquipo();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      notation: 'compact',
    }).format(value);
  };

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Negocios</TableHead>
                <TableHead className="text-center">Postulados</TableHead>
                <TableHead className="text-center">Adjudicados</TableHead>
                <TableHead className="text-center">Tasa</TableHead>
                <TableHead className="text-right">Monto Adjudicado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reporte?.map((vendedor) => (
                <TableRow key={vendedor.vendedor_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {vendedor.nombre.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{vendedor.nombre}</div>
                        <div className="text-xs text-muted-foreground">{vendedor.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{vendedor.total_negocios}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{vendedor.postulados}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                      {vendedor.adjudicados}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-sm font-medium">
                        {vendedor.tasa_adjudicacion}%
                      </span>
                      <Progress 
                        value={vendedor.tasa_adjudicacion} 
                        className="h-1.5 w-16"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCurrency(vendedor.monto_adjudicado)}
                  </TableCell>
                </TableRow>
              ))}
              {(!reporte || reporte.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No hay vendedores con asignaciones
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
      <div className="flex justify-end">
        <Button onClick={() => setShowNewDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo Vendedor
        </Button>
      </div>

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
