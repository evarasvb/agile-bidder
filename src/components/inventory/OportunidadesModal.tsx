import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Calendar, ExternalLink, MapPin, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import type { InventoryItem } from "@/hooks/useInventory";
import type { CompraAgilMatch } from "@/hooks/useComprasAgilesMatch";

interface OportunidadesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: InventoryItem | null;
  matches: CompraAgilMatch[];
  isLoading?: boolean;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  try {
    return format(parseISO(dateStr), "dd MMM yyyy", { locale: es });
  } catch {
    return "-";
  }
}

function getDaysRemaining(fechaCierre: string | null): number | null {
  if (!fechaCierre) return null;
  try {
    return differenceInDays(parseISO(fechaCierre), new Date());
  } catch {
    return null;
  }
}

function getEstadoBadge(estado: string | null, diasRestantes: number | null) {
  if (estado === "urgente" || (diasRestantes !== null && diasRestantes <= 2)) {
    return (
      <Badge variant="accent" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Urgente
      </Badge>
    );
  }
  if (estado === "cerrada") {
    return <Badge variant="secondary">Cerrada</Badge>;
  }
  if (estado === "adjudicada") {
    return <Badge variant="success">Adjudicada</Badge>;
  }
  return <Badge variant="outline">Activa</Badge>;
}

function MatchScoreBadge({ score }: { score: number }) {
  const variant = score >= 70 ? "success" : score >= 40 ? "warning" : "secondary";
  return (
    <Badge variant={variant} className="text-xs">
      {score}%
    </Badge>
  );
}

export function OportunidadesModal({
  open,
  onOpenChange,
  product,
  matches,
  isLoading = false,
}: OportunidadesModalProps) {
  const totalMatches = matches.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Oportunidades en Compras Ágiles
            <Badge variant="secondary">{totalMatches}</Badge>
          </DialogTitle>
          {product && (
            <p className="text-sm text-muted-foreground">
              {product.nombre_producto} <span className="font-mono">({product.sku})</span>
            </p>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay compras ágiles abiertas que coincidan con este producto.
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Código</TableHead>
                  <TableHead className="font-semibold">Nombre</TableHead>
                  <TableHead className="font-semibold">Organismo</TableHead>
                  <TableHead className="font-semibold">Cierre</TableHead>
                  <TableHead className="font-semibold">Estado</TableHead>
                  <TableHead className="font-semibold text-center">Match</TableHead>
                  <TableHead className="font-semibold text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match) => {
                  const diasRestantes = getDaysRemaining(match.fecha_cierre);
                  return (
                    <TableRow key={match.id} className="data-row">
                      <TableCell className="font-mono text-sm font-medium text-primary">
                        {match.codigo}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="truncate font-medium">{match.nombre}</div>
                        {match.region && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {match.region}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[200px]">{match.organismo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm">{formatDate(match.fecha_cierre)}</div>
                            {diasRestantes !== null && diasRestantes >= 0 && (
                              <div
                                className={`text-xs ${
                                  diasRestantes <= 2 ? "text-accent font-medium" : "text-muted-foreground"
                                }`}
                              >
                                {diasRestantes === 0 ? "Hoy" : `${diasRestantes} días`}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getEstadoBadge(match.estado, diasRestantes)}</TableCell>
                      <TableCell className="text-center">
                        <MatchScoreBadge score={match.match_score_inventario} />
                      </TableCell>
                      <TableCell className="text-right">
                        {match.link_oficial ? (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={match.link_oficial} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
