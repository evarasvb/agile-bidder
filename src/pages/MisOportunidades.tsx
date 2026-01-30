import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  Settings2, 
  Target, 
  AlertTriangle, 
  TrendingUp,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useOportunidadesFiltradas, OportunidadFiltrada } from "@/hooks/useOportunidadesFiltradas";
import { useClienteFiltros } from "@/hooks/useClienteFiltros";
import { format, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";

export default function MisOportunidades() {
  const { oportunidades, stats, isLoading, refetch } = useOportunidadesFiltradas();
  const { filtros } = useClienteFiltros();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Apply local search filter
  const filteredOportunidades = oportunidades.filter((op) => {
    const matchesSearch = !searchTerm || 
      op.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.organismo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTipo = tipoFilter === "all" || op.tipo_proceso === tipoFilter;
    
    return matchesSearch && matchesTipo;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOportunidades.length / pageSize);
  const paginatedOportunidades = filteredOportunidades.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getMatchBadge = (score: number | null) => {
    if (!score) return null;
    if (score >= 80) {
      return <Badge className="bg-green-500 hover:bg-green-600">{score}%</Badge>;
    }
    if (score >= 50) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">{score}%</Badge>;
    }
    return <Badge variant="secondary">{score}%</Badge>;
  };

  const getUrgencyBadge = (fechaCierre: string | null) => {
    if (!fechaCierre) return null;
    const hours = differenceInHours(new Date(fechaCierre), new Date());
    if (hours <= 0) {
      return <Badge variant="destructive">Cerrada</Badge>;
    }
    if (hours <= 24) {
      return <Badge variant="destructive">Urgente</Badge>;
    }
    if (hours <= 48) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">48h</Badge>;
    }
    return null;
  };

  const hasFiltersConfigured = filtros && (
    (filtros.palabras_incluir && filtros.palabras_incluir.length > 0) ||
    (filtros.regiones_activas && filtros.regiones_activas.length > 0) ||
    filtros.monto_min ||
    filtros.monto_max
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Oportunidades</h1>
          <p className="text-muted-foreground">
            Oportunidades filtradas según tu configuración personalizada
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <Button asChild>
            <Link to="/configuracion-oportunidades">
              <Settings2 className="h-4 w-4 mr-2" />
              Configurar Filtros
            </Link>
          </Button>
        </div>
      </div>

      {/* Alert if no filters configured */}
      {!hasFiltersConfigured && !isLoading && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  No tienes filtros configurados
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Configura tus palabras clave, regiones y rangos de monto para ver oportunidades relevantes.
                </p>
              </div>
              <Button variant="outline" asChild className="ml-auto">
                <Link to="/configuracion-oportunidades">Configurar ahora</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Encontradas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Oportunidades que coinciden con tus filtros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Match Alto (&gt;70%)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats.conMatchAlto}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Alta coincidencia con tus palabras clave
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgentes (48h)</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">{stats.urgentes}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Cierran en las próximas 48 horas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Explorar Oportunidades</CardTitle>
          <CardDescription>
            {filteredOportunidades.length} oportunidades encontradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, título o institución..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="Compra Ágil">Compras Ágiles</SelectItem>
                <SelectItem value="Licitación">Licitaciones</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Código</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Institución</TableHead>
                      <TableHead>Región</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Cierre</TableHead>
                      <TableHead className="text-center">Match</TableHead>
                                      <TableHead>Riesgo</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOportunidades.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No se encontraron oportunidades con los filtros actuales
                        </TableCell>
                      </TableRow>
                ) : (     
                                paginatedOportunidades.map((op) => (
                        <TableRow key={op.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-mono text-xs">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {op.tipo_proceso === "Compra Ágil" ? "CA" : "LIC"}
                              </Badge>
                              <span className="truncate max-w-[80px]">{op.codigo}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="truncate max-w-[300px]" title={op.nombre}>
                                {op.nombre}
                              </span>
                              {getUrgencyBadge(op.fecha_cierre)}
                            </div>
                          </TableCell>
                          <TableCell className="truncate max-w-[200px]" title={op.organismo || op.institucion_nombre || ""}>
                            {op.organismo || op.institucion_nombre || "-"}
                          </TableCell>
                          <TableCell>{op.region || "-"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(op.monto || op.presupuesto_estimado)}
                          </TableCell>
                          <TableCell>{formatDate(op.fecha_cierre)}</TableCell>
                          <TableCell className="text-center">
                            {getMatchBadge(op.match_score)}
                          </TableCell>
                                          <TableCell>
                  <Badge variant={op.risk_level === 'BAJO' ? 'default' : op.risk_level === 'MEDIO' ? 'secondary' : 'destructive'}>
                    {op.risk_level || 'N/A'}
                  </Badge>
                </TableCell>
                          <TableCell>
                            {op.link_oficial && (
                              <Button variant="ghost" size="icon" asChild>
                                <a href={op.link_oficial} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredOportunidades.length)} de {filteredOportunidades.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
