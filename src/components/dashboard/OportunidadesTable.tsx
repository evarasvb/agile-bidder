import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  ExternalLink,
  ArrowUpDown,
  Calendar,
  Building2,
  Banknote,
  Target,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Oportunidad {
  codigo: string;
  nombre: string;
  institucion_nombre: string;
  estado: string | null;
  fecha_publicacion: string | null;
  fecha_cierre: string | null;
  presupuesto_estimado: number | null;
  match_score: number | null;
  tipo_proceso: string;
  link_oficial: string | null;
}

export function OportunidadesTable() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [estadoFiltro, setEstadoFiltro] = useState<string>("all");
  const [ordenarPor, setOrdenarPor] = useState<string>("fecha_cierre");
  const [ordenAsc, setOrdenAsc] = useState(true);
  const [selectedOportunidad, setSelectedOportunidad] = useState<Oportunidad | null>(null);

  // Query licitaciones directly (oportunidades_all view may not be in types yet)
  const { data, isLoading, error } = useQuery({
    queryKey: ['oportunidades-table', page, searchTerm, tipoFiltro, estadoFiltro, ordenarPor, ordenAsc],
    queryFn: async () => {
      let query = supabase
        .from('licitaciones')
        .select('*', { count: 'exact' });

      // Apply search
      if (searchTerm) {
        query = query.or(`titulo.ilike.%${searchTerm}%,organismo.ilike.%${searchTerm}%,id_licitacion.ilike.%${searchTerm}%`);
      }

      // Apply estado filter
      if (estadoFiltro && estadoFiltro !== 'all') {
        query = query.eq('estado', estadoFiltro);
      }

      // Order
      const orderColumn = ordenarPor === 'presupuesto_estimado' ? 'presupuesto' : 
                         ordenarPor === 'institucion_nombre' ? 'organismo' :
                         ordenarPor;
      query = query.order(orderColumn, { ascending: ordenAsc });

      // Pagination
      query = query.range((page - 1) * pageSize, page * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      // Transform to Oportunidad format
      const oportunidades: Oportunidad[] = (data || []).map(l => ({
        codigo: l.id_licitacion,
        nombre: l.titulo,
        institucion_nombre: l.organismo,
        estado: l.estado,
        fecha_publicacion: l.created_at,
        fecha_cierre: l.fecha_cierre,
        presupuesto_estimado: l.presupuesto,
        match_score: l.match_score,
        tipo_proceso: 'compra_agil',
        link_oficial: l.link_oficial,
      }));

      return {
        data: oportunidades,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es });
    } catch {
      return '-';
    }
  };

  const getDaysUntilClose = (fechaCierre: string | null) => {
    if (!fechaCierre) return null;
    try {
      const days = differenceInDays(parseISO(fechaCierre), new Date());
      return days >= 0 ? days : null;
    } catch {
      return null;
    }
  };

  const getTipoBadge = (tipo: string) => {
    if (tipo === 'compra_agil') {
      return <Badge className="bg-firmavb-blue text-white">Compra Ágil</Badge>;
    }
    return <Badge className="bg-firmavb-green text-white">Licitación</Badge>;
  };

  const getEstadoBadge = (estado: string | null) => {
    switch (estado?.toLowerCase()) {
      case 'publicada':
        return <Badge variant="outline" className="border-firmavb-green text-firmavb-green">Publicada</Badge>;
      case 'cerrada':
        return <Badge variant="outline" className="border-muted-foreground">Cerrada</Badge>;
      case 'adjudicada':
        return <Badge variant="outline" className="border-firmavb-celeste text-firmavb-celeste">Adjudicada</Badge>;
      case 'desierta':
        return <Badge variant="outline" className="border-firmavb-red text-firmavb-red">Desierta</Badge>;
      default:
        return <Badge variant="secondary">{estado || 'Sin estado'}</Badge>;
    }
  };

  const toggleSort = (column: string) => {
    if (ordenarPor === column) {
      setOrdenAsc(!ordenAsc);
    } else {
      setOrdenarPor(column);
      setOrdenAsc(true);
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <CardTitle className="text-lg font-heading flex items-center gap-2">
            <Target className="h-5 w-5 text-firmavb-blue" />
            Oportunidades
            {data?.total && (
              <Badge variant="secondary" className="ml-2">{data.total}</Badge>
            )}
          </CardTitle>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar código, título, organismo..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9 w-[280px]"
              />
            </div>

            <Select value={tipoFiltro} onValueChange={(v) => { setTipoFiltro(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="compra_agil">Compra Ágil</SelectItem>
                <SelectItem value="licitacion">Licitación</SelectItem>
              </SelectContent>
            </Select>

            <Select value={estadoFiltro} onValueChange={(v) => { setEstadoFiltro(v); setPage(1); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="publicada">Publicada</SelectItem>
                <SelectItem value="cerrada">Cerrada</SelectItem>
                <SelectItem value="adjudicada">Adjudicada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-firmavb-cream" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-firmavb-red">
            <p className="font-medium">Error al cargar oportunidades</p>
            <p className="text-sm text-muted-foreground mt-1">Por favor, intenta de nuevo</p>
          </div>
        ) : !data?.data.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No se encontraron oportunidades</p>
            <p className="text-sm">Ajusta los filtros o espera nuevas licitaciones</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Código</TableHead>
                    <TableHead className="font-semibold">Título / Organismo</TableHead>
                    <TableHead className="font-semibold">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('presupuesto')} className="h-auto p-0 font-semibold">
                        Presupuesto
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="font-semibold">
                      <Button variant="ghost" size="sm" onClick={() => toggleSort('fecha_cierre')} className="h-auto p-0 font-semibold">
                        Cierre
                        <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead className="font-semibold">Match</TableHead>
                    <TableHead className="font-semibold">Estado</TableHead>
                    <TableHead className="text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((oportunidad) => {
                    const daysLeft = getDaysUntilClose(oportunidad.fecha_cierre);
                    const isUrgent = daysLeft !== null && daysLeft <= 3;

                    return (
                      <TableRow 
                        key={oportunidad.codigo} 
                        className="data-row cursor-pointer"
                        onClick={() => setSelectedOportunidad(oportunidad)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-medium">{oportunidad.codigo}</span>
                            {getTipoBadge(oportunidad.tipo_proceso)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="font-medium text-foreground line-clamp-1">{oportunidad.nombre}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" />
                              {oportunidad.institucion_nombre}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono font-medium">
                            {formatCurrency(oportunidad.presupuesto_estimado)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(oportunidad.fecha_cierre)}
                            </span>
                            {daysLeft !== null && (
                              <span className={`text-xs font-medium ${
                                isUrgent ? 'text-firmavb-red' : 'text-muted-foreground'
                              }`}>
                                {daysLeft === 0 ? '¡Hoy!' : daysLeft === 1 ? 'Mañana' : `${daysLeft} días`}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {oportunidad.match_score ? (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full rounded-full bg-firmavb-blue"
                                  style={{ width: `${oportunidad.match_score}%` }}
                                />
                              </div>
                              <span className="text-sm font-mono font-medium">{oportunidad.match_score}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sin match</span>
                          )}
                        </TableCell>
                        <TableCell>{getEstadoBadge(oportunidad.estado)}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOportunidad(oportunidad);
                            }}
                          >
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.total)} de {data.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-3">
                  Página {page} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Detail Modal */}
        <Dialog open={!!selectedOportunidad} onOpenChange={() => setSelectedOportunidad(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono text-firmavb-blue">{selectedOportunidad?.codigo}</span>
                {selectedOportunidad && getTipoBadge(selectedOportunidad.tipo_proceso)}
              </DialogTitle>
            </DialogHeader>
            {selectedOportunidad && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{selectedOportunidad.nombre}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Building2 className="h-4 w-4" />
                    {selectedOportunidad.institucion_nombre}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Banknote className="h-4 w-4" />
                      Presupuesto
                    </p>
                    <p className="text-xl font-mono font-bold text-firmavb-blue">
                      {formatCurrency(selectedOportunidad.presupuesto_estimado)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Fecha de cierre
                    </p>
                    <p className="text-xl font-bold">
                      {formatDate(selectedOportunidad.fecha_cierre)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>{getEstadoBadge(selectedOportunidad.estado)}</div>
                  {selectedOportunidad.match_score && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Match Score:</span>
                      <span className="font-mono font-bold text-firmavb-blue">{selectedOportunidad.match_score}%</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  {selectedOportunidad.link_oficial && (
                    <Button asChild>
                      <a href={selectedOportunidad.link_oficial} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver en Mercado Público
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" className="border-firmavb-blue text-firmavb-blue hover:bg-firmavb-blue/10">
                    Preparar Oferta
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
