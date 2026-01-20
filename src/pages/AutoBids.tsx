import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Zap, Plus, Trash2, Edit, TrendingUp, DollarSign, Target, Activity } from 'lucide-react';
import { useAutoBidDashboard, useAutoBidItems, useToggleAutoBid, useCreateAutoBidItem, useDeleteAutoBidItem, useAutoBidStats } from '@/hooks/useAutoBids';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export default function AutoBids() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    nombre_producto: '',
    precio_minimo: '',
    precio_maximo: '',
    margen_objetivo: '15',
  });

  const { data: dashboard, isLoading: loadingDashboard } = useAutoBidDashboard();
  const { data: items, isLoading: loadingItems } = useAutoBidItems();
  const { data: stats } = useAutoBidStats();
  const toggleAutoBid = useToggleAutoBid();
  const createItem = useCreateAutoBidItem();
  const deleteItem = useDeleteAutoBidItem();

  const formatMonto = (monto: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(monto);
  };

  const handleToggle = async (activo: boolean) => {
    try {
      await toggleAutoBid.mutateAsync(activo);
      toast.success(activo ? 'Auto-Bid activado' : 'Auto-Bid desactivado');
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const handleAddItem = async () => {
    if (!newItem.nombre_producto) {
      toast.error('Ingresa el nombre del producto');
      return;
    }

    try {
      await createItem.mutateAsync({
        nombre_producto: newItem.nombre_producto,
        precio_minimo: newItem.precio_minimo ? parseFloat(newItem.precio_minimo) : undefined,
        precio_maximo: newItem.precio_maximo ? parseFloat(newItem.precio_maximo) : undefined,
        margen_objetivo: parseFloat(newItem.margen_objetivo) || 15,
      });
      toast.success('Producto agregado');
      setIsAddDialogOpen(false);
      setNewItem({ nombre_producto: '', precio_minimo: '', precio_maximo: '', margen_objetivo: '15' });
    } catch (error) {
      toast.error('Error al agregar producto');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error('Error al eliminar producto');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-500" />
              Auto-Bids
            </h1>
            <p className="text-muted-foreground">
              Sistema automático de ofertas para licitaciones
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch 
                checked={dashboard?.activo || false}
                onCheckedChange={handleToggle}
                disabled={toggleAutoBid.isPending}
              />
              <Label>
                {dashboard?.activo ? (
                  <Badge className="bg-green-500">Activo</Badge>
                ) : (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </Label>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bids Enviados</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingDashboard ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalBids || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bids Ganados</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loadingDashboard ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-green-600">{stats?.ganados || 0}</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingDashboard ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.tasaExito?.toFixed(1) || 0}%</div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monto Ganado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingDashboard ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{formatMonto(stats?.montoGanado || 0)}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Productos Configurados</CardTitle>
              <CardDescription>
                Productos para los cuales se generarán ofertas automáticas
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Agregar Producto para Auto-Bid</DialogTitle>
                  <DialogDescription>
                    Configura un producto para ofertas automáticas
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nombre del Producto</Label>
                    <Input
                      value={newItem.nombre_producto}
                      onChange={(e) => setNewItem({ ...newItem, nombre_producto: e.target.value })}
                      placeholder="Ej: Resma de papel A4"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Precio Mínimo</Label>
                      <Input
                        type="number"
                        value={newItem.precio_minimo}
                        onChange={(e) => setNewItem({ ...newItem, precio_minimo: e.target.value })}
                        placeholder="1000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Precio Máximo</Label>
                      <Input
                        type="number"
                        value={newItem.precio_maximo}
                        onChange={(e) => setNewItem({ ...newItem, precio_maximo: e.target.value })}
                        placeholder="5000"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Margen Objetivo (%)</Label>
                    <Input
                      type="number"
                      value={newItem.margen_objetivo}
                      onChange={(e) => setNewItem({ ...newItem, margen_objetivo: e.target.value })}
                      placeholder="15"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddItem} disabled={createItem.isPending}>
                    Agregar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {loadingItems ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Precio Mín</TableHead>
                    <TableHead>Precio Máx</TableHead>
                    <TableHead>Margen</TableHead>
                    <TableHead>Bids</TableHead>
                    <TableHead>Ganados</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nombre_producto}</TableCell>
                      <TableCell>{item.precio_minimo ? formatMonto(item.precio_minimo) : '-'}</TableCell>
                      <TableCell>{item.precio_maximo ? formatMonto(item.precio_maximo) : '-'}</TableCell>
                      <TableCell>{item.margen_objetivo}%</TableCell>
                      <TableCell>{item.total_bids}</TableCell>
                      <TableCell className="text-green-600">{item.bids_ganados}</TableCell>
                      <TableCell>
                        <Badge variant={item.activo ? 'default' : 'secondary'}>
                          {item.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!items?.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No hay productos configurados. Agrega uno para comenzar.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
