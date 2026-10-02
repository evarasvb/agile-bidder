// Picker visual del Market del Estado para elegir, dentro del armado de la
// propuesta, un producto de un proveedor real cuando no lo tenemos en el
// inventario (o queremos reemplazar el match). Muestra, por proveedor: nombre,
// RUT, si está en FirmaVB, cuántas órdenes de compra y organismos le ha vendido
// al Estado, su última venta y el precio de referencia (Mercado Público). Al
// elegir un producto, llena esa línea de la propuesta.
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Store, Search, ShoppingCart, CheckCircle2, Building2, Receipt } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMarketBuscar, type MarketProveedor } from '@/hooks/useMarketEstado';

const clp = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-CL')}`);
const fecha = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }) : null);

export interface MarketSeleccion {
  rut: string;
  proveedor: string;
  producto: string;
  precioRef: number | null;
}

export function MarketPickerDialog({
  abierto,
  terminoInicial,
  onClose,
  onSeleccionar,
}: {
  abierto: boolean;
  terminoInicial: string;
  onClose: () => void;
  onSeleccionar: (sel: MarketSeleccion) => void;
}) {
  const [input, setInput] = useState(terminoInicial);
  const q = useDebouncedValue(input.trim(), 400);
  const { data: proveedores = [], isLoading } = useMarketBuscar(q);

  // Al abrir con un ítem distinto, precarga su descripción como término.
  useEffect(() => {
    if (abierto) setInput(terminoInicial);
  }, [abierto, terminoInicial]);

  return (
    <Dialog open={abierto} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-firmavb-blue" /> Buscar en el Market del Estado
          </DialogTitle>
          <DialogDescription>
            Elige el producto de un proveedor que ya le vende esto al Estado. Se usará para esta línea de la propuesta y, al final, podrás pedirle cotización.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: resma papel carta, toner, guantes nitrilo"
            className="pl-8 h-11"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto -mr-2 pr-2">
          {q.length < 3 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Escribe al menos 3 letras para buscar proveedores.</p>
          ) : isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
            </div>
          ) : proveedores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No encontramos proveedores para “{q}”. Prueba con otra palabra.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {proveedores.map((p) => (
                <ProveedorCard key={p.rut} p={p} onElegir={(producto, precioRef) => { onSeleccionar({ rut: p.rut, proveedor: p.proveedor, producto, precioRef }); onClose(); }} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProveedorCard({ p, onElegir }: { p: MarketProveedor; onElegir: (producto: string, precioRef: number | null) => void }) {
  const ultima = fecha(p.ultima_venta);
  return (
    <div className="rounded-xl border p-3 flex flex-col bg-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight truncate" title={p.proveedor}>{p.proveedor}</p>
          <p className="text-[11px] text-muted-foreground font-mono">RUT {p.rut}</p>
        </div>
        {p.es_firmavb && (
          <Badge className="shrink-0 bg-firmavb-green/15 text-firmavb-green border-0 gap-1">
            <CheckCircle2 className="h-3 w-3" /> FirmaVB
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Receipt className="h-3 w-3" /> {p.n_oc} OC</span>
        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.n_organismos} organismos</span>
        {ultima && <span>Última venta {ultima}</span>}
        <span className="text-foreground">Mediana {clp(p.precio_mediana)}</span>
      </div>

      <div className="mt-2 border-t pt-2 space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Elige un producto</p>
        {p.productos.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin productos detallados.</p>
        ) : (
          p.productos.slice(0, 4).map((x, i) => {
            const precioRef = x.precio_mediana ?? x.precio ?? null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onElegir(x.producto, precioRef)}
                className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                title={`Usar: ${x.producto}`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-primary shrink-0" />
                  {x.producto}{x.catalogo ? ' · catálogo' : ''}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{clp(precioRef)}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
