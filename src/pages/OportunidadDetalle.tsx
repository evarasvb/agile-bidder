import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Clock,
  ExternalLink,
  FileText,
  PlusCircle,
  X,
  Star,
  MapPin,
  Hash,
  TrendingUp,
  CreditCard,
  Sparkles,
} from "lucide-react";
import {
  useOportunidadDetalle,
  useDescartarOportunidad,
  type BuyerProfile,
} from "@/hooks/useOportunidadesPanel";
import InteligenciaMercado from "@/components/oportunidades/InteligenciaMercado";
import { InfoHint } from "@/components/ui/info-hint";
import { format, differenceInHours, differenceInDays } from "date-fns";
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

function getScoreBadge(score: number | null) {
  if (!score) return <Badge variant="secondary">N/A</Badge>;
  if (score >= 80) return <Badge className="bg-green-500 text-white text-lg px-3 py-1">{score}%</Badge>;
  if (score >= 50) return <Badge className="bg-yellow-500 text-white text-lg px-3 py-1">{score}%</Badge>;
  return <Badge variant="secondary" className="text-lg px-3 py-1">{score}%</Badge>;
}

function getDeadlineInfo(fechaCierre: string | null) {
  if (!fechaCierre) return { text: "Sin fecha de cierre", color: "text-muted-foreground", urgent: false };
  const hours = differenceInHours(new Date(fechaCierre), new Date());
  if (hours <= 0) return { text: "Cerrada", color: "text-muted-foreground", urgent: false };
  if (hours < 24) return { text: `Cierra en ${hours} horas`, color: "text-red-600", urgent: true };
  const days = differenceInDays(new Date(fechaCierre), new Date());
  if (days <= 2) return { text: `Cierra en ${days} día${days > 1 ? "s" : ""}`, color: "text-red-600", urgent: true };
  if (days <= 7) return { text: `Cierra en ${days} días`, color: "text-orange-600", urgent: false };
  return { text: `Cierra en ${days} días`, color: "text-muted-foreground", urgent: false };
}

