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
  RefreshCw,
  Building2,
  Percent,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { useListaPreciosFirmaVB, useListaPreciosStats, useListaPreciosFilterOptions } from "@/hooks/useListaPreciosFirmaVB";

export default function MiInventario() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState<string>("all");
  
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    // Reset to page 1 on search
    setPage(1);
    // Debounce the actual search
    setTimeout(() => setDebouncedSearch(value), 300);
  };

  const { data, isLoading, refetch, isFetching, isError, error } = useListaPreciosFirmaVB({
    search: debouncedSearch,
    categoria: categoriaFilter !== "all" ? categoriaFilter : undefined,
    page,
    pageSize,
  });

  const { data: stats, isLoading: statsLoading } = useListaPreciosStats();
  const { data: filterOptions } = useListaPreciosFilterOptions();

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const categorias = filterOptions?.categorias || [];

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return "-";
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(numValue);
  };

  const handleFilterChange = (value: string) => {
    setCategoriaFilter(value);
    setPage(1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Debug Banner */}
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded">
        <h3 className="font-bold mb-2">🔧 Debug Info - useListaPreciosFirmaVB</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div><strong>isLoading:</strong> {isLoading ? '✅ Yes' : '❌ No'}</div>
          <div><strong>isFetching:</strong> {isFetching ? '✅ Yes' : '❌ No'}</div>
          <div><strong>isError:</strong> {isError ? '🔴 Yes' : '🟢 No'}</div>
          <div><strong>Total Items:</strong> {total}</div>
        </div>
        {isError && (
          <div className="mt-2 bg-red-100 border border-red-400 text-red-700 p-2 rounded">
            <strong>Error:</strong> {error?.message || JSON.stringify(error)}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-600">
          <strong>Data items length:</strong> {items.length} | <strong>Page:</strong> {page} | <strong>TotalPages:</strong> {totalPages}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lista de Precios FirmaVB</h1>
          <p className="text-muted-foreground">
            Catálogo de productos disponibles para ofertar en licitaciones
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
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
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{(stats?.totalProductos || 0).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorías</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalCategorias || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proveedores</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalProveedores || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Catálogo</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats?.valorCatalogoTotal || 0)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Productos</CardTitle>
              <CardDescription>
                Mostrando {items.length} de {total.toLocaleString()} productos
              </CardDescription>
            </div>
            {isFetching && !isLoading && (
              <Badge variant="secondary" className="animate-pulse">
                Cargando...
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, descripción o proveedor..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoriaFilter} onValueChange={handleFilterChange}>
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
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Costo</TableHead>
                      <TableHead className="text-center">Margen</TableHead>
                      <TableHead className="text-right">Precio Venta</TableHead>
                      <TableHead className="text-center">Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron productos
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-xs">
                            {item.codigo || "-"}
                          </TableCell>
                          <TableCell className="font-medium max-w-[300px]" title={item.descripcion || ""}>
                            <div className="truncate">{item.descripcion || "-"}</div>
                          </TableCell>
                          <TableCell>
                            {item.categoria ? (
                              <Badge variant="outline">{item.categoria}</Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.costo)}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.margen_comercial ? (
                              <Badge variant="secondary" className="gap-1">
                                <Percent className="h-3 w-3" />
                                {item.margen_comercial}%
                              </Badge>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatCurrency(item.precio_venta_neto)}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {item.unidad || "UN"}
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
                    Página {page} de {totalPages.toLocaleString()} ({total.toLocaleString()} productos totales)
                  </p>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(1)}
                      disabled={page === 1 || isFetching}
                      title="Primera página"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1 || isFetching}
                      title="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm font-medium">
                      {page}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages || isFetching}
                      title="Página siguiente"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages || isFetching}
                      title="Última página"
                    >
                      <ChevronsRight className="h-4 w-4" />
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
