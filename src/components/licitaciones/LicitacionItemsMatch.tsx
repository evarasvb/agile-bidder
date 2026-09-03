import { useMemo } from "react";
import { Package, TrendingUp, CheckCircle, Repeat2, Ban, PackageSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProductMatching } from "@/hooks/useProductMatching";
import { useInventoryActivo, type InventoryItem } from "@/hooks/useInventory";
import { useMatchOverrides } from "@/hooks/useMatchOverrides";
import { MatchItemActions } from "@/components/compras-agiles/MatchItemActions";
import { formatCurrency } from "@/utils/clasificacion";

interface Props {
  codigo: string;
  items: any[] | undefined;
}

function badgeColor(score: number) {
  if (score >= 85) return "bg-green-100 text-green-800 border-green-200";
  if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
  if (score >= 40) return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200";
}

/** Productos solicitados de una licitación con su coincidencia contra el
 *  inventario del cliente y la posibilidad de corregir el match por ítem
 *  (confirmar / reasignar / descartar / editar), persistido en match_overrides. */
export function LicitacionItemsMatch({ codigo, items }: Props) {
  const { procesarCompra, isLoading: invLoading } = useProductMatching();
  const { data: overrides = {} } = useMatchOverrides(codigo, 'licitacion');
  const { data: inventarioActivo = [] } = useInventoryActivo();

  const inventarioById = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    (inventarioActivo as InventoryItem[]).forEach((p) => m.set(p.id, p));
    return m;
  }, [inventarioActivo]);

  const itemsConMatch = useMemo(() => {
    if (!items || items.length === 0) return [];
    const mapped = items.map((it, idx) => ({
      id: String(it.id ?? `idx-${idx}`),
      nombre: it.nombre_producto || it.nombre || "",
      descripcion: it.descripcion || "",
      cantidad: it.cantidad ?? 1,
      unidad: it.unidad || "unidad",
    }));
    return procesarCompra(mapped);
  }, [items, procesarCompra]);

  const resolver = (item: any) => {
    const ov = overrides[String(item.id)];
    if (ov?.accion === "descartado") return { estado: "descartado" as const, match: null };
    if (ov?.accion === "reasignado" && ov.inventario_id) {
      const prod = inventarioById.get(ov.inventario_id);
      if (prod) return { estado: "reasignado" as const, match: { inventoryItem: prod, score: ov.score_manual ?? 100 } };
    }
    return {
      estado: (ov?.accion === "confirmado" ? "confirmado" : "auto") as "confirmado" | "auto",
      match: item.bestMatch ? { inventoryItem: item.bestMatch.inventoryItem, score: item.bestMatch.score } : null,
    };
  };

  const total = items?.length || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5 text-firmavb-blue" />
          Productos Solicitados ({total})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Coincidencia con tu inventario. Si el match está mal, corrígelo con el menú de cada ítem.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {invLoading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : itemsConMatch.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <PackageSearch className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No hay ítems detallados para esta licitación.</p>
          </div>
        ) : (
          itemsConMatch.map((item: any) => {
            const { estado, match } = resolver(item);
            const descartado = estado === "descartado";
            const tone =
              descartado ? "border-dashed border-border bg-muted/30 opacity-70"
              : estado === "reasignado" ? "border-firmavb-blue/40 bg-firmavb-blue/5"
              : estado === "confirmado" ? "border-green-300 bg-green-50/70"
              : match ? "border-green-200 bg-green-50/40"
              : "border-amber-200 bg-amber-50/40";
            return (
              <div key={item.id} className={`border rounded-xl p-4 transition-colors ${tone}`}>
                <div className="flex flex-col md:flex-row md:items-start gap-3">
                  {/* Ítem solicitado */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Ítem solicitado</span>
                    <p className={`font-medium text-sm mt-0.5 ${descartado ? "line-through" : ""}`}>{item.nombre}</p>
                    {item.descripcion && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.descripcion}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {item.cantidad != null && <span>Cantidad: {item.cantidad}</span>}
                      {item.unidad && <span>Unidad: {item.unidad}</span>}
                    </div>
                  </div>

                  {/* Match efectivo */}
                  <div className="md:w-[46%] shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      {match ? (
                        <Badge className={`text-xs ${badgeColor(match.score)}`}>
                          <TrendingUp className="h-3 w-3 mr-1" />{Math.round(match.score)}% match
                        </Badge>
                      ) : !descartado ? (
                        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300">Sin match — corrige →</Badge>
                      ) : null}
                      {estado === "confirmado" && <Badge variant="outline" className="text-xs text-green-700 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Confirmado</Badge>}
                      {estado === "reasignado" && <Badge variant="outline" className="text-xs text-firmavb-blue border-firmavb-blue/40"><Repeat2 className="h-3 w-3 mr-1" />Elegido por ti</Badge>}
                      {descartado && <Badge variant="outline" className="text-xs text-muted-foreground"><Ban className="h-3 w-3 mr-1" />Descartado</Badge>}
                    </div>
                    {!descartado && match && (
                      <div className="p-2.5 bg-background rounded-lg border border-border/70">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium line-clamp-1">{match.inventoryItem.nombre_producto}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">SKU: {match.inventoryItem.sku || "—"} · Stock: {match.inventoryItem.stock_disponible ?? "—"}</p>
                          </div>
                          <p className="text-sm font-bold shrink-0">{formatCurrency(match.inventoryItem.precio_unitario)}</p>
                        </div>
                      </div>
                    )}
                    {descartado && <p className="text-xs text-muted-foreground">No entra en la oferta. Revertible desde el menú.</p>}
                  </div>

                  {/* Acciones */}
                  <div className="shrink-0 self-start">
                    <MatchItemActions
                      codigo={codigo}
                      itemRef={String(item.id)}
                      itemNombre={item.nombre}
                      hasSuggestion={!!match}
                      override={overrides[String(item.id)]}
                      procesoTipo="licitacion"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
