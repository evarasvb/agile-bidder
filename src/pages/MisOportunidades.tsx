// @ts-nocheck
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  RefreshCw,
  Building2,
  Clock,
  DollarSign,
  ChevronRight,
  Eye,
} from "lucide-react";
import { useOportunidadesFiltradas, type OportunidadFiltrada } from "@/hooks/useOportunidadesFiltradas";
import { useClienteFiltros } from "@/hooks/useClienteFiltros";
import { format, differenceInHours, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PagadorBadge, calcularPagadorInfo } from "@/components/shared/PagadorBadge";

/**
 * Genera link a MercadoPúblico según el tipo y código
 */
function getMercadoPublicoLink(codigo: string, tipo: string): string {
  if (tipo === "Compra Ágil" || codigo.includes("COT")) {
    return `https://compra-agil.mercadopublico.cl/compra-agil/${codigo}`;
  }
  // Licitación pública
  return `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?qs=oENFKJHnBv9JhhPNhQ0qRw==&IdLicitacion=${codigo}`;
}

export default function MisOportunidades() {
  const navigate = useNavigate();
  const { oportunidades, stats, isLoading, refetch } = useOportunidadesFiltradas();
  const { filtros } = useClienteFiltros();
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Filtros locales
  const filteredOportunidades = oportunidades.filter((op) => {
    const matchesSearch =
      !searchTerm ||
      op.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.organismo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = tipoFilter === "all" || op.tipo_proceso === tipoFilter;

    return matchesSearch && matchesTipo;
  });

  // Paginación
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

  const getDiasRestantes = (fechaCierre: string | null) => {
    if (!fechaCierre) return null;
    const dias = differenceInDays(new Date(fechaCierre), new Date());
    return dias;
  };

  const handleRowClick = (op: OportunidadFiltrada) => {
    // Navegar a la página de detalle unificada
    navigate(`/licitaciones/${op.codigo}`);
  };

  const hasFiltersConfigured =
    filtros &&
    ((filtros.palabras_incluir && filtros.palabras_incluir.length > 0) ||
      (filtros.regiones_activas && filtros.regiones_activas.length > 0) ||
      filtros.monto_min ||
      filtros.monto_max);

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-gradient-to-br from-background via-firmavb-cream/5 to-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
            Mis Oportunidades
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Licitaciones y compras ágiles filtradas para tu negocio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button asChild size="sm">
            <Link to="/configuracion-oportunidades" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Configurar Filtros
            </Link>
          </Button>
        </div>
      </div>

      {/* Alert sin filtros */}
      {!hasFiltersConfigured && !isLoading && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Configura tus filtros para ver oportunidades relevantes
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Define palabras clave, regiones y rangos de monto.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/configuracion-oportunidades">Configurar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
                )}
              </div>
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Match Alto</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-green-600">{stats.conMatchAlto}</p>
                )}
              </div>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Urgentes</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-orange-600">{stats.urgentes}</p>
                )}
              </div>
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Mostrando</p>
                <p className="text-2xl font-bold">{filteredOportunidades.length}</p>
              </div>
              <Filter className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, título, descripción o institución..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
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

      {/* Tabla de oportunidades */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[160px] font-semibold">Código</TableHead>
                  <TableHead className="min-w-[280px] font-semibold">Título</TableHead>
                  <TableHead className="min-w-[180px] font-semibold">Institución</TableHead>
                  <TableHead className="text-right font-semibold w-[130px]">Monto</TableHead>
                  <TableHead className="font-semibold w-[110px]">Cierre</TableHead>
                  <TableHead className="text-center font-semibold w-[70px]">Match</TableHead>
                  <TableHead className="text-center font-semibold w-[110px]">Pagador</TableHead>
                  <TableHead className="text-center font-semibold w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOportunidades.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No se encontraron oportunidades</p>
                      <p className="text-sm mt-1">Ajusta los filtros o la búsqueda</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOportunidades.map((op) => {
                    const dias = getDiasRestantes(op.fecha_cierre);
                    const monto = op.monto || op.presupuesto_estimado;
                    const mpLink = getMercadoPublicoLink(op.codigo, op.tipo_proceso);

                    return (
                      <TableRow
                        key={op.id + op.codigo}
                        className="cursor-pointer hover:bg-primary/5 transition-colors group"
                        onClick={() => handleRowClick(op)}
                      >
                        {/* Código completo */}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold shrink-0",
                                op.tipo_proceso === "Compra Ágil"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              )}
                            >
                              {op.tipo_proceso === "Compra Ágil" ? "CA" : "LIC"}
                            </Badge>
                            <span className="font-mono text-xs font-medium text-primary whitespace-nowrap">
                              {op.codigo}
                            </span>
                          </div>
                        </TableCell>

                        {/* Título */}
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                              {op.nombre}
                            </p>
                            {dias !== null && dias >= 0 && dias <= 2 && (
                              <Badge variant="destructive" className="text-[10px]">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {dias === 0 ? "Cierra hoy" : `${dias}d restantes`}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Institución */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[180px]" title={op.organismo || op.institucion_nombre || ""}>
                              {op.organismo || op.institucion_nombre || "-"}
                            </span>
                          </div>
                        </TableCell>

                        {/* Monto */}
                        <TableCell className="text-right">
                          <span className={cn("font-medium text-sm", monto && monto > 0 ? "text-foreground" : "text-muted-foreground")}>
                            {formatCurrency(monto)}
                          </span>
                        </TableCell>

                        {/* Cierre */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Clock className={cn("h-3.5 w-3.5 shrink-0", dias !== null && dias <= 2 && dias >= 0 ? "text-red-500" : "text-muted-foreground")} />
                            <div>
                              <p className="text-sm">{formatDate(op.fecha_cierre)}</p>
                              {dias !== null && dias >= 0 && (
                                <p className={cn("text-[10px]", dias <= 2 ? "text-red-500 font-medium" : "text-muted-foreground")}>
                                  {dias === 0 ? "Hoy" : `${dias}d`}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Match */}
                        <TableCell className="text-center">
                          {op.match_score && op.match_score > 0 ? (
                            <Badge
                              className={cn(
                                "text-xs font-semibold",
                                op.match_score >= 80
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : op.match_score >= 50
                                  ? "bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-gray-100 text-gray-600"
                              )}
                            >
                              {op.match_score}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>

                        {/* Pagador */}
                        <TableCell className="text-center">
                          <PagadorBadge
                            info={calcularPagadorInfo({
                              nivelRiesgo: op.risk_level,
                            })}
                            size="sm"
                          />
                        </TableCell>

                        {/* Ver / Link MP */}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(mpLink, "_blank");
                              }}
                              title="Ver en MercadoPúblico"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
              <p className="text-sm text-muted-foreground">
                {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredOportunidades.length)} de{" "}
                {filteredOportunidades.length}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                {totalPages <= 7 ? (
                  Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button
                      key={p}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground px-2 self-center">
                    Página {page} de {totalPages}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
