import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Package, PackageSearch, FileText, Calendar, MapPin, Building2, DollarSign, CheckCircle2, XCircle, ShieldCheck, ShieldX, AlertCircle, TrendingUp, Clock, Percent, AlertTriangle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { useLicitacionItems, type LicitacionItem } from "@/hooks/useLicitacionItems";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { clasificarProceso, formatCurrency, montoEnUTM } from "@/utils/clasificacion";

interface MatchPanelProps {
  compra: CompraAgil | null;
  onGenerarPropuesta: (productos: any[]) => void;
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
  const { data: items, isLoading: isLoadingItems } = useLicitacionItems(compra?.codigo || null);

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

  // Preparar todos los items con su información de match para la propuesta
  const productosParaPropuesta = items?.map(item => ({
    itemId: `${item.licitacion_codigo}-${item.item_index}`,
    itemIndex: item.item_index,
    nombre: item.nombre || 'Sin nombre',
    descripcion: item.descripcion || '',
    cantidadSolicitada: typeof item.cantidad === 'number' ? item.cantidad : parseFloat(item.cantidad || '1'),
    unidadMedida: item.unidad || 'unidad',
    match: item.match_sku ? {
      id: item.match_sku,
      sku: item.match_sku,
      nombre: item.nombre || '',
      precio_unitario: item.costo_unitario || 0,
      stock: null,
      matchScore: item.confidence_score ? Math.round(item.confidence_score * 100) : 0,
      margen_estimado: item.margen_estimado || 0,
    } : null,
  })) || [];

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
        <div className="space-y-3 mb-4">
          <h3 className="font-medium text-foreground line-clamp-2">{compra.nombre}</h3>
          
          {/* Información de clasificación */}
          {compra.monto && (() => {
            const clasificacion = clasificarProceso(compra.monto);
            const montoUTM = montoEnUTM(compra.monto);
            return (
              <div className="p-2 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant={clasificacion.tipo === 'compra_agil' ? 'default' : 'secondary'}>
                    {clasificacion.tipo === 'compra_agil' ? 'Compra Ágil' : 'Licitación'} {clasificacion.categoria}
                  </Badge>
                  {montoUTM && (
                    <span className="text-xs text-muted-foreground">{montoUTM.toFixed(1)} UTM</span>
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>Plazo mínimo: {clasificacion.plazoMinimoDias} días corridos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {clasificacion.requiereFEA ? (
                      <>
                        <ShieldCheck className="h-3 w-3 text-orange-500" />
                        <span className="text-orange-600">Firma Electrónica Avanzada (FEA) requerida</span>
                      </>
                    ) : (
                      <>
                        <ShieldX className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Firma Simple suficiente</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {clasificacion.requiereGarantia ? (
                      <>
                        <AlertCircle className="h-3 w-3 text-red-500" />
                        <span className="text-red-600">Garantía de Fiel Cumplimiento requerida (5-30%)</span>
                      </>
                    ) : clasificacion.categoria === 'LE' ? (
                      <>
                        <ShieldX className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Garantía discrecional</span>
                      </>
                    ) : (
                      <>
                        <ShieldX className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Sin garantía requerida</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
          
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

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <PackageSearch className="h-4 w-4 text-primary" />
              Productos Solicitados
              {items && items.length > 0 && (
                <Badge variant="secondary">{items.length}</Badge>
              )}
            </h4>
          </div>

          {isLoadingItems ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : items && items.length > 0 ? (
            <>
              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-3">
                  {items.map((item) => {
                    const tieneMatch = item.match_sku !== null && item.confidence_score !== null;
                    const confidenceScore = item.confidence_score ? Math.round(item.confidence_score * 100) : 0;
                    
                    return (
                      <div
                        key={`${item.licitacion_codigo}-${item.item_index}`}
                        className={`border rounded-lg p-3 transition-colors ${
                          tieneMatch 
                            ? 'border-primary/50 bg-primary/5' 
                            : 'border-border bg-background'
                        }`}
                      >
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Item #{item.item_index}
                                  </span>
                                  {tieneMatch && (
                                    <MatchScoreBadge score={confidenceScore} />
                                  )}
                                  {!tieneMatch && (
                                    <Badge variant="secondary" className="text-xs">
                                      Sin match
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-medium text-sm">
                                  {item.nombre || 'Sin nombre'}
                                </p>
                                {item.descripcion && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {item.descripcion}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  {item.cantidad && (
                                    <span>Cantidad: {item.cantidad}</span>
                                  )}
                                  {item.unidad && (
                                    <span>Unidad: {item.unidad}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {tieneMatch && (
                            <div className="pt-2 border-t border-primary/20">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-xs font-medium text-green-700">Match encontrado</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">SKU: </span>
                                  <span className="font-mono font-medium">{item.match_sku}</span>
                                </div>
                                {item.costo_unitario && (
                                  <div>
                                    <span className="text-muted-foreground">Costo: </span>
                                    <span className="font-medium">{formatCurrency(item.costo_unitario)}</span>
                                  </div>
                                )}
                                {item.margen_estimado && (
                                  <div>
                                    <span className="text-muted-foreground">Margen: </span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className={`font-medium ${
                                          item.margen_estimado >= 0.3 ? 'text-green-600' :
                                          item.margen_estimado >= 0.15 ? 'text-orange-600' :
                                          item.margen_estimado >= 0.10 ? 'text-yellow-600' :
                                          'text-red-600'
                                        }`}>
                                          {Math.round(item.margen_estimado * 100)}%
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">
                                          {item.margen_estimado >= 0.3 ? '✅ Margen excelente' :
                                           item.margen_estimado >= 0.15 ? '✅ Margen bueno' :
                                           item.margen_estimado >= 0.10 ? '⚠️ Margen aceptable' :
                                           '❌ Margen bajo - Revisar'}
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                                {item.confidence_score && (
                                  <div>
                                    <span className="text-muted-foreground">Confianza: </span>
                                    <span className="font-medium">
                                      {Math.round(item.confidence_score * 100)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {!tieneMatch && (
                            <div className="pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  No se encontró match para este producto
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="pt-4 mt-auto border-t">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      className="w-full" 
                      onClick={() => onGenerarPropuesta(productosParaPropuesta)}
                      disabled={productosParaPropuesta.length === 0}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generar Propuesta
                      {productosParaPropuesta.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {productosParaPropuesta.length} items
                        </Badge>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {productosParaPropuesta.length === 0 ? (
                      <p className="text-xs">No hay productos solicitados para generar propuesta</p>
                    ) : (
                      <p className="text-xs">
                        Genera una propuesta comercial con {productosParaPropuesta.length} producto{productosParaPropuesta.length > 1 ? 's' : ''} solicitado{productosParaPropuesta.length > 1 ? 's' : ''}
                        {productosParaPropuesta.filter(p => p.match).length > 0 && (
                          <span className="block mt-1">
                            ({productosParaPropuesta.filter(p => p.match).length} con match)
                          </span>
                        )}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay productos solicitados aún</p>
                <p className="text-xs mt-1">El scraper está extrayendo el listado de productos...</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}