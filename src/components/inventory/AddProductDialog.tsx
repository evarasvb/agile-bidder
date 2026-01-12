import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { InventoryInput } from '@/hooks/useInventory';

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: InventoryInput) => Promise<void>;
  isLoading: boolean;
}

const CATEGORIES = [
  'Oficina',
  'Tecnología',
  'Mobiliario',
  'Aseo',
  'Médico',
  'Construcción',
  'Alimentos',
  'Seguridad',
  'Herramientas',
  'Otro',
];

const UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'caja', label: 'Caja' },
  { value: 'pack', label: 'Pack' },
  { value: 'kit', label: 'Kit' },
  { value: 'resma', label: 'Resma' },
  { value: 'saco', label: 'Saco' },
  { value: 'litro', label: 'Litro' },
  { value: 'kg', label: 'Kilogramo' },
];

export function AddProductDialog({
  open,
  onOpenChange,
  onSave,
  isLoading,
}: AddProductDialogProps) {
  const [formData, setFormData] = useState<InventoryInput>({
    sku: '',
    nombre_producto: '',
    descripcion: '',
    categoria: '',
    keywords: [],
    precio_unitario: 0,
    margen_minimo: 15,
    margen_objetivo: 30,
    stock_disponible: 0,
    unidad_medida: 'unidad',
    tiempo_entrega_dias: 3,
    proveedor: '',
    activo: true,
  });

  const [keywordsInput, setKeywordsInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const keywords = keywordsInput
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    await onSave({
      ...formData,
      keywords,
    });

    // Reset form
    setFormData({
      sku: '',
      nombre_producto: '',
      descripcion: '',
      categoria: '',
      keywords: [],
      precio_unitario: 0,
      margen_minimo: 15,
      margen_objetivo: 30,
      stock_disponible: 0,
      unidad_medida: 'unidad',
      tiempo_entrega_dias: 3,
      proveedor: '',
      activo: true,
    });
    setKeywordsInput('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Producto</DialogTitle>
          <DialogDescription>
            Ingresa los datos del producto para agregarlo al inventario.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* SKU */}
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                placeholder="OFF-001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                required
              />
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría *</Label>
              <Select
                value={formData.categoria}
                onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nombre del Producto */}
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del Producto *</Label>
            <Input
              id="nombre"
              placeholder="Resma Papel Carta"
              value={formData.nombre_producto}
              onChange={(e) => setFormData({ ...formData, nombre_producto: e.target.value })}
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción detallada del producto..."
              value={formData.descripcion || ''}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              rows={2}
            />
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Palabras Clave (separadas por coma)</Label>
            <Input
              id="keywords"
              placeholder="papel, resma, carta, bond, oficina"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usadas para el matching automático con licitaciones
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Precio Unitario */}
            <div className="space-y-2">
              <Label htmlFor="precio">Precio Unitario (CLP) *</Label>
              <Input
                id="precio"
                type="number"
                min="0"
                placeholder="3500"
                value={formData.precio_unitario || ''}
                onChange={(e) =>
                  setFormData({ ...formData, precio_unitario: Number(e.target.value) })
                }
                required
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Disponible *</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                placeholder="100"
                value={formData.stock_disponible || ''}
                onChange={(e) =>
                  setFormData({ ...formData, stock_disponible: Number(e.target.value) })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Margen Mínimo */}
            <div className="space-y-2">
              <Label htmlFor="margen-min">Margen Mínimo %</Label>
              <Input
                id="margen-min"
                type="number"
                min="0"
                max="100"
                placeholder="15"
                value={formData.margen_minimo || ''}
                onChange={(e) =>
                  setFormData({ ...formData, margen_minimo: Number(e.target.value) })
                }
              />
            </div>

            {/* Margen Objetivo */}
            <div className="space-y-2">
              <Label htmlFor="margen-obj">Margen Objetivo %</Label>
              <Input
                id="margen-obj"
                type="number"
                min="0"
                max="100"
                placeholder="30"
                value={formData.margen_objetivo || ''}
                onChange={(e) =>
                  setFormData({ ...formData, margen_objetivo: Number(e.target.value) })
                }
              />
            </div>

            {/* Tiempo de Entrega */}
            <div className="space-y-2">
              <Label htmlFor="tiempo">Días Entrega</Label>
              <Input
                id="tiempo"
                type="number"
                min="1"
                placeholder="3"
                value={formData.tiempo_entrega_dias || ''}
                onChange={(e) =>
                  setFormData({ ...formData, tiempo_entrega_dias: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Unidad de Medida */}
            <div className="space-y-2">
              <Label htmlFor="unidad">Unidad de Medida</Label>
              <Select
                value={formData.unidad_medida}
                onValueChange={(value) => setFormData({ ...formData, unidad_medida: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Proveedor */}
            <div className="space-y-2">
              <Label htmlFor="proveedor">Proveedor</Label>
              <Input
                id="proveedor"
                placeholder="Nombre del proveedor"
                value={formData.proveedor || ''}
                onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
              />
            </div>
          </div>

          {/* Activo */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Producto Activo</p>
              <p className="text-xs text-muted-foreground">
                Solo productos activos participan en el matching
              </p>
            </div>
            <Switch
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
              Agregar Producto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
