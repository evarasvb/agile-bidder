import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, DollarSign, Percent, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { useLicitacionProductMatch, type ProductMatch } from "@/hooks/useLicitacionProductMatch";
import { formatCurrency } from "@/utils/clasificacion";
import { cn } from "@/lib/utils";

interface ProductMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  licitacionId: string | null;
  licitacionNombre: string;
}

function MatchCard({ match }: { match: ProductMatch }) {
  const { inventoryItem, licitacionItem, score, matchedTerms } = match;
  
  return (
    <div className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* Item de licitación */}
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Item Solicitado:</p>
              <p className="font-medium text-sm">{licitacionItem.nombre_producto}</p>
              {licitacionItem.descripcion && (
                <p className="text-xs text-muted-foreground mt-0.5">{licitacionItem.descripcion}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Cantidad: {licitacionItem.cantidad || 1} {licitacionItem.unidad || 'un'}
              </p>
            </div>
          </div>
          
          {/* Producto del catálogo */}
          <div className="flex items-start gap-2 pt-2 border-t">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Producto del Catálogo:</p>
              <p className="font-semibold text-primary">{inventoryItem.nombre_producto}</p>
              {inventoryItem.descripcion && (
                <p className="text-xs text-muted-foreground mt-0.5">{inventoryItem.descripcion}</p>
              )}
              
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs gap-1">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(inventoryItem.precio_unitario)}
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <Package className="h-3 w-3" />
                  Stock: {inventoryItem.stock_disponible}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {inventoryItem.categoria}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Términos que matchearon */}
          {matchedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {matchedTerms.map((term, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  <Tag className="h-3 w-3 mr-1" />
                  {term}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        {/* Score */}
        <div className="flex flex-col items-center justify-center min-w-[60px]">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold",
            score >= 70 ? "bg-green-100 text-green-700" :
            score >= 50 ? "bg-yellow-100 text-yellow-700" :
            "bg-orange-100 text-orange-700"
          )}>
            {Math.round(score)}%
          </div>
          <span className="text-xs text-muted-foreground mt-1">Match</span>
        </div>
      </div>
    </div>
  );
}

export function ProductMatchModal({ isOpen, onClose, licitacionId, licitacionNombre }: ProductMatchModalProps) {
  const { data: matchResult, isLoading } = useLicitacionProductMatch(licitacionId);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Productos que Coinciden
          </DialogTitle>
          <p className="text-sm text-muted-foreground truncate">{licitacionNombre}</p>
        </DialogHeader>
        
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : matchResult ? (
          <div className="space-y-4">
            {/* Resumen */}
            <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {matchResult.matchedItems} de {matchResult.totalItems} items con match
                </span>
              </div>
              <Badge 
                variant={matchResult.matchedItems > 0 ? "default" : "secondary"}
                className={matchResult.matchedItems > 0 ? "bg-green-500" : ""}
              >
                {matchResult.totalItems > 0 
                  ? `${Math.round((matchResult.matchedItems / matchResult.totalItems) * 100)}% cobertura`
                  : "Sin items"
                }
              </Badge>
            </div>
            
            {/* Lista de matches */}
            <ScrollArea className="h-[400px] pr-4">
              {matchResult.matches.length > 0 ? (
                <div className="space-y-3">
                  {matchResult.matches.map((match, idx) => (
                    <MatchCard key={idx} match={match} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mb-3 opacity-50" />
                  <p className="font-medium">No se encontraron coincidencias</p>
                  <p className="text-sm">Agrega más productos al catálogo para mejorar el matching</p>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
            <p>No se pudo cargar la información</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
