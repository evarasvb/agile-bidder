import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, TrendingUp, Filter, Search, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOfertas, useOfertasStats, Oferta } from '@/hooks/useOfertas';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoConfig: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: 'bg-muted text-muted-foreground' },
  revision: { label: 'En Revisión', color: 'bg-warning/10 text-warning' },
  aprobada: { label: 'Aprobada', color: 'bg-success/10 text-success' },
  enviada: { label: 'Enviada', color: 'bg-firmavb-blue/10 text-firmavb-blue' },
  rechazada: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive' },
  ganada: { label: 'Ganada', color: 'bg-success text-success-foreground' },
  perdida: { label: 'Perdida', color: 'bg-muted text-muted-foreground' },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Ofertas() {
  const navigate = useNavigate();
  const { data: ofertas = [], isLoading } = useOfertas();
  const { data: stats } = useOfertasStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [filtroOrden, setFiltroOrden] = useState<string>('cierre');

  const ofertasFiltradas = ofertas
    .filter((oferta) => {
      if (filtroEstado !== 'todas' && oferta.estado !== filtroEstado) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          oferta.licitacion?.id_licitacion?.toLowerCase().includes(search) ||
          oferta.licitacion?.titulo?.toLowerCase().includes(search) ||
          oferta.licitacion?.organismo?.toLowerCase().includes(search)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (filtroOrden === 'cierre') {
        const fechaA = a.licitacion?.fecha_cierre ? new Date(a.licitacion.fecha_cierre).getTime() : Infinity;
        const fechaB = b.licitacion?.fecha_cierre ? new Date(b.licitacion.fecha_cierre).getTime() : Infinity;
        return fechaA - fechaB;
      }
      if (filtroOrden === 'match') {
        return (b.match_score || 0) - (a.match_score || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const calcularDiasRestantes = (fechaCierre: string | null) => {
    if (!fechaCierre) return null;
    return differenceInDays(parseISO(fechaCierre), new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis Ofertas</h1>
          <p className="text-muted-foreground">Gestiona tus ofertas automáticas generadas por FirmaVB</p>
        </div>
        <div className="flex gap-3">
          <Card className="border-firmavb-blue/20 bg-firmavb-blue/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-firmavb-blue/10 p-2">
                <FileText className="h-5 w-5 text-firmavb-blue" />
              </div>
              <div>
                <p className="text-2xl font-bold text-firmavb-blue">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Ofertas Totales</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-success/20 bg-success/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-success/10 p-2">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(stats?.valorTotalPendiente || 0)}
                </p>
                <p className="text-xs text-muted-foreground">Valor Pendiente</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, título u organismo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos los estados</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="revision">En Revisión</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="ganada">Ganada</SelectItem>
              <SelectItem value="perdida">Perdida</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroOrden} onValueChange={setFiltroOrden}>
            <SelectTrigger className="w-[180px]">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cierre">Próximos a cerrar</SelectItem>
              <SelectItem value="match">Mayor match</SelectItem>
              <SelectItem value="reciente">Más recientes</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Ofertas Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))}
        </div>
      ) : ofertasFiltradas.length === 0 ? (
        <Card className="py-12 text-center">
          <CardContent>
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No hay ofertas</h3>
            <p className="text-sm text-muted-foreground">
              Las ofertas se generan automáticamente cuando hay matches con licitaciones
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ofertasFiltradas.map((oferta) => (
            <OfertaCard
              key={oferta.id}
              oferta={oferta}
              diasRestantes={calcularDiasRestantes(oferta.licitacion?.fecha_cierre || null)}
              onClick={() => navigate(`/ofertas/${oferta.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface OfertaCardProps {
  oferta: Oferta;
  diasRestantes: number | null;
  onClick: () => void;
}

function OfertaCard({ oferta, diasRestantes, onClick }: OfertaCardProps) {
  const { label: estadoLabel, color: estadoColor } = estadoConfig[oferta.estado] || estadoConfig.borrador;
  const totalItems = oferta.productos_ofertados?.length || 0;
  const matchedItems = oferta.productos_ofertados?.length || 0;
  const matchPercent = oferta.match_score || 0;
  const presupuesto = oferta.licitacion?.presupuesto || 0;
  const ofertado = oferta.valor_total_oferta;
  const excedido = presupuesto > 0 && ofertado > presupuesto;

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-firmavb-blue"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono text-muted-foreground">
              {oferta.licitacion?.id_licitacion || 'Sin código'}
            </p>
            <Badge className={estadoColor}>{estadoLabel}</Badge>
          </div>
          {diasRestantes !== null && (
            <div
              className={`text-xs font-medium px-2 py-1 rounded ${
                diasRestantes <= 2
                  ? 'bg-firmavb-red/10 text-firmavb-red'
                  : diasRestantes <= 5
                  ? 'bg-warning/10 text-warning'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {diasRestantes <= 0 ? 'Cerrada' : `${diasRestantes}d`}
            </div>
          )}
        </div>
        <CardTitle className="text-sm font-medium line-clamp-2 mt-2">
          {oferta.licitacion?.titulo || 'Sin título'}
        </CardTitle>
        <p className="text-xs text-muted-foreground truncate">
          {oferta.licitacion?.organismo || 'Organismo no especificado'}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Match Progress */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">{matchedItems} items emparejados</span>
            <span className="font-medium text-firmavb-blue">{matchPercent}%</span>
          </div>
          <Progress value={matchPercent} className="h-2" />
        </div>

        {/* Dates */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Creada: {format(new Date(oferta.created_at), 'dd MMM', { locale: es })}</span>
          <span>
            Cierre:{' '}
            {oferta.licitacion?.fecha_cierre
              ? format(new Date(oferta.licitacion.fecha_cierre), 'dd MMM', { locale: es })
              : '-'}
          </span>
        </div>

        {/* Budget vs Offered */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Presupuesto</p>
            <p className="text-sm font-mono font-medium">
              {presupuesto > 0 ? formatCurrency(presupuesto) : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ofertado</p>
            <p className={`text-sm font-mono font-medium ${excedido ? 'text-firmavb-red' : ''}`}>
              {formatCurrency(ofertado)}
            </p>
          </div>
        </div>

        {/* View Details */}
        <div className="flex items-center justify-end text-xs text-firmavb-blue group-hover:underline">
          Ver detalle <ChevronRight className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
