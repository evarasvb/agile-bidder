import { useMemo, useState } from "react";
import { Plus, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInventoryActivo, type InventoryItem } from "@/hooks/useInventory";
import { useUpsertMatchOverride } from "@/hooks/useMatchOverrides";
import { formatCurrency } from "@/utils/clasificacion";
import { toast } from "sonner";

interface Props {
  codigo: string;
  procesoTipo?: string;
}

/** Botón para sumar a la oferta un producto de tu inventario que no venía en
 *  el listado de ítems pedidos por el organismo (p. ej. algo extra que quieres ofrecer). */
export function AgregarProductoManual({ codigo, procesoTipo }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: inventario = [], isLoading } = useInventoryActivo();
  const upsert = useUpsertMatchOverride();

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

  const agregar = (p: InventoryItem) => {
    const itemRef = `manual-${p.id}-${Date.now()}`;
    upsert.mutate(
      { codigo, itemRef, itemNombre: p.nombre_producto, accion: "reasignado", inventarioId: p.id, scoreManual: 100, procesoTipo },
      {
        onSuccess: () => {
          toast.success(`Agregado "${p.nombre_producto}" a tu oferta`);
          setOpen(false);
          setQuery("");
        },
      }
    );
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Agregar producto manual
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-firmavb-blue" /> Agregar un producto a tu oferta
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Elige un producto de tu inventario para sumarlo aunque no estuviera en el listado pedido.
            </p>
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
                <p className="text-sm">Sin productos para "{query}".</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {resultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregar(p)}
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
