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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Images, Package, Calculator } from "lucide-react";
import { InventoryItem, calcularMargenComercial } from "@/hooks/useInventory";
import { Badge } from "@/components/ui/badge";
import { ImageDropzone, ImagePreview } from "./ImageDropzone";
import { useProductImages, useUploadProductImage, useDeleteProductImage, useSetPrincipalImage } from "@/hooks/useProductImages";
import { useAuthUser } from "@/hooks/useCliente";

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
  const { user } = useAuthUser();
  const [activeTab, setActiveTab] = useState("info");
  const [formData, setFormData] = useState({
    sku: "",
    nombre_producto: "",
    descripcion: "",
    categoria: "",
    costo_neto: 0, // NUEVO
    precio_unitario: 0,
    margen_minimo: 10,
    stock_disponible: 0,
    tiempo_entrega_dias: 5,
    keywords: "",
    activo: true,
  });

  // Image management
  const { data: images = [], isLoading: imagesLoading } = useProductImages(
    product?.id || null, 
    'inventory'
  );
  const uploadImage = useUploadProductImage();
  const deleteImage = useDeleteProductImage();
  const setPrincipal = useSetPrincipalImage();

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

    // Calcular margen comercial automáticamente
    const margenComercial = calcularMargenComercial(formData.precio_unitario, formData.costo_neto);
    
    await onSave({
      id: product.id,
      sku: formData.sku,
      nombre_producto: formData.nombre_producto,
      descripcion: formData.descripcion || null,
      categoria: formData.categoria,
      costo_neto: formData.costo_neto, // NUEVO
      precio_unitario: formData.precio_unitario,
      margen_comercial: margenComercial, // Calculado automáticamente
      margen_minimo: formData.margen_minimo,
      stock_disponible: formData.stock_disponible,
      tiempo_entrega_dias: formData.tiempo_entrega_dias,
      keywords: formData.keywords
        ? formData.keywords.split(",").map((k) => k.trim()).filter(Boolean)
        : [],
      activo: formData.activo,
    });
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!product || !user) return;
    
    for (const file of files) {
      await uploadImage.mutateAsync({
        productId: product.id,
        productType: 'inventory',
        file,
        userId: user.id,
        esPrincipal: images.length === 0
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Producto</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info" className="gap-2">
              <Package className="h-4 w-4" />
              Información
            </TabsTrigger>
            <TabsTrigger value="images" className="gap-2">
              <Images className="h-4 w-4" />
              Imágenes ({images.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="info" className="flex-1 overflow-auto mt-4">
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
                  <Label htmlFor="costo">Costo Neto (CLP) *</Label>
                  <Input
                    id="costo"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.costo_neto}
                    onChange={(e) => setFormData({ ...formData, costo_neto: Number(e.target.value) })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Costo de adquisición
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio">Precio de Venta (CLP) *</Label>
                  <Input
                    id="precio"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.precio_unitario}
                    onChange={(e) => setFormData({ ...formData, precio_unitario: Number(e.target.value) })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Precio de venta al cliente
                  </p>
                </div>
              </div>

              {/* Margen Comercial Calculado */}
              {formData.costo_neto > 0 && formData.precio_unitario > formData.costo_neto && (
                <div className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Margen Comercial Calculado</Label>
                    </div>
                    <Badge variant="default" className="text-sm font-semibold">
                      {calcularMargenComercial(formData.precio_unitario, formData.costo_neto)?.toFixed(2) || '0.00'}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fórmula: (Precio - Costo) / Precio × 100
                  </p>
                </div>
              )}

              {formData.costo_neto > 0 && formData.precio_unitario > 0 && formData.costo_neto >= formData.precio_unitario && (
                <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ El Precio de Venta debe ser mayor que el Costo Neto
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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
          </TabsContent>
          
          <TabsContent value="images" className="flex-1 flex flex-col gap-4 mt-4 overflow-hidden">
            {/* Upload Area */}
            <ImageDropzone 
              onFilesSelected={handleFilesSelected}
              isUploading={uploadImage.isPending}
              multiple
            />
            
            {/* Images Grid */}
            {imagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Images className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay imágenes</p>
                <p className="text-sm">Arrastra imágenes o haz clic para subir</p>
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-4 gap-3 p-1">
                  {images.map((image) => (
                    <ImagePreview
                      key={image.id}
                      src={image.image_url}
                      isPrincipal={image.es_principal}
                      onRemove={() => deleteImage.mutate(image)}
                      onSetPrincipal={() => setPrincipal.mutate(image)}
                      isLoading={deleteImage.isPending || setPrincipal.isPending}
                      size="lg"
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
            
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {images.length} imagen{images.length !== 1 ? 'es' : ''}
              </span>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
