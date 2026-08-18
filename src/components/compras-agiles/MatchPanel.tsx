// @ts-nocheck
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Package, PackageSearch, FileText, Calendar, MapPin, Building2, 
  DollarSign, CheckCircle2, XCircle, ShieldCheck, ShieldX, AlertCircle,
  Sparkles, RefreshCw, TrendingUp
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle, Repeat2, Ban } from "lucide-react";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { useProductMatching, type ItemConMatch } from "@/hooks/useProductMatching";
import { clasificarProceso, formatCurrency, montoEnUTM } from "@/utils/clasificacion";
import { useLicitacionItems, type LicitacionItem } from '@/hooks/useLicitacionItems';
import { useInventoryActivo, type InventoryItem } from "@/hooks/useInventory";
import { useMatchOverrides } from "@/hooks/useMatchOverrides";
import { MatchItemActions } from "./MatchItemActions";

interface MatchPanelProps {
  compra: CompraAgil | null;
  onGenerarPropuesta: (productos: any[]) => void;
  
}

export function MatchPanel({ compra, onGenerarPropuesta }: MatchPanelProps) {
  const { 
procesarCompra,
        procesarCompraAgil, 
    calcularScorePromedio, 
    isLoading: isLoadingInventario 
  } = useProductMatching();

    // Obtener items de la DB directamente (igual que Vista Detalle)
  const { data: licitacionItems, isLoading: isLoadingItems } = useLicitacionItems(compra?.codigo || '');

  // Correcciones manuales del match (por cliente) + inventario para resolver reasignaciones.
  const { data: overrides = {} } = useMatchOverrides(compra?.codigo);
  const { data: inventarioActivo = [] } = useInventoryActivo();
  const inventarioById = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    (inventarioActivo as InventoryItem[]).forEach((p) => m.set(p.id, p));
    return m;
  }, [inventarioActivo]);

  const [itemsConMatch, setItemsConMatch] = useState<ItemConMatch[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scorePromedio, setScorePromedio] = useState(0);
  
  // Procesar compra cuando cambia
  useEffect(() => {
      if (compra && !isLoadingInventario && !isLoadingItems) {
      setIsProcessing(true);
      // Pequeño delay para mostrar loading
      const timer = setTimeout(() => {
        // Usar items de la DB si están disponibles (igual que Vista Detalle)
        let items;
        if (licitacionItems && licitacionItems.length > 0) {
          // Convertir licitacionItems a ItemRequerido para matching
          const itemsDesdeDB = licitacionItems.map((item, idx) => ({
            id: item.id?.toString() || `db-${idx}`,
            nombre: item.descripcion || '',
            descripcion: item.descripcion || '',
            cantidad: item.cantidad || 1,
            unidad: item.unidad || 'UN'
          }));
          items = procesarCompra(itemsDesdeDB);
        } else {
          // Fallback a procesarCompraAgil si no hay items en DB
          items = procesarCompraAgil(compra);
        }
        setItemsConMatch(items);
        setScorePromedio(calcularScorePromedio(items));
        setIsProcessing(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setItemsConMatch([]);
      setScorePromedio(0);
    }
  }, [compra, procesarCompraAgil, procesarCompra, calcularScorePromedio, isLoadingInventario, licitacionItems, isLoadingItems]);  
  const handleRefreshMatches = () => {
    if (!compra) return;
    setIsProcessing(true);
    setTimeout(() => {
      const items = procesarCompraAgil(compra);
      setItemsConMatch(items);
      setScorePromedio(calcularScorePromedio(items));
      setIsProcessing(false);
    }, 300);
  };

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

  // Resuelve el match efectivo de un ítem aplicando la corrección manual del cliente.
  //   estado: 'auto' | 'confirmado' | 'reasignado' | 'descartado'
  const resolverItem = (item: ItemConMatch) => {
    const ov = overrides[String(item.id)];
    if (ov?.accion === 'descartado') {
      return { estado: 'descartado' as const, match: null, override: ov };
    }
    if (ov?.accion === 'reasignado' && ov.inventario_id) {
      const prod = inventarioById.get(ov.inventario_id);
      if (prod) {
        return {
          estado: 'reasignado' as const,
          override: ov,
          match: {
            inventoryItem: prod,
            score: ov.score_manual ?? 100,
            matchType: 'manual',
            matchedTerms: [] as string[],
          },
        };
      }
    }
    return {
      estado: (ov?.accion === 'confirmado' ? 'confirmado' : 'auto') as 'confirmado' | 'auto',
      match: item.bestMatch,
      override: ov,
    };
  };

  const itemsResueltos = itemsConMatch.map((item) => ({ item, ...resolverItem(item) }));

  // Preparar items para la propuesta (excluye descartados, usa el match efectivo)
  const productosParaPropuesta = itemsResueltos
    .filter((r) => r.estado !== 'descartado' && r.match)
    .map(({ item, match }) => ({
      itemId: item.id,
      itemIndex: item.id,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      cantidadSolicitada: item.cantidad || 1,
      unidadMedida: item.unidad || 'UN',
      match: {
        id: match!.inventoryItem.id,
        sku: match!.inventoryItem.sku,
        nombre: match!.inventoryItem.nombre_producto,
        precio_unitario: match!.inventoryItem.precio_unitario,
        stock: match!.inventoryItem.stock_disponible,
        matchScore: match!.score,
        margen_estimado: (match!.inventoryItem.margen_objetivo ?? 0) / 100,
      },
    }));

  const itemsConMatchExitoso = itemsResueltos.filter((r) => r.estado !== 'descartado' && r.match);

  const getMatchBadgeColor = (score: number) => {
    if (score >= 85) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (score >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

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
          
          {/* Score de Match Promedio */}
          {scorePromedio > 0 && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Match Promedio:</span>
              <Badge className={getMatchBadgeColor(scorePromedio)}>
                {scorePromedio}%
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {itemsConMatchExitoso.length}/{itemsConMatch.length} items
              </span>
            </div>
          )}
          
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
              Matches de Inventario
              {itemsConMatch.length > 0 && (
                <Badge variant="secondary">{itemsConMatch.length}</Badge>
              )}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshMatches}
              disabled={isProcessing || isLoadingInventario}
            >
              <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {isProcessing || isLoadingInventario ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : itemsConMatch.length > 0 ? (
            <>
              <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-4">
                  {itemsResueltos.map(({ item, estado, match }) => {
                    const descartado = estado === 'descartado';
                    const cardTone =
                      descartado ? 'border-dashed border-border bg-muted/30 opacity-70'
                      : estado === 'reasignado' ? 'border-firmavb-blue/40 bg-firmavb-blue/5'
                      : estado === 'confirmado' ? 'border-green-300 bg-green-50/70'
                      : match ? 'border-green-200 bg-green-50/40'
                      : 'border-amber-200 bg-amber-50/40';
                    return (
                      <div key={item.id} className={`border rounded-xl p-4 transition-colors ${cardTone}`}>
                        {/* Encabezado: ítem solicitado + acciones */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Ítem solicitado</span>
                            <p className={`font-medium text-sm mt-0.5 ${descartado ? 'line-through' : ''}`}>{item.nombre}</p>
                            {item.descripcion && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descripcion}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                              {item.cantidad && <span>Cantidad: {item.cantidad}</span>}
                              {item.unidad && <span>Unidad: {item.unidad}</span>}
                            </div>
                          </div>
                          <MatchItemActions
                            codigo={compra.codigo}
                            itemRef={String(item.id)}
                            itemNombre={item.nombre}
                            hasSuggestion={!!match}
                            override={overrides[String(item.id)]}
                          />
                        </div>

                        {/* Estado del match */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-3">
                          {match ? (
                            <Badge className={`text-xs ${getMatchBadgeColor(match.score)}`}>
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {Math.round(match.score)}% match
                            </Badge>
                          ) : !descartado ? (
                            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Sin match — corrige →</Badge>
                          ) : null}
                          {estado === 'confirmado' && (
                            <Badge variant="outline" className="text-xs text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Confirmado por ti</Badge>
                          )}
                          {estado === 'reasignado' && (
                            <Badge variant="outline" className="text-xs text-firmavb-blue border-firmavb-blue/40"><Repeat2 className="h-3 w-3 mr-1" />Elegido por ti</Badge>
                          )}
                          {descartado && (
                            <Badge variant="outline" className="text-xs text-muted-foreground"><Ban className="h-3 w-3 mr-1" />Descartado</Badge>
                          )}
                        </div>

                        {/* Producto del inventario (match efectivo) */}
                        {!descartado && match && (
                          <div className="mt-3 p-3 bg-background rounded-lg border border-border/70">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground line-clamp-1">{match.inventoryItem.nombre_producto}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  SKU: {match.inventoryItem.sku || '—'} · Stock: {match.inventoryItem.stock_disponible ?? '—'}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-foreground">{formatCurrency(match.inventoryItem.precio_unitario)}</p>
                                <p className="text-[11px] text-muted-foreground">{match.matchType}</p>
                              </div>
                            </div>
                            {match.matchedTerms && match.matchedTerms.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {match.matchedTerms.slice(0, 4).map((term, idx) => (
                                  <span key={idx} className="text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{term}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {descartado && (
                          <p className="mt-2 text-xs text-muted-foreground">No aparecerá en la cotización. Puedes revertirlo desde el menú.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="pt-4 border-t mt-4">
                <Button
                  onClick={() => onGenerarPropuesta(productosParaPropuesta)}
                  className="w-full gap-2"
                  disabled={itemsConMatchExitoso.length === 0}
                >
                  <FileText className="h-4 w-4" />
                  Generar Cotización ({itemsConMatchExitoso.length} productos)
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No se encontraron items para hacer matching</p>
                <p className="text-xs mt-1">Agrega productos al inventario para ver coincidencias</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
