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
import type { CompraAgil } from "@/hooks/useComprasAgiles";
import { useUpdateCompraAgil } from "@/hooks/useComprasAgiles";
import type { MatchedProduct } from "@/hooks/useMatchInventario";

interface GenerarPropuestaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compra: CompraAgil | null;
  productos: MatchedProduct[];
}

interface ItemSeleccionado {
  itemId: string;
  nombre: string;
  descripcion: string;
  cantidadSolicitada: number;
  unidadMedida: string;
  selected: boolean;
  cantidad: number;
  match?: {
    id: string;
    sku: string;
    nombre: string;
    precio_unitario: number;
    stock?: number;
    matchScore: number;
  };
  precioUnitario?: number;
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
  
  const [itemsSeleccionados, setItemsSeleccionados] = useState<ItemSeleccionado[]>(() =>
    productos.map((producto, index) => ({
      itemId: producto.id || `item-${index}`,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      cantidadSolicitada: 1, // Default, puede ajustarse
      unidadMedida: 'unidad',
      selected: producto.matchScore >= 50,
      cantidad: 1,
      match: {
        id: producto.id,
        sku: producto.sku,
        nombre: producto.nombre,
        precio_unitario: producto.precio_unitario,
        stock: producto.stock || undefined,
        matchScore: producto.matchScore
      },
      precioUnitario: producto.precio_unitario
    }))
  );

  const handleToggleItem = (itemId: string) => {
    setItemsSeleccionados(prev =>
      prev.map(item => item.itemId === itemId ? { ...item, selected: !item.selected } : item)
    );
  };

  const handleCantidadChange = (itemId: string, cantidad: number) => {
    setItemsSeleccionados(prev =>
      prev.map(item => item.itemId === itemId ? { 
        ...item, 
        cantidad: Math.max(1, Math.min(cantidad, item.cantidadSolicitada * 2)) 
      } : item)
    );
  };

  const handlePrecioChange = (itemId: string, precio: number) => {
    setItemsSeleccionados(prev =>
      prev.map(item => item.itemId === itemId ? { 
        ...item, 
        precioUnitario: Math.max(0, precio) 
      } : item)
    );
  };

  const itemsActivos = itemsSeleccionados.filter(item => item.selected);
  const montoTotal = itemsActivos.reduce((sum, item) => 
    sum + ((item.precioUnitario || 0) * item.cantidad), 0);

  const handleGuardarPropuesta = async () => {
    if (!compra) return;

    const propuesta = {
      fecha_generacion: new Date().toISOString(),
      items: itemsActivos.map(item => ({
        item_id: item.itemId,
        nombre_solicitado: item.nombre,
        descripcion_solicitada: item.descripcion,
        cantidad_solicitada: item.cantidadSolicitada,
        unidad_medida: item.unidadMedida,
        match_id: item.match?.id,
        sku_match: item.match?.sku,
        nombre_match: item.match?.nombre,
        cantidad_propuesta: item.cantidad,
        precio_unitario: item.precioUnitario || 0,
        subtotal: (item.precioUnitario || 0) * item.cantidad,
        match_score: item.match?.matchScore
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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
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
            <Label className="text-sm font-medium">Configura los items de la propuesta</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ajusta cantidades y precios según los requerimientos de la licitación
            </p>
          </div>

          <ScrollArea className="h-[400px] pr-4 -mr-4">
            <div className="space-y-4">
              {itemsSeleccionados.map((item) => (
                <div
                  key={item.itemId}
                  className={`border rounded-lg p-4 transition-colors ${
                    item.selected ? 'border-primary/50 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={() => handleToggleItem(item.itemId)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{item.nombre}</h4>
                          {item.descripcion && (
                            <p className="text-xs text-muted-foreground mt-1">{item.descripcion}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs bg-muted px-2 py-1 rounded">
                              Solicitado: {item.cantidadSolicitada} {item.unidadMedida}
                            </span>
                            {item.match && (
                              <Badge variant="secondary" className="text-xs">
                                Match: {item.match.matchScore}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.match && (
                        <div className="mt-3 p-3 bg-muted/30 rounded-md">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs">{item.match.sku}</span>
                                <span className="text-xs font-medium">{item.match.nombre}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-muted-foreground">
                                  Stock: {item.match.stock ?? 'N/A'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Precio base: {formatCurrency(item.match.precio_unitario)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-4 mt-4">
                        <div>
                          <Label className="text-xs">Cantidad a ofertar</Label>
                          <Input
                            type="number"
                            min={1}
                            max={item.cantidadSolicitada * 2}
                            value={item.cantidad}
                            onChange={(e) => handleCantidadChange(item.itemId, parseInt(e.target.value) || 1)}
                            disabled={!item.selected}
                            className="h-8 text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Solicitado: {item.cantidadSolicitada}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs">Precio unitario (CLP)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={item.precioUnitario || ''}
                            onChange={(e) => handlePrecioChange(item.itemId, parseInt(e.target.value) || 0)}
                            disabled={!item.selected}
                            className="h-8 text-sm"
                          />
                          {item.match && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Base: {formatCurrency(item.match.precio_unitario)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Label className="text-xs">Subtotal</Label>
                          <p className="text-sm font-semibold text-primary mt-2">
                            {formatCurrency((item.precioUnitario || 0) * item.cantidad)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.cantidad} × {formatCurrency(item.precioUnitario || 0)}
                          </p>
                        </div>
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
              <span>{itemsActivos.length} items seleccionados</span>
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
              disabled={itemsActivos.length === 0 || updateCompra.isPending}
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