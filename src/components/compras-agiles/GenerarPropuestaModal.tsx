import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Package, Calculator, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { MatchedProduct } from "@/hooks/useMatchInventario";
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { useUpdateCompraAgil } from "@/hooks/useComprasAgiles";

interface GenerarPropuestaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraAgil | null;
  productos: MatchedProduct[];
}

interface ProductoSeleccionado extends MatchedProduct {
  cantidad: number;
  selected: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function GenerarPropuestaModal({ open, onOpenChange, compra, productos }: GenerarPropuestaModalProps) {
  const updateCompra = useUpdateCompraAgil();
  
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoSeleccionado[]>(() =>
    productos.map(p => ({ ...p, cantidad: 1, selected: p.matchScore >= 50 }))
  );

  const handleToggleProducto = (id: string) => {
    setProductosSeleccionados(prev =>
      prev.map(p => p.id === id ? { ...p, selected: !p.selected } : p)
    );
  };

  const handleCantidadChange = (id: string, cantidad: number) => {
    setProductosSeleccionados(prev =>
      prev.map(p => p.id === id ? { ...p, cantidad: Math.max(1, cantidad) } : p)
    );
  };

  const productosActivos = productosSeleccionados.filter(p => p.selected);
  const montoTotal = productosActivos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);

  const handleGuardarPropuesta = async () => {
    if (!compra) return;

    const propuesta = {
      fecha_generacion: new Date().toISOString(),
      productos: productosActivos.map(p => ({
        id: p.id,
        sku: p.sku,
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio_unitario: p.precio_unitario,
        subtotal: p.precio_unitario * p.cantidad,
      })),
      monto_total: montoTotal,
      estado: 'borrador',
    };

    try {
      await updateCompra.mutateAsync({
        id: compra.id,
        datos_json: { propuesta },
      });
      toast.success('Propuesta guardada exitosamente');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving proposal:', error);
      toast.error('Error al guardar la propuesta');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generar Propuesta
          </DialogTitle>
          {compra && (
            <p className="text-sm text-muted-foreground">
              Para: <span className="font-medium">{compra.codigo}</span> - {compra.nombre}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="mb-4">
            <Label className="text-sm font-medium">Selecciona los productos a incluir</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ajusta las cantidades según los requerimientos de la compra
            </p>
          </div>

          <ScrollArea className="h-[300px] pr-4 -mr-4">
            <div className="space-y-3">
              {productosSeleccionados.map((producto) => (
                <div
                  key={producto.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    producto.selected ? 'border-primary/50 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={producto.selected}
                      onCheckedChange={() => handleToggleProducto(producto.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{producto.sku}</span>
                        <Badge variant="secondary" className="text-xs">{producto.matchScore}%</Badge>
                      </div>
                      <p className="font-medium text-sm mt-0.5 truncate">{producto.nombre}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {producto.categoria && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{producto.categoria}</span>
                        )}
                        <span className="text-xs text-muted-foreground">Stock: {producto.stock ?? 'N/A'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(producto.precio_unitario)}</p>
                        <p className="text-xs text-muted-foreground">c/u</p>
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          min={1}
                          value={producto.cantidad}
                          onChange={(e) => handleCantidadChange(producto.id, parseInt(e.target.value) || 1)}
                          disabled={!producto.selected}
                          className="text-center h-8"
                        />
                      </div>
                      <div className="w-24 text-right">
                        <p className="text-sm font-semibold text-primary">
                          {formatCurrency(producto.precio_unitario * producto.cantidad)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>{productosActivos.length} productos seleccionados</span>
            </div>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-lg font-bold text-primary">{formatCurrency(montoTotal)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGuardarPropuesta}
              disabled={productosActivos.length === 0 || updateCompra.isPending}
            >
              {updateCompra.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Guardar Propuesta
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
