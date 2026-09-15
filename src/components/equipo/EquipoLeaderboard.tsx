import { Loader2, Trophy, Target, TrendingUp, DollarSign, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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
import { useEquipoDashboard, type VendedorDashboard } from '@/hooks/useEquipo';

const COLORS = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

function formatCLP(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Fila del ranking: el vendedor más su posición por ingresos (fija, aunque se reordene la tabla). */
type FilaRanking = VendedorDashboard & { posicion: number };

const MEDALLAS = ['🥇', '🥈', '🥉'];

const COLUMNAS_RANKING: DataTableColumn<FilaRanking>[] = [
  {
    id: 'posicion',
    header: '#',
    headerClassName: 'w-12',
    sortValue: (m) => m.posicion,
    cell: (m) =>
      m.posicion <= 3 ? (
        <span className="text-lg">{MEDALLAS[m.posicion - 1]}</span>
      ) : (
        <span className="text-sm text-muted-foreground font-mono">{m.posicion}</span>
      ),
  },
  {
    id: 'vendedor',
    header: 'Vendedor',
    sortValue: (m) => m.nombre,
    exportValue: (m) => `${m.nombre} <${m.email}>`,
    cell: (m) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {m.nombre.split(' ').map((n) => n[0]).join('').slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{m.nombre}</div>
          <div className="text-xs text-muted-foreground">{m.email}</div>
        </div>
      </div>
    ),
  },
  { id: 'asignadas', header: 'Asignadas', align: 'center', sortValue: (m) => m.total_asignadas, cell: (m) => <Badge variant="outline">{m.total_asignadas}</Badge> },
  { id: 'postuladas', header: 'Postuladas', align: 'center', sortValue: (m) => m.postuladas, cell: (m) => <Badge variant="secondary">{m.postuladas}</Badge> },
  {
    id: 'adjudicadas',
    header: 'Adjudicadas',
    align: 'center',
    sortValue: (m) => m.adjudicadas,
    cell: (m) => <Badge className="bg-green-500/10 text-green-600 border-green-500/30">{m.adjudicadas}</Badge>,
  },
  {
    id: 'tasa',
    header: 'Win Rate',
    align: 'center',
    sortValue: (m) => m.tasa_exito,
    exportValue: (m) => `${m.tasa_exito}%`,
    cell: (m) => (
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-sm font-medium">{m.tasa_exito}%</span>
        <Progress value={m.tasa_exito} className="h-1.5 w-16" />
      </div>
    ),
  },
  {
    id: 'ingresos',
    header: 'Ingresos',
    align: 'right',
    sortValue: (m) => m.ingresos_generados,
    exportValue: (m) => m.ingresos_generados,
    className: 'font-mono font-medium',
    cell: (m) => formatCLP(m.ingresos_generados),
  },
];

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

  // Ranking por ingresos: la posición queda fija en la fila aunque el usuario reordene la tabla
  const leaderboard: FilaRanking[] = [...members]
    .sort((a, b) => b.ingresos_generados - a.ingresos_generados)
    .map((m, idx) => ({ ...m, posicion: idx + 1 }));

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
          <DataTable<FilaRanking>
            storageKey="equipo-leaderboard"
            rows={leaderboard}
            rowKey={(m) => m.vendedor_id}
            columns={COLUMNAS_RANKING}
            itemLabel="vendedores"
            searchText={(m) => `${m.nombre} ${m.email}`}
            searchPlaceholder="Buscar vendedor…"
            defaultSort={{ id: 'ingresos', dir: 'desc' }}
            exportFileName="leaderboard-equipo"
            emptyMessage="No hay datos de rendimiento aún"
            onRowClick={(m) => navigate(`/equipo/${m.vendedor_id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
