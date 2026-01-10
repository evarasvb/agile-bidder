import { useState } from "react";
import { Plus, Upload, Search, MoreHorizontal, Edit2, Trash2, Package, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTodoElInventario } from "@/hooks/useCliente";

export default function Inventory() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: inventario = [], isLoading, refetch } = useTodoElInventario();

  const handleRefresh = () => {
    toast.info('Actualizando inventario...');
    refetch();
  };

  const filteredInventory = inventario.filter(
    (item) =>
      item.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (stock: number, activo: boolean | null) => {
    if (!activo) {
      return <Badge className="bg-muted text-muted-foreground border-0">Inactivo</Badge>;
    }
    if (stock === 0) {
      return <Badge className="bg-destructive/10 text-destructive border-0">Sin Stock</Badge>;
    }
    if (stock < 50) {
      return <Badge className="bg-warning/10 text-warning border-0">Stock Bajo</Badge>;
    }
    return <Badge className="bg-success/10 text-success border-0">Activo</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus productos y reglas de matching
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar CSV
          </Button>
          <Button className="gap-2 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>{filteredInventory.length} productos</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay productos en el inventario</p>
            <p className="text-sm">Agrega productos para comenzar el matching con licitaciones</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Producto</TableHead>
                <TableHead className="font-semibold">Categoría</TableHead>
                <TableHead className="font-semibold">Keywords</TableHead>
                <TableHead className="font-semibold text-right">Precio</TableHead>
                <TableHead className="font-semibold text-right">Margen Mín.</TableHead>
                <TableHead className="font-semibold text-right">Stock</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInventory.map((item) => (
                <TableRow key={item.id} className="data-row">
                  <TableCell className="font-mono text-sm font-medium">
                    {item.sku}
                  </TableCell>
                  <TableCell className="font-medium">{item.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.categoria || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {item.palabras_clave?.slice(0, 3).map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {keyword}
                        </span>
                      ))}
                      {item.palabras_clave && item.palabras_clave.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{item.palabras_clave.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${item.precio_unitario.toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.margen_minimo || 10}%
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    item.stock === 0 && "text-destructive",
                    item.stock && item.stock > 0 && item.stock < 50 && "text-warning"
                  )}>
                    {(item.stock || 0).toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.stock || 0, item.activo)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="gap-2">
                          <Edit2 className="h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive">
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
