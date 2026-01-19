import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, TrendingUp, Target, DollarSign, Package, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOportunidades, useOportunidadesStats } from '@/hooks/useOportunidades';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

function formatCurrency(value: number | null) {
  if (!value) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Opportunities() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [soloConMatch, setSoloConMatch] = useState(false);

  const { data: oportunidadesData, isLoading } = useOportunidades({
    filters: {
      soloConMatch: soloConMatch,
    },
  });

  const { data: stats, isLoading: isLoadingStats } = useOportunidadesStats();

  const oportunidades = oportunidadesData?.data || [];

  const oportunidadesFiltradas = oportunidades.filter((oportunidad) => {
    // Filtro por tipo
    if (filtroTipo !== 'todas' && oportunidad.tipo_proceso !== filtroTipo) return false;
    
    // Filtro por estado
    if (filtroEstado !== 'todas' && oportunidad.estado !== filtroEstado) return false;
    
    // Filtro por búsqueda
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        oportunidad.codigo?.toLowerCase().includes(search) ||
        oportunidad.nombre?.toLowerCase().includes(search) ||
        oportunidad.institucion_nombre?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  const calcularDiasRestantes = (fechaCierre: string | null) => {
    if (!fechaCierre) return null;
    try {
      return differenceInDays(parseISO(fechaCierre), new Date());
    } catch {
      return null;
    }
  };

  const getMatchColor = (score: number | null) => {
    if (!score) return 'bg-muted text-muted-foreground';
    if (score >= 80) return 'bg-success/10 text-success';
    if (score >= 50) return 'bg-warning/10 text-warning';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Oportunidades</h1>
          <p className="text-muted-foreground">
            Explora licitaciones y compras ágiles con match a tu inventario
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {isLoadingStats ? '...' : stats?.totalOportunidades || 0}
              </p>
              <p className="text-xs text-muted-foreground">Total Oportunidades</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-success/20 bg-success/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-success/10 p-2">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">
                {isLoadingStats ? '...' : stats?.oportunidadesActivas || 0}
              </p>
              <p className="text-xs text-muted-foreground">Activas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-firmavb-blue/20 bg-firmavb-blue/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-firmavb-blue/10 p-2">
              <TrendingUp className="h-5 w-5 text-firmavb-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold text-firmavb-blue">
                {isLoadingStats ? '...' : `${stats?.matchRate || 0}%`}
              </p>
              <p className="text-xs text-muted-foreground">Tasa de Match</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-warning/10 p-2">
              <DollarSign className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">
                {isLoadingStats ? '...' : formatCurrency(stats?.valorPotencial || 0)}
              </p>
              <p className="text-xs text-muted-foreground">Valor Potencial</p>
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
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los tipos</SelectItem>
                  <SelectItem value="compra_agil">Compra Ágil</SelectItem>
                  <SelectItem value="licitacion">Licitación</SelectItem>
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Filtra por tipo de proceso</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos los estados</SelectItem>
                  <SelectItem value="Publicada">Publicada</SelectItem>
                  <SelectItem value="Cerrada">Cerrada</SelectItem>
                  <SelectItem value="Adjudicada">Adjudicada</SelectItem>
                </SelectContent>
              </Select>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Filtra por estado de la oportunidad</p>
            </TooltipContent>
          </Tooltip>

          <Button
            variant={soloConMatch ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSoloConMatch(!soloConMatch)}
            className="gap-2"
          >
            <Target className="h-4 w-4" />
            Solo con Match
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {oportunidadesFiltradas.length} oportunidades encontradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : oportunidadesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No hay oportunidades</h3>
              <p className="text-sm text-muted-foreground">
                No se encontraron oportunidades con los filtros seleccionados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead className="w-[200px]">Organismo</TableHead>
                    <TableHead className="w-[100px]">Cierre</TableHead>
                    <TableHead className="w-[120px] text-right">Monto</TableHead>
                    <TableHead className="w-[100px] text-center">Match</TableHead>
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oportunidadesFiltradas.slice(0, 50).map((oportunidad) => {
                    const diasRestantes = calcularDiasRestantes(oportunidad.fecha_cierre);
                    
                    return (
                      <TableRow
                        key={oportunidad.codigo}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          if (oportunidad.tipo_proceso === 'compra_agil') {
                            navigate(`/compras-agiles/${oportunidad.codigo}`);
                          } else {
                            navigate(`/licitaciones/${oportunidad.codigo}`);
                          }
                        }}
                      >
                        <TableCell className="font-mono text-xs">
                          {oportunidad.codigo}
                          <Badge 
                            variant="outline" 
                            className="ml-2 text-[10px]"
                          >
                            {oportunidad.tipo_proceso === 'compra_agil' ? 'CA' : 'LIC'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <span className="line-clamp-2 text-sm">
                            {oportunidad.nombre}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {oportunidad.institucion_nombre}
                        </TableCell>
                        <TableCell>
                          {oportunidad.fecha_cierre ? (
                            <div className="space-y-1">
                              <span className="text-xs">
                                {format(parseISO(oportunidad.fecha_cierre), 'dd MMM', { locale: es })}
                              </span>
                              {diasRestantes !== null && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${
                                    diasRestantes <= 2
                                      ? 'border-destructive text-destructive'
                                      : diasRestantes <= 5
                                      ? 'border-warning text-warning'
                                      : ''
                                  }`}
                                >
                                  {diasRestantes <= 0 ? 'Cerrada' : `${diasRestantes}d`}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(oportunidad.presupuesto_estimado)}
                        </TableCell>
                        <TableCell className="text-center">
                          {oportunidad.match_score ? (
                            <Badge className={getMatchColor(oportunidad.match_score)}>
                              {oportunidad.match_score}%
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              oportunidad.estado === 'Publicada'
                                ? 'border-success text-success'
                                : oportunidad.estado === 'Cerrada'
                                ? 'border-muted-foreground text-muted-foreground'
                                : 'border-primary text-primary'
                            }
                          >
                            {oportunidad.estado || 'Publicada'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {oportunidad.link_oficial && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(oportunidad.link_oficial!, '_blank');
                                    }}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver en MercadoPúblico</TooltipContent>
                              </Tooltip>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/compras-agiles/${oportunidad.codigo}`);
                                  }}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Preparar oferta</TooltipContent>
                            </Tooltip>
                          </div>
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