function BuyerSidebar({ buyer }: { buyer: BuyerProfile | null }) {
  if (!buyer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Perfil del Comprador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No se encontró información del comprador
          </p>
        </CardContent>
      </Card>
    );
  }

  const paymentStars = buyer.score_pago
    ? Math.min(5, Math.max(1, Math.round(buyer.score_pago / 20)))
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Perfil del Comprador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div>
          <p className="font-medium">{buyer.nombre}</p>
          <p className="text-xs text-muted-foreground font-mono">{buyer.rut}</p>
        </div>

        <Separator />

        {/* Address */}
        {(buyer.direccion || buyer.comuna || buyer.region) && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              {buyer.direccion && <p>{buyer.direccion}</p>}
              <p className="text-muted-foreground">
                {[buyer.comuna, buyer.region].filter(Boolean).join(", ")}
              </p>
            </div>
          </div>
        )}

        {/* Sector */}
        {buyer.sector && (
          <div className="flex items-center gap-2 text-sm">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span>{buyer.sector}</span>
          </div>
        )}

        <Separator />

        {/* Purchase history */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Historial de Compras</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded p-2">
              <p className="text-lg font-bold">{buyer.total_licitaciones || 0}</p>
              <p className="text-xs text-muted-foreground">Licitaciones</p>
            </div>
            <div className="bg-muted/50 rounded p-2">
              <p className="text-lg font-bold">{buyer.total_ordenes || 0}</p>
              <p className="text-xs text-muted-foreground">Órdenes</p>
            </div>
          </div>
          {buyer.monto_total_compras && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>Volumen: {formatCurrency(buyer.monto_total_compras)}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* Payment rating */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Conducta de Pago</p>
          {paymentStars ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < paymentStars ? "text-yellow-400 fill-yellow-400" : "text-muted"}`}
                />
              ))}
              <span className="ml-2 text-sm text-muted-foreground">{buyer.score_pago}/100</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin datos de pago</p>
          )}
          {buyer.promedio_dias_pago !== null && buyer.promedio_dias_pago !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>Pago promedio: {buyer.promedio_dias_pago} días</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function OportunidadDetalle() {
  const { tipo, id } = useParams<{ tipo: string; id: string }>();
  const navigate = useNavigate();
  const tipoNormalized = tipo === "compra_agil" ? "compra_agil" : tipo === "licitacion" ? "licitacion" : null;
  const { data: oportunidad, isLoading, error } = useOportunidadDetalle(
    id || null,
    tipoNormalized as "compra_agil" | "licitacion" | null
  );
  const descartar = useDescartarOportunidad();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !oportunidad) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Oportunidad no encontrada</p>
            <Button onClick={() => navigate("/oportunidades")} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2" /> Volver a oportunidades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deadline = getDeadlineInfo(oportunidad.fecha_cierre);

  const handleDescartar = () => {
    descartar.mutate(
      { codigo: oportunidad.codigo, tipo: oportunidad.tipo },
      {
        onSuccess: () => {
          toast.success("Oportunidad descartada");
          navigate("/oportunidades");
        },
        onError: () => toast.error("Error al descartar"),
      }
    );
  };

  const handleCotizar = () => {
    if (oportunidad.tipo === "compra_agil") {
      navigate(`/compras-agiles/${oportunidad.codigo}`);
    } else {
      navigate(`/licitaciones/${oportunidad.codigo}`);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/oportunidades")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">
              {oportunidad.tipo === "compra_agil" ? "Compra Ágil" : "Licitación"}
            </Badge>
            {getScoreBadge(oportunidad.match_score)}
            {deadline.urgent && (
              <Badge variant="destructive">{deadline.text}</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold">{oportunidad.nombre}</h1>
          <p className="text-sm text-muted-foreground font-mono">{oportunidad.codigo}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Organismo</p>
                    <p className="font-medium text-sm truncate">{oportunidad.organismo}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Monto Estimado</p>
                    <p className="font-medium text-sm">{formatCurrency(oportunidad.monto)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Clock className={`h-4 w-4 ${deadline.urgent ? "text-red-500" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha Cierre</p>
                    <p className={`font-medium text-sm ${deadline.color}`}>
                      {oportunidad.fecha_cierre
                        ? format(new Date(oportunidad.fecha_cierre), "dd MMM yyyy HH:mm", { locale: es })
                        : "Sin fecha"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Items</p>
                    <p className="font-medium text-sm">{oportunidad.items.length} productos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          {oportunidad.descripcion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {oportunidad.descripcion}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Productos Solicitados ({oportunidad.items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {oportunidad.items.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">P. Unitario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oportunidad.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.nombre_producto}</TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                            {item.descripcion || "-"}
                          </TableCell>
                          <TableCell className="text-right">{item.cantidad || "-"}</TableCell>
                          <TableCell>{item.unidad || "-"}</TableCell>
                          <TableCell className="text-right">
                            {item.precio_unitario ? formatCurrency(item.precio_unitario) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    No se encontraron items para esta oportunidad
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inteligencia de mercado (match ↔ OC ↔ reportes) */}
          <InteligenciaMercado codigo={oportunidad.codigo} tipo={oportunidad.tipo} />

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fechas Clave
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {oportunidad.fecha_publicacion && (
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Publicación</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(oportunidad.fecha_publicacion), "dd MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                )}
                {oportunidad.fecha_cierre && (
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${deadline.urgent ? "bg-red-500" : "bg-orange-500"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Cierre de Recepción</p>
                      <p className={`text-xs ${deadline.color}`}>
                        {format(new Date(oportunidad.fecha_cierre), "dd MMM yyyy HH:mm", { locale: es })}
                        {" — "}
                        {deadline.text}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/oportunidades/${tipo}/${id}/chat`)}
            >
              <Sparkles className="h-4 w-4" />
              Chat IA
            </Button>
            <Button className="gap-2" onClick={handleCotizar}>
              <FileText className="h-4 w-4" />
              Cotizar en 2 Clicks
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => toast.info("Agregado al pipeline")}>
              <PlusCircle className="h-4 w-4" />
              Agregar al Pipeline
            </Button>
            {oportunidad.link_oficial && (
              <Button variant="outline" className="gap-2" asChild>
                <a href={oportunidad.link_oficial} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver en MercadoPúblico
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={handleDescartar}
              disabled={descartar.isPending}
            >
              <X className="h-4 w-4" />
              Descartar
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Match Score Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Match Score
                <InfoHint text="Mide qué tan parecidos son los productos de esta oportunidad a los de tu inventario (por código ONU exacto o similitud de nombre, ignorando acentos). 100% = producto idéntico en tu inventario." />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-center">
                {getScoreBadge(oportunidad.match_score)}
              </div>
              <p className="text-sm text-center text-muted-foreground">
                {oportunidad.match_score && oportunidad.match_score >= 80
                  ? "Alta coincidencia con tu inventario"
                  : oportunidad.match_score && oportunidad.match_score >= 50
                  ? "Coincidencia moderada"
                  : "Coincidencia baja o sin analizar"}
              </p>
            </CardContent>
          </Card>

          {/* Buyer Profile */}
          <BuyerSidebar buyer={oportunidad.buyer} />
        </div>
      </div>
    </div>
  );
}
