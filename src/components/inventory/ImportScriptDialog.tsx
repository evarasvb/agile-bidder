import { useState } from "react";
import { Loader2, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { getClienteId } from "@/hooks/useCliente";
import { toast } from "sonner";

interface ScriptProduct {
  nombre: string;
  descripcion?: string;
  precio_unitario: number;
  unidad_medida?: string;
  categoria?: string;
  stock_disponible?: number;
  imagen_url?: string;
  ficha_tecnica?: string;
}

interface ImportScriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportScriptDialog({ open, onOpenChange, onSuccess }: ImportScriptDialogProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number>(0);

  const handleInputChange = (value: string) => {
    setJsonInput(value);
    setParseError(null);
    
    if (!value.trim()) {
      setPreviewCount(0);
      return;
    }

    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        setParseError("El JSON debe ser un array de productos");
        setPreviewCount(0);
        return;
      }
      setPreviewCount(parsed.length);
    } catch {
      setParseError("JSON inválido. Verifica el formato.");
      setPreviewCount(0);
    }
  };

  const generateSKU = (nombre: string, index: number): string => {
    const prefix = nombre
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "X");
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}-${timestamp}-${String(index + 1).padStart(3, "0")}`;
  };

  const handleImport = async () => {
    const clienteId = getClienteId();
    
    if (!clienteId) {
      toast.error("No hay cliente autenticado. Por favor inicia sesión.");
      return;
    }

    if (!jsonInput.trim()) {
      toast.error("Por favor pega el JSON de productos");
      return;
    }

    let products: ScriptProduct[];
    try {
      products = JSON.parse(jsonInput);
      if (!Array.isArray(products)) {
        toast.error("El JSON debe ser un array de productos");
        return;
      }
    } catch {
      toast.error("JSON inválido. Verifica el formato.");
      return;
    }

    setIsLoading(true);

    try {
      // Obtener productos existentes para validar duplicados
      const { data: existingProducts, error: fetchError } = await supabase
        .from("cliente_inventario")
        .select("nombre")
        .eq("cliente_id", clienteId);

      if (fetchError) throw fetchError;

      const existingNames = new Set(
        existingProducts?.map((p) => p.nombre.toLowerCase()) || []
      );

      // Filtrar productos duplicados
      const newProducts = products.filter(
        (p) => !existingNames.has(p.nombre.toLowerCase())
      );

      const duplicateCount = products.length - newProducts.length;

      if (newProducts.length === 0) {
        toast.warning("Todos los productos ya existen en el inventario");
        setIsLoading(false);
        return;
      }

      // Preparar datos para inserción
      const insertData = newProducts.map((product, index) => ({
        cliente_id: clienteId,
        sku: generateSKU(product.nombre, index),
        nombre: product.nombre,
        descripcion: product.descripcion || null,
        categoria: product.categoria || "General",
        precio_unitario: product.precio_unitario || 0,
        margen_minimo: 10,
        stock: product.stock_disponible || 0,
        tiempo_entrega_dias: 5,
        palabras_clave: product.nombre.toLowerCase().split(" ").filter(w => w.length > 2),
        activo: true,
      }));

      // Batch insert
      const { error: insertError } = await supabase
        .from("cliente_inventario")
        .insert(insertData);

      if (insertError) throw insertError;

      const message = duplicateCount > 0
        ? `${newProducts.length} productos importados (${duplicateCount} duplicados omitidos)`
        : `${newProducts.length} productos importados exitosamente`;

      toast.success(message);
      setJsonInput("");
      setPreviewCount(0);
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error importing products:", error);
      toast.error("Error al importar productos. Revisa la consola para más detalles.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setJsonInput("");
      setParseError(null);
      setPreviewCount(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-primary" />
            Cargar Productos desde Script
          </DialogTitle>
          <DialogDescription>
            Pega el output JSON del Google Apps Script. Se detectarán y omitirán automáticamente los productos duplicados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              JSON de Productos
            </label>
            <Textarea
              placeholder={`[\n  {\n    "nombre": "Producto 1",\n    "descripcion": "Descripción...",\n    "precio_unitario": 10000,\n    "categoria": "Categoría",\n    "stock_disponible": 100\n  }\n]`}
              value={jsonInput}
              onChange={(e) => handleInputChange(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              disabled={isLoading}
            />
          </div>

          {parseError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          )}

          {previewCount > 0 && !parseError && (
            <Alert className="bg-success/10 border-success/30">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                {previewCount} productos detectados y listos para importar
              </AlertDescription>
            </Alert>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Campos esperados:</strong></p>
            <p>nombre (requerido), descripcion, precio_unitario, unidad_medida, categoria, stock_disponible, imagen_url, ficha_tecnica</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={isLoading || previewCount === 0 || !!parseError}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <FileJson className="h-4 w-4" />
                Importar {previewCount > 0 ? `(${previewCount})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
