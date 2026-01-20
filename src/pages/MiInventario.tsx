import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, 
  Package, 
  Layers,
  DollarSign,
  CheckCircle,
  RefreshCw
} from "lucide-react";
import { useClienteInventario } from "@/hooks/useClienteInventario";

export default function MiInventario() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { items, categorias, stats, isLoading, refetch } = useClienteInventario({
    search: searchTerm,
    categoria: categoriaFilter !== "all" ? categoriaFilter : undefined,
  });

  // Pagination
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mi Inventario</h1>
          <p className="text-muted-foreground">
            Catálogo de productos disponibles para ofertar
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalProductos.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats.totalCategorias}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.valorInventario)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{stats.productosActivos.toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Productos</CardTitle>
          <CardDescription>
            {items.length.toLocaleString()} productos encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nombre o descripción..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select value={categoriaFilter} onValueChange={(v) => { setCategoriaFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">SKU</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron productos
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.sku}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={item.nombre}>
                            {item.nombre}
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate text-muted-foreground" title={item.descripcion || ""}>
                            {item.descripcion || "-"}
                          </TableCell>
                          <TableCell>
                            {item.categoria ? (
                              <Badge variant="outline">{item.categoria}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.precio_unitario)}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.stock !== null ? item.stock.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.activo !== false ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Activo</Badge>
                            ) : (
                              <Badge variant="secondary">Inactivo</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((page - 1) * pageSize + 1).toLocaleString()} - {Math.min(page * pageSize, items.length).toLocaleString()} de {items.length.toLocaleString()}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
