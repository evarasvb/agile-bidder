import { Loader2, Target, TrendingUp, Trophy, DollarSign, Briefcase, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useVendedorPipelineItems, type VendedorDashboard as VendedorDashboardType } from '@/hooks/useEquipo';
import { ETAPA_CONFIG, type PipelineEtapa } from '@/components/pipeline/pipelineConstants';

interface VendedorDashboardProps {
  vendedor: VendedorDashboardType;
}

const STAGE_COLORS: Record<string, string> = {
  descubierta: '#64748b',
  seguimiento: '#3b82f6',
  preparacion: '#f59e0b',
  postulada: '#a855f7',
  evaluacion: '#f97316',
  adjudicada: '#22c55e',
  oc_emitida: '#14b8a6',
  pagada: '#059669',
};

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCLPFull(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function VendedorDashboard({ vendedor }: VendedorDashboardProps) {
  const { data: pipelineItems, isLoading: loadingItems } = useVendedorPipelineItems(vendedor.vendedor_id);

  const initials = vendedor.nombre
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  // Calculate stage distribution for pie chart
  const stageDistribution = ((pipelineItems || []) as any[]).reduce<Record<string, number>>((acc: Record<string, number>, item: any) => {
    const pipeline = item.pipeline as any;
    if (pipeline?.etapa) {
      acc[pipeline.etapa] = (acc[pipeline.etapa] || 0) + 1;
    }
    return acc;
  }, {});

  const pieData = Object.entries(stageDistribution).map(([etapa, count]) => ({
    name: ETAPA_CONFIG[etapa as PipelineEtapa]?.label || etapa,
    value: count,
    color: STAGE_COLORS[etapa] || '#94a3b8',
  }));

  return (
    <div className="space-y-6">
      {/* Vendor header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{vendedor.nombre}</h1>
          <p className="text-muted-foreground">{vendedor.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{vendedor.rol}</Badge>
            {vendedor.telefono && (
              <span className="text-sm text-muted-foreground">{vendedor.telefono}</span>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendedor.total_asignadas}</div>
            <p className="text-xs text-muted-foreground">Asignadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Postulaciones</CardTitle>
            <Briefcase className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendedor.postuladas}</div>
            <p className="text-xs text-muted-foreground">Realizadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adjudicaciones</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{vendedor.adjudicadas}</div>
            <p className="text-xs text-muted-foreground">Ganadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendedor.tasa_exito}%</div>
            <p className="text-xs text-muted-foreground">Win rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCLP(vendedor.ingresos_generados)}</div>
            <p className="text-xs text-muted-foreground">Generados</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      {pieData.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pipeline distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline por Etapa</CardTitle>
              <CardDescription>Distribución de oportunidades asignadas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stage bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Oportunidades por Etapa</CardTitle>
              <CardDescription>Cantidad por fase del pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" angle={-30} textAnchor="end" height={60} />
                    <YAxis className="text-xs" />
                    <Tooltip />
                    <Bar dataKey="value" name="Oportunidades" radius={[4, 4, 0, 0]}>
                      {pieData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assigned opportunities table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Oportunidades Asignadas
          </CardTitle>
          <CardDescription>
            Todas las oportunidades del pipeline asignadas a {vendedor.nombre.split(' ')[0]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead className="text-center">Etapa</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Fecha Cierre</TableHead>
                  <TableHead>Asignado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pipelineItems || []).map((item) => {
                  const pipeline = item.pipeline as any;
                  if (!pipeline) return null;
                  const etapaConfig = ETAPA_CONFIG[pipeline.etapa as PipelineEtapa];
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="max-w-[250px]">
                        <p className="font-medium text-sm truncate">{pipeline.titulo}</p>
                        <p className="text-xs text-muted-foreground">{pipeline.oportunidad_tipo}</p>
                      </TableCell>
                      <TableCell className="text-sm">{pipeline.institucion || '-'}</TableCell>
                      <TableCell className="text-center">
                        {etapaConfig && (
                          <Badge className={etapaConfig.badgeColor}>{etapaConfig.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {pipeline.monto_estimado
                          ? formatCLPFull(pipeline.monto_estimado)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {pipeline.fecha_cierre
                          ? format(parseISO(pipeline.fecha_cierre), 'dd MMM yyyy', { locale: es })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(item.fecha_asignacion), 'dd MMM', { locale: es })}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!pipelineItems || pipelineItems.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No tiene oportunidades asignadas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
