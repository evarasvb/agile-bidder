import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MoreVertical, CheckCircle2, Repeat2, XCircle, Pencil, RotateCcw, Search, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInventoryActivo, type InventoryItem } from "@/hooks/useInventory";
import { useUpsertMatchOverride, useClearMatchOverride, type MatchOverride } from "@/hooks/useMatchOverrides";
import { formatCurrency } from "@/utils/clasificacion";
import { toast } from "sonner";

interface Props {
  codigo: string;
  itemRef: string;
  itemNombre: string;
  hasSuggestion: boolean;
  override?: MatchOverride;
  procesoTipo?: string;
}

/** Menú de correcciones del match por ítem: confirmar, reasignar producto,
 *  descartar, editar producto, o quitar la corrección. */
export function MatchItemActions({ codigo, itemRef, itemNombre, hasSuggestion, override, procesoTipo }: Props) {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: inventario = [], isLoading } = useInventoryActivo();
  const upsert = useUpsertMatchOverride();
  const clear = useClearMatchOverride();

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = inventario as InventoryItem[];
    const filtered = !q
      ? base
      : base.filter((p) =>
          (p.nombre_producto || "").toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.categoria || "").toLowerCase().includes(q));
    return filtered.slice(0, 60);
  }, [inventario, query]);

  const confirmar = () =>
    upsert.mutate(
      { codigo, itemRef, itemNombre, accion: "confirmado", procesoTipo },
      { onSuccess: () => toast.success("Match confirmado") }
    );

  const descartar = () =>
    upsert.mutate(
      { codigo, itemRef, itemNombre, accion: "descartado", procesoTipo },
      { onSuccess: () => toast.success("Ítem descartado de la propuesta") }
    );

  const reasignar = (p: InventoryItem) =>
    upsert.mutate(
      { codigo, itemRef, itemNombre, accion: "reasignado", inventarioId: p.id, scoreManual: 100, procesoTipo },
      {
        onSuccess: () => {
          toast.success(`Reasignado a “${p.nombre_producto}”`);
          setPickerOpen(false);
          setQuery("");
        },
      }
    );

  const quitar = () =>
    clear.mutate({ codigo, itemRef, procesoTipo }, { onSuccess: () => toast.success("Corrección quitada") });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Corregir match">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={confirmar} disabled={!hasSuggestion || override?.accion === "confirmado"}>
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> Confirmar match
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPickerOpen(true)}>
            <Repeat2 className="h-4 w-4 mr-2 text-firmavb-blue" /> Cambiar producto…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={descartar} disabled={override?.accion === "descartado"}>
            <XCircle className="h-4 w-4 mr-2 text-red-500" /> Descartar ítem
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/inventario")}>
            <Pencil className="h-4 w-4 mr-2" /> Editar mi inventario
          </DropdownMenuItem>
          {override && (
            <DropdownMenuItem onClick={quitar}>
              <RotateCcw className="h-4 w-4 mr-2" /> Quitar corrección
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Picker para reasignar producto del inventario */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat2 className="h-5 w-5 text-firmavb-blue" /> Elige el producto correcto
            </DialogTitle>
            <p className="text-sm text-muted-foreground line-clamp-2">Para: {itemNombre}</p>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar en mi inventario (nombre, SKU, categoría)…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[360px] pr-3">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando inventario…</p>
            ) : resultados.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin productos para “{query}”.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => reasignar(p)}
                    disabled={upsert.isPending}
                    className="w-full text-left rounded-lg border border-border/60 p-3 transition-colors hover:border-firmavb-blue/50 hover:bg-firmavb-blue/5 disabled:opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm line-clamp-1">{p.nombre_producto}</p>
                      <span className="font-mono text-sm shrink-0">{formatCurrency(p.precio_unitario)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      {p.categoria && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{p.categoria}</Badge>}
                      {p.stock_disponible != null && <span>Stock: {p.stock_disponible}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
