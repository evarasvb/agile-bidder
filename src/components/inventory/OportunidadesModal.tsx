// @ts-nocheck
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Building2, Calendar, ExternalLink, MapPin, ShoppingCart } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import type { InventoryItem } from "@/hooks/useInventory";

interface OportunidadesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producto: InventoryItem | null;
  compras: CompraAgil[];
  isLoading?: boolean;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getEstadoBadge(estado: string | null, fechaCierre: string | null) {
  if (estado === "urgente") {
    return (
      <Badge variant="accent" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> Urgente
      </Badge>
    );
  }

  if (fechaCierre) {
    const diasRestantes = differenceInDays(parseISO(fechaCierre), new Date());
    if (diasRestantes <= 2) {
      return (
        <Badge variant="accent" className="gap-1">
          <AlertTriangle className="h-3 w-3" /> Urgente
        </Badge>
      );
    }
  }

  if (estado === "cerrada") return <Badge variant="secondary">Cerrada</Badge>;
  if (estado === "adjudicada") return <Badge variant="success">Adjudicada</Badge>;

  return <Badge variant="outline">Activa</Badge>;
}

export function OportunidadesModal({
  open,
  onOpenChange,
  producto,
  compras,
  isLoading = false,
}: OportunidadesModalProps) {
  const total = compras.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Oportunidades en Compras Agiles
          </DialogTitle>
          {producto && (
            <p className="text-sm text-muted-foreground">
              Producto: <span className="font-medium">{producto.nombre_producto}</span>{" "}
              <span className="font-mono text-xs text-muted-foreground">({producto.sku})</span>
            </p>
          )}
        </DialogHeader>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} compras agiles abiertas</span>
          <Badge variant="secondary">{total}</Badge>
        </div>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : total === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No hay compras agiles que coincidan con las keywords del producto
            </div>
          ) : (
            <ScrollArea className="h-[360px] pr-4 -mr-4">
              <div className="space-y-3">
                {compras.map((compra) => (
                  <div key={compra.id} className="rounded-lg border border-border p-3 bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-primary">{compra.codigo}</span>
                          {getEstadoBadge(compra.estado, compra.fecha_cierre)}
                        </div>
                        <p className="font-medium text-sm mt-1 line-clamp-2">{compra.nombre}</p>
                      </div>
                      {compra.link_oficial && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => window.open(compra.link_oficial ?? "", "_blank", "noreferrer")}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        <span className="truncate max-w-[180px]">{compra.organismo}</span>
                      </div>
                      {compra.region && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{compra.region}</span>
                        </div>
                      )}
                      {compra.fecha_cierre && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{format(parseISO(compra.fecha_cierre), "dd MMM yyyy", { locale: es })}</span>
                        </div>
                      )}
                      <span className="font-medium text-foreground">{formatCurrency(compra.monto)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
