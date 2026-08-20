import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRequirePro } from "@/components/pro/UpgradeProProvider";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Target,
  TrendingUp,
  CalendarClock,
  DollarSign,
  ArrowUpDown,
  Building2,
  Clock,
  ExternalLink,
  Package,
  Eye,
  FileText,
  X,
  RefreshCw,
} from "lucide-react";
import {
  useOportunidadesPanel,
  useDescartarOportunidad,
  type OportunidadPanel,
  type PanelFilters,
} from "@/hooks/useOportunidadesPanel";
import { useRegistrarSenal } from "@/hooks/useSenales";
import { format, differenceInDays, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

function formatCurrency(value: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function getDeadlineText(fechaCierre: string | null): { text: string; urgent: boolean; closed: boolean } {
  if (!fechaCierre) return { text: "Sin fecha", urgent: false, closed: false };
  const hours = differenceInHours(new Date(fechaCierre), new Date());
  if (hours <= 0) return { text: "Cerrada", urgent: false, closed: true };
  if (hours < 24) return { text: `${hours}h restantes`, urgent: true, closed: false };
  const days = differenceInDays(new Date(fechaCierre), new Date());
  if (days <= 2) return { text: `${days} día${days > 1 ? "s" : ""}`, urgent: true, closed: false };
  if (days <= 7) return { text: `${days} días`, urgent: false, closed: false };
  return { text: `${days} días`, urgent: false, closed: false };
}

function getScoreColor(score: number | null): string {
  if (!score) return "bg-muted text-muted-foreground";
  if (score >= 80) return "bg-green-500 text-white";
  if (score >= 50) return "bg-yellow-500 text-white";
  return "bg-muted text-muted-foreground";
}

function OpportunityCard({
  op,
  onViewDetail,
  onCotizar,
  onDescartar,
}: {
  op: OportunidadPanel;
  onViewDetail: () => void;
  onCotizar: () => void;
  onDescartar: () => void;
}) {
  const deadline = getDeadlineText(op.fecha_cierre);

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group" onClick={onViewDetail}>
      <CardContent className="p-4 space-y-3">
        {/* Top row: Score + Type + Deadline */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className={getScoreColor(op.match_score)}>
              {op.match_score ? `${op.match_score}%` : "N/A"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {op.tipo === "compra_agil" ? "Compra Ágil" : "Licitación"}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs shrink-0">
            <Clock className={`h-3 w-3 ${deadline.urgent ? "text-red-500" : deadline.closed ? "text-muted-foreground" : "text-muted-foreground"}`} />
            <span className={`${deadline.urgent ? "text-red-600 font-medium" : deadline.closed ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
              {deadline.text}
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <h3 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {op.nombre}
          </h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{op.codigo}</p>
        </div>

        {/* Buyer info */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{op.organismo}</span>
        </div>

        {/* Bottom row: Amount + Items + Actions */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-3 text-xs">
            {op.monto ? (
              <span className="font-medium">{formatCurrency(op.monto)}</span>
            ) : (
              <span className="text-muted-foreground">Sin monto</span>
            )}
            {op.items_count > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                {op.items_count} items
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetail();
              }}
              title="Ver detalle"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onCotizar();
              }}
              title="Cotizar"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDescartar();
              }}
              title="Descartar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Oportunidades() {
  const navigate = useNavigate();
  const { requirePro } = useRequirePro();
  const [filters, setFilters] = useState<PanelFilters>({
    sortBy: "match_score",
    sortAsc: false,
  });
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const { data, isLoading, refetch } = useOportunidadesPanel(filters);
  const descartar = useDescartarOportunidad();
  const registrarSenal = useRegistrarSenal();

  const oportunidades = data?.data || [];
  const stats = data?.stats || { totalActivas: 0, avgMatchScore: 0, cierranEstaSemana: 0, valorTotal: 0 };

  // Pagination
  const totalPages = Math.ceil(oportunidades.length / pageSize);
  const paginatedOps = oportunidades.slice((page - 1) * pageSize, page * pageSize);

  // ¿Hay filtros activos? (sortBy/sortAsc no cuentan) — sirve para mostrar el
  // empty-state correcto: "ajusta los filtros" vs "carga tu inventario".
  const hasActiveFilters = Boolean(
    filters.search ||
    (filters.tipo && filters.tipo !== "all") ||
    filters.scoreMin ||
    filters.estado ||
    filters.institucion ||
    filters.incluirCerradas
  );
  const clearFilters = () => setFilters({ sortBy: "match_score", sortAsc: false });

  const handleDescartar = (op: OportunidadPanel) => {
    // Gestionar (descartar) es Pro; en free abre el modal de upgrade.
    requirePro(() => {
      // Señal para que la IA aprenda qué NO le sirve al cliente.
      registrarSenal({ tipo: "descartada", oportunidad_tipo: op.tipo, codigo: op.codigo, titulo: op.nombre });
      descartar.mutate(
        { codigo: op.codigo, tipo: op.tipo },
        {
          onSuccess: () => toast.success("Oportunidad descartada"),
          onError: () => toast.error("Error al descartar"),
        }
      );
    }, "Descartar y gestionar oportunidades es parte del plan Pro.");
  };

  const handleCotizar = (op: OportunidadPanel) => {
    // Cotizar/postular es Pro; en free abre el modal de upgrade.
    requirePro(() => {
      // Señal para que la IA aprenda qué SÍ trabaja el cliente.
      registrarSenal({ tipo: "cotizada", oportunidad_tipo: op.tipo, codigo: op.codigo, titulo: op.nombre });
      if (op.tipo === "compra_agil") {
        navigate(`/compras-agiles/${op.codigo}`);
      } else {
        navigate(`/licitaciones/${op.codigo}`);
      }
    }, "Cotizar y postular a oportunidades es parte del plan Pro.");
  };

  const handleViewDetail = (op: OportunidadPanel) => {
    navigate(`/oportunidades/${op.tipo}/${op.codigo}`);
  };

  const updateFilter = (key: keyof PanelFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground">
            Oportunidades de licitaciones y compras ágiles con match a tu inventario
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <p className="text-2xl font-bold">{stats.totalActivas}</p>
              )}
              <p className="text-xs text-muted-foreground">Matches Activos</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <p className="text-2xl font-bold">{stats.avgMatchScore}%</p>
              )}
              <p className="text-xs text-muted-foreground">Match Promedio</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <CalendarClock className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <p className="text-2xl font-bold">{stats.cierranEstaSemana}</p>
              )}
              <p className="text-xs text-muted-foreground">Cierran esta semana</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <p className="text-2xl font-bold">{formatCompactCurrency(stats.valorTotal)}</p>
              )}
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, título u organismo..."
              value={filters.search || ""}
              onChange={(e) => updateFilter("search", e.target.value || undefined)}
              className="pl-9"
            />
          </div>

          {/* Chips de tipo: una sola bandeja, se filtra con un toque. */}
          <div className="flex items-center gap-1">
            {([
              { v: undefined, label: "Todas" },
              { v: "licitacion", label: "Licitaciones" },
              { v: "compra_agil", label: "Compras Ágiles" },
            ] as const).map((t) => {
              const active = (filters.tipo || undefined) === t.v;
              return (
                <Button
                  key={t.label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-9"
                  onClick={() => updateFilter("tipo", t.v)}
                >
                  {t.label}
                </Button>
              );
            })}
          </div>

          <Select
            value={String(filters.scoreMin || 0)}
            onValueChange={(v) => updateFilter("scoreMin", Number(v) || undefined)}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Score mínimo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Cualquier score</SelectItem>
              <SelectItem value="50">Score &ge; 50%</SelectItem>
              <SelectItem value="70">Score &ge; 70%</SelectItem>
              <SelectItem value="80">Score &ge; 80%</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.sortBy || "match_score"}
            onValueChange={(v) => updateFilter("sortBy", v)}
          >
            <SelectTrigger className="w-full sm:w-[170px]">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match_score">Mayor match</SelectItem>
              <SelectItem value="fecha_cierre">Fecha cierre</SelectItem>
              <SelectItem value="monto">Monto estimado</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={filters.incluirCerradas ? "default" : "outline"}
            onClick={() => updateFilter("incluirCerradas", !filters.incluirCerradas)}
            className="gap-2"
            title="Por defecto solo se muestran oportunidades activas. Actívalo para ver también las cerradas/terminadas."
          >
            <CalendarClock className="h-4 w-4" />
            {filters.incluirCerradas ? "Mostrando cerradas" : "Solo activas"}
          </Button>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {oportunidades.length} oportunidades encontradas
        </p>
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : paginatedOps.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            {hasActiveFilters ? (
              // Hay filtros aplicados que dejaron la lista vacía.
              <>
                <h3 className="text-lg font-medium">Sin resultados</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ninguna oportunidad coincide con los filtros seleccionados.
                </p>
                <Button variant="outline" className="mt-5" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </>
            ) : (
              // Sin filtros y sin oportunidades: guiar a cargar inventario.
              <>
                <h3 className="text-lg font-medium">No hay oportunidades activas</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  El match usa tu inventario: mientras más productos cargues, más
                  oportunidades relevantes verás aquí.
                </p>
                <Button className="mt-5" onClick={() => navigate("/inventario")}>
                  Cargar mi inventario
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedOps.map((op) => (
            <OpportunityCard
              key={`${op.tipo}-${op.codigo}`}
              op={op}
              onViewDetail={() => handleViewDetail(op)}
              onCotizar={() => handleCotizar(op)}
              onDescartar={() => handleDescartar(op)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, oportunidades.length)} de{" "}
            {oportunidades.length}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
