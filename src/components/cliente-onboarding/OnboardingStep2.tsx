import { useState } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useClienteInventario, useAgregarProducto, useActualizarProducto, useEliminarProducto, getClienteId } from '@/hooks/useCliente';

interface ProductoForm {
  sku: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio_unitario: number;
  margen_minimo: number;
  stock: number;
  tiempo_entrega_dias: number;
  palabras_clave: string;
}

const defaultForm: ProductoForm = {
  sku: '',
  nombre: '',
  descripcion: '',
  categoria: '',
  precio_unitario: 0,
  margen_minimo: 10,
  stock: 0,
  tiempo_entrega_dias: 3,
  palabras_clave: '',
};

export default function OnboardingStep2() {
  const clienteId = getClienteId();
  const { data: inventario = [], isLoading } = useClienteInventario();
  const agregarProducto = useAgregarProducto();
  const actualizarProducto = useActualizarProducto();
  const eliminarProducto = useEliminarProducto();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductoForm>(defaultForm);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) return;

    const palabras = form.palabras_clave
      .split(',')
      .map(p => p.trim().toLowerCase())
      .filter(Boolean);

    const data = {
      cliente_id: clienteId,
      sku: form.sku,
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      categoria: form.categoria || undefined,
      precio_unitario: form.precio_unitario,
      margen_minimo: form.margen_minimo,
      stock: form.stock,
      tiempo_entrega_dias: form.tiempo_entrega_dias,
      palabras_clave: palabras.length > 0 ? palabras : undefined,
      activo: true,
    };

    if (editingId) {
      await actualizarProducto.mutateAsync({ id: editingId, ...data });
    } else {
      await agregarProducto.mutateAsync(data);
    }

    setForm(defaultForm);
    setEditingId(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (producto: typeof inventario[0]) => {
    setForm({
      sku: producto.sku,
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      categoria: producto.categoria || '',
      precio_unitario: producto.precio_unitario,
      margen_minimo: producto.margen_minimo,
      stock: producto.stock,
      tiempo_entrega_dias: producto.tiempo_entrega_dias,
      palabras_clave: producto.palabras_clave?.join(', ') || '',
    });
    setEditingId(producto.id);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await eliminarProducto.mutateAsync(id);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setForm(defaultForm);
      setEditingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Carga tu inventario</CardTitle>
            <CardDescription>
              Agrega los productos que ofreces. Mientras más detalles, mejor el matching.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Agregar Producto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input
                      id="sku"
                      value={form.sku}
                      onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                      placeholder="PROD-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoría</Label>
                    <Input
                      id="categoria"
                      value={form.categoria}
                      onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                      placeholder="Oficina"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del producto *</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                    placeholder="Resma papel carta 500 hojas"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={form.descripcion}
                    onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                    placeholder="Papel bond 75g/m², blanco..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="precio">Precio CLP *</Label>
                    <Input
                      id="precio"
                      type="number"
                      value={form.precio_unitario}
                      onChange={e => setForm(p => ({ ...p, precio_unitario: Number(e.target.value) }))}
                      min={0}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="margen">Margen mínimo %</Label>
                    <Input
                      id="margen"
                      type="number"
                      value={form.margen_minimo}
                      onChange={e => setForm(p => ({ ...p, margen_minimo: Number(e.target.value) }))}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock disponible</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={form.stock}
                      onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))}
                      min={0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="entrega">Días entrega</Label>
                    <Input
                      id="entrega"
                      type="number"
                      value={form.tiempo_entrega_dias}
                      onChange={e => setForm(p => ({ ...p, tiempo_entrega_dias: Number(e.target.value) }))}
                      min={1}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="palabras">Palabras clave (separadas por coma)</Label>
                  <Input
                    id="palabras"
                    value={form.palabras_clave}
                    onChange={e => setForm(p => ({ ...p, palabras_clave: e.target.value }))}
                    placeholder="papel, resma, carta, oficina, impresora"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={agregarProducto.isPending || actualizarProducto.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    {editingId ? 'Guardar cambios' : 'Agregar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        ) : inventario.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No hay productos en tu inventario</p>
            <p className="text-sm mt-1">Haz clic en "Agregar Producto" para comenzar</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventario.map((prod) => (
                  <TableRow key={prod.id}>
                    <TableCell className="font-mono text-sm">{prod.sku}</TableCell>
                    <TableCell>{prod.nombre}</TableCell>
                    <TableCell>{prod.categoria || '-'}</TableCell>
                    <TableCell className="text-right">
                      ${prod.precio_unitario.toLocaleString('es-CL')}
                    </TableCell>
                    <TableCell className="text-right">{prod.stock}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(prod)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(prod.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
