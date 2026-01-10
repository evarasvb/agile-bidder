import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { InventoryItem } from "@/hooks/useInventory";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: InventoryItem | null;
  onSave: (data: Partial<InventoryItem> & { id: string }) => Promise<void>;
  isLoading?: boolean;
}

export function EditProductDialog({
  open,
  onOpenChange,
  product,
  onSave,
  isLoading,
}: EditProductDialogProps) {
  const [formData, setFormData] = useState({
    sku: "",
    nombre_producto: "",
    descripcion: "",
    categoria: "",
    precio_unitario: 0,
    margen_minimo: 10,
    stock_disponible: 0,
    tiempo_entrega_dias: 5,
    keywords: "",
    activo: true,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        sku: product.sku || "",
        nombre_producto: product.nombre_producto || "",
        descripcion: product.descripcion || "",
        categoria: product.categoria || "",
        precio_unitario: product.precio_unitario || 0,
        margen_minimo: product.margen_minimo || 10,
        stock_disponible: product.stock_disponible || 0,
        tiempo_entrega_dias: product.tiempo_entrega_dias || 5,
        keywords: product.keywords?.join(", ") || "",
        activo: product.activo ?? true,
      });
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    await onSave({
      id: product.id,
      sku: formData.sku,
      nombre_producto: formData.nombre_producto,
      descripcion: formData.descripcion || null,
      categoria: formData.categoria,
      precio_unitario: formData.precio_unitario,
      margen_minimo: formData.margen_minimo,
      stock_disponible: formData.stock_disponible,
      tiempo_entrega_dias: formData.tiempo_entrega_dias,
      keywords: formData.keywords
        ? formData.keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [],
      activo: formData.activo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Input
                id="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del Producto</Label>
            <Input
              id="nombre"
              value={formData.nombre_producto}
              onChange={(e) => setFormData({ ...formData, nombre_producto: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="precio">Precio Unitario ($)</Label>
              <Input
                id="precio"
                type="number"
                min="0"
                value={formData.precio_unitario}
                onChange={(e) => setFormData({ ...formData, precio_unitario: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margen">Margen Mínimo (%)</Label>
              <Input
                id="margen"
                type="number"
                min="0"
                max="100"
                value={formData.margen_minimo}
                onChange={(e) => setFormData({ ...formData, margen_minimo: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Disponible</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock_disponible}
                onChange={(e) => setFormData({ ...formData, stock_disponible: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tiempo">Tiempo Entrega (días)</Label>
              <Input
                id="tiempo"
                type="number"
                min="1"
                value={formData.tiempo_entrega_dias}
                onChange={(e) => setFormData({ ...formData, tiempo_entrega_dias: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keywords">Palabras Clave (separadas por coma)</Label>
            <Input
              id="keywords"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              placeholder="papel, oficina, resma"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="activo" className="font-medium">Producto Activo</Label>
              <p className="text-sm text-muted-foreground">
                Los productos inactivos no participan en el matching
              </p>
            </div>
            <Switch
              id="activo"
              checked={formData.activo}
              onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
