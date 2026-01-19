import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Clock, TrendingUp, Filter, Search, ChevronRight, Send, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOfertas, useOfertasStats, Oferta } from '@/hooks/useOfertas';
import { format, differenceInDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador: { label: 'Borrador', color: 'bg-muted text-muted-foreground', icon: <FileText className="h-4 w-4" /> },
  revision: { label: 'En Revisión', color: 'bg-warning/10 text-warning', icon: <AlertCircle className="h-4 w-4" /> },
  aprobada: { label: 'Aprobada', color: 'bg-success/10 text-success', icon: <CheckCircle className="h-4 w-4" /> },
  enviada: { label: 'Enviada', color: 'bg-firmavb-blue/10 text-firmavb-blue', icon: <Send className="h-4 w-4" /> },
  rechazada: { label: 'Rechazada', color: 'bg-destructive/10 text-destructive', icon: <XCircle className="h-4 w-4" /> },
  ganada: { label: 'Ganada', color: 'bg-success text-success-foreground', icon: <CheckCircle className="h-4 w-4" /> },
  perdida: { label: 'Perdida', color: 'bg-muted text-muted-foreground', icon: <XCircle className="h-4 w-4" /> },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MyBids() {
  const navigate = useNavigate();
  const { data: ofertas = [], isLoading } = useOfertas();
  const { data: stats, isLoading: isLoadingStats } = useOfertasStats();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [filtroOrden, setFiltroOrden] = useState<string>('reciente');

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
      if (filtroOrden === 'monto') {
        return b.valor_total_oferta - a.valor_total_oferta;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const calcularDiasRestantes = (fechaCierre: string | null) => {
    if (!fechaCierre) return null;
    try {
      return differenceInDays(parseISO(fechaCierre), new Date());
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Mis Ofertas</h1>
          <p className="text-muted-foreground">
            Gestiona y da seguimiento a tus ofertas enviadas
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {isLoadingStats ? '...' : stats?.total || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Ofertas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-firmavb-blue/20 bg-firmavb-blue/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-firmavb-blue/10 p-2">
              <Send className="h-5 w-5 text-firmavb-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold text-firmavb-blue">
                {isLoadingStats ? '...' : stats?.porEstado?.enviada || 0}
              </p>
              <p className="text-xs text-muted-foreground">Enviadas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">
                {isLoadingStats ? '...' : stats?.porEstado?.ganada || 0}
              </p>
              <p className="text-xs text-muted-foreground">Ganadas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2">
              <TrendingUp className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">
                {isLoadingStats ? '...' : `${stats?.tasaConversion || 0}%`}
              </p>
              <p className="text-xs text-muted-foreground">Tasa de Conversión</p>
            </div>
          </CardContent>
        </Card>
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

          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Filtra ofertas por estado</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={filtroOrden} onValueChange={setFiltroOrden}>
                <SelectTrigger className="w-[180px]">
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reciente">Más recientes</SelectItem>
                  <SelectItem value="cierre">Próximos a cerrar</SelectItem>
                  <SelectItem value="match">Mayor match</SelectItem>
                  <SelectItem value="monto">Mayor monto</SelectItem>
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Ordena las ofertas</p>
            </TooltipContent>
          </Tooltip>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {ofertasFiltradas.length} ofertas encontradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : ofertasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No hay ofertas</h3>
              <p className="text-sm text-muted-foreground">
                Las ofertas se generan automáticamente cuando hay matches con licitaciones
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">Código</TableHead>
                    <TableHead>Licitación</TableHead>
                    <TableHead className="w-[200px]">Organismo</TableHead>
                    <TableHead className="w-[120px] text-right">Monto Ofertado</TableHead>
                    <TableHead className="w-[100px] text-center">Match</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                    <TableHead className="w-[100px]">Fecha Envío</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ofertasFiltradas.map((oferta) => {
                    const { label, color, icon } = estadoConfig[oferta.estado] || estadoConfig.borrador;
                    const diasRestantes = calcularDiasRestantes(oferta.licitacion?.fecha_cierre || null);
                    
                    return (
                      <TableRow
                        key={oferta.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/ofertas/${oferta.id}`)}
                      >
                        <TableCell className="font-mono text-xs">
                          {oferta.licitacion?.id_licitacion || '-'}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <span className="line-clamp-2 text-sm">
                            {oferta.licitacion?.titulo || 'Sin título'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {oferta.licitacion?.organismo || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(oferta.valor_total_oferta)}
                        </TableCell>
                        <TableCell className="text-center">
                          {oferta.match_score ? (
                            <div className="flex items-center justify-center gap-1">
                              <Progress 
                                value={oferta.match_score} 
                                className="h-2 w-12" 
                              />
                              <span className="text-xs font-medium">
                                {oferta.match_score}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`gap-1 ${color}`}>
                            {icon}
                            {label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {oferta.fecha_envio ? (
                            format(new Date(oferta.fecha_envio), 'dd MMM yyyy', { locale: es })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/ofertas/${oferta.id}`);
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
