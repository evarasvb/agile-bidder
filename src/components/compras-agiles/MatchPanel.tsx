import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, PackageSearch, FileText, Calendar, MapPin, Building2, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useMatchInventario, type MatchedProduct } from "@/hooks/useMatchInventario";
import type { CompraAgil } from "@/hooks/useComprasAgiles";

interface MatchPanelProps {
  compra: CompraAgil | null;
  onGenerarPropuesta: (productos: MatchedProduct[]) => void;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function MatchScoreBadge({ score }: { score: number }) {
  const variant = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'secondary';
  return (
    <Badge variant={variant} className="text-xs">
      {score}% match
    </Badge>
  );
}

export function MatchPanel({ compra, onGenerarPropuesta }: MatchPanelProps) {
  const { data: productos, isLoading } = useMatchInventario(compra?.nombre || null);

  if (!compra) {
    return (
      <Card className="shadow-sm h-full">
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <PackageSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Selecciona una compra para ver productos coincidentes</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Detalle de Compra
          </CardTitle>
          <p className="text-xs text-muted-foreground font-mono">{compra.codigo}</p>
        </div>
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col overflow-hidden">
        {/* Compra Details */}
        <div className="space-y-3 mb-4">
          <h3 className="font-medium text-foreground line-clamp-2">{compra.nombre}</h3>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="truncate">{compra.organismo}</span>
            </div>
            {compra.region && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{compra.region}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <span className="font-medium text-foreground">{formatCurrency(compra.monto)}</span>
            </div>
            {compra.fecha_cierre && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(parseISO(compra.fecha_cierre), "dd MMM yyyy", { locale: es })}</span>
              </div>
            )}
          </div>

          {compra.descripcion && (
            <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
              {compra.descripcion}
            </p>
          )}
        </div>

        {/* Matched Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-primary" />
              Productos Coincidentes
              {productos && productos.length > 0 && (
                <Badge variant="secondary">{productos.length}</Badge>
              )}
            </h4>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : productos && productos.length > 0 ? (
            <>
              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-2">
                  {productos.map((producto) => (
                    <div
                      key={producto.id}
                      className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">{producto.sku}</span>
                            <MatchScoreBadge score={producto.matchScore} />
                          </div>
                          <p className="font-medium text-sm mt-1 truncate">{producto.nombre}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {producto.categoria && (
                              <span className="bg-muted px-1.5 py-0.5 rounded">{producto.categoria}</span>
                            )}
                            <span>Stock: {producto.stock ?? 'N/A'}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(producto.precio_unitario)}</p>
                          {producto.tiempo_entrega_dias && (
                            <p className="text-xs text-muted-foreground">{producto.tiempo_entrega_dias} días</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="pt-4 mt-auto border-t">
                <Button 
                  className="w-full" 
                  onClick={() => onGenerarPropuesta(productos)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generar Propuesta
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No se encontraron productos coincidentes</p>
                <p className="text-xs mt-1">Agrega productos a tu inventario para encontrar matches</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
