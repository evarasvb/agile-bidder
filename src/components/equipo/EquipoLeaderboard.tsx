import { Loader2, Trophy, Target, TrendingUp, DollarSign, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useEquipoDashboard } from '@/hooks/useEquipo';

const COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function EquipoLeaderboard() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading } = useEquipoDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const members = dashboard || [];

  // Team-level totals
  const teamTotals = members.reduce(
    (acc, m) => ({
      asignadas: acc.asignadas + m.total_asignadas,
      adjudicadas: acc.adjudicadas + m.adjudicadas,
      ingresos: acc.ingresos + m.ingresos_generados,
      postuladas: acc.postuladas + m.postuladas,
    }),
    { asignadas: 0, adjudicadas: 0, ingresos: 0, postuladas: 0 }
  );

  const teamWinRate = teamTotals.postuladas > 0
    ? ((teamTotals.adjudicadas / teamTotals.postuladas) * 100).toFixed(1)
    : '0';

  // Data for workload chart
  const workloadData = members.map((m) => ({
    nombre: m.nombre.split(' ')[0],
    asignadas: m.total_asignadas,
    adjudicadas: m.adjudicadas,
  }));

  // Leaderboard sorted by ingresos
  const leaderboard = [...members].sort((a, b) => b.ingresos_generados - a.ingresos_generados);

  return (
    <div className="space-y-6">
      {/* Team KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asignadas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamTotals.asignadas}</div>
            <p className="text-xs text-muted-foreground">Oportunidades del equipo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adjudicadas</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{teamTotals.adjudicadas}</div>
            <p className="text-xs text-muted-foreground">Licitaciones ganadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamWinRate}%</div>
            <p className="text-xs text-muted-foreground">Win rate del equipo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCLP(teamTotals.ingresos)}</div>
            <p className="text-xs text-muted-foreground">Revenue generado</p>
          </CardContent>
        </Card>
      </div>

      {/* Workload distribution chart */}
      {workloadData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Distribución de Carga de Trabajo
            </CardTitle>
            <CardDescription>Asignaciones por vendedor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="nombre" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background))',
                    }}
                  />
                  <Bar dataKey="asignadas" name="Asignadas" radius={[4, 4, 0, 0]}>
                    {workloadData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                  <Bar dataKey="adjudicadas" name="Adjudicadas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Leaderboard
          </CardTitle>
          <CardDescription>Ranking por ingresos generados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">Asignadas</TableHead>
                <TableHead className="text-center">Postuladas</TableHead>
                <TableHead className="text-center">Adjudicadas</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.map((member, idx) => (
                <TableRow
                  key={member.vendedor_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/equipo/${member.vendedor_id}`)}
                >
                  <TableCell>
                    {idx === 0 ? (
                      <span className="text-lg">🥇</span>
                    ) : idx === 1 ? (
                      <span className="text-lg">🥈</span>
                    ) : idx === 2 ? (
                      <span className="text-lg">🥉</span>
                    ) : (
                      <span className="text-sm text-muted-foreground font-mono">{idx + 1}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {member.nombre
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.nombre}</div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{member.total_asignadas}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{member.postuladas}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                      {member.adjudicadas}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono text-sm font-medium">{member.tasa_exito}%</span>
                      <Progress value={member.tasa_exito} className="h-1.5 w-16" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    {formatCLP(member.ingresos_generados)}
                  </TableCell>
                </TableRow>
              ))}
              {leaderboard.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay datos de rendimiento aún
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
