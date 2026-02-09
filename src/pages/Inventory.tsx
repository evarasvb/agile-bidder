// @ts-nocheck
import { useState } from "react";
import { Plus, Upload, Search, MoreHorizontal, Edit2, Trash2, Package, Inbox, Loader2, RefreshCw, FileJson, Download, Trash, Image, FileText, CheckSquare, Square, FileSpreadsheet, Images, HelpCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useInventory, useUpdateInventoryItem, useDeleteInventoryItem, useCreateInventoryItem, InventoryItem, InventoryInput } from "@/hooks/useInventory";
import { useLicitacionesPorProducto } from "@/hooks/useLicitacionesPorProducto";
import { useComprasAgilesMatch } from "@/hooks/useComprasAgilesMatch";
import { EditProductDialog } from "@/components/inventory/EditProductDialog";
import { DeleteProductDialog } from "@/components/inventory/DeleteProductDialog";
import { ImportScriptDialog } from "@/components/inventory/ImportScriptDialog";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { BulkDeleteDialog } from "@/components/inventory/BulkDeleteDialog";
import { BulkUploadDialog } from "@/components/inventory/BulkUploadDialog";
import { DownloadTemplateButton } from "@/components/inventory/DownloadTemplateButton";
import { ProductGallery } from "@/components/inventory/ProductGallery";
import { ImportHistoryPanel } from "@/components/inventory/ImportHistoryPanel";
import { OportunidadesModal } from "@/components/inventory/OportunidadesModal";
import { useAuthUser } from "@/hooks/useCliente";
import { Link } from "react-router-dom";
import { Gavel } from "lucide-react";
import * as XLSX from 'xlsx';

export default function Inventory() {
  const { user } = useAuthUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<InventoryItem | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [galleryProduct, setGalleryProduct] = useState<InventoryItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nombre: string } | null>(null);
  const [oportunidadesProducto, setOportunidadesProducto] = useState<InventoryItem | null>(null);
  
  // Pagination state for UI performance
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // Show 100 products per page to prevent performance issues
  
  const { data: inventario = [], isLoading, refetch } = useInventory();
  const { data: licitacionesPorProducto = [] } = useLicitacionesPorProducto();
  const { matchesByProductId, countsByProductId, isLoading: isLoadingComprasAgiles } = useComprasAgilesMatch(inventario);
  const actualizarProducto = useUpdateInventoryItem();
  const eliminarProducto = useDeleteInventoryItem();
  const crearProducto = useCreateInventoryItem();
  
  // Crear mapa de licitaciones por producto_id para acceso rápido
  const licitacionesMap = new Map(
    licitacionesPorProducto.map(lpp => [lpp.producto_id, lpp])
  );

  const oportunidadesSeleccionadas = oportunidadesProducto
    ? matchesByProductId[oportunidadesProducto.id] ?? []
    : [];

  const handleRefresh = () => {
    toast.info('Actualizando inventario...');
    refetch();
  };

  const handleEdit = async (data: Partial<InventoryItem> & { id: string }) => {
    await actualizarProducto.mutateAsync(data);
    setEditingProduct(null);
    toast.success('Producto actualizado correctamente');
    refetch();
  };

  const handleAddProduct = async (data: InventoryInput) => {
    await crearProducto.mutateAsync(data);
    setAddDialogOpen(false);
    toast.success('Producto agregado correctamente');
    refetch();
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    await eliminarProducto.mutateAsync(deletingProduct.id);
    setDeletingProduct(null);
    refetch();
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      await eliminarProducto.mutateAsync(id);
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    toast.success(`${idsToDelete.length} productos eliminados`);
    refetch();
  };

  const filteredInventory = inventario.filter(
    (item) =>
      item.nombre_producto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.proveedor && item.proveedor.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  // Calculate paginated data
  const totalPages = Math.ceil(filteredInventory.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInventory = filteredInventory.slice(startIndex, startIndex + pageSize);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInventory.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInventory.map(item => item.id)));
    }
  };

  const getExportData = () => {
    return inventario.map(item => ({
      'SKU': item.sku,
      'Producto': item.nombre_producto,
      'Descripción': item.descripcion || '',
      'Categoría': item.categoria,
      'Proveedor': item.proveedor || '',
      'Precio Unitario': item.precio_unitario,
      'Margen Mínimo (%)': item.margen_minimo,
      'Margen Objetivo (%)': item.margen_objetivo,
      'Stock': item.stock_disponible,
      'Unidad': item.unidad_medida,
      'Tiempo Entrega (días)': item.tiempo_entrega_dias,
      'Keywords': item.keywords?.join(', ') || '',
      'Activo': item.activo ? 'Sí' : 'No',
      'URL Imagen': item.imagen_url || ''
    }));
  };

  const handleExportExcel = () => {
    if (inventario.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    const exportData = getExportData();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // SKU
      { wch: 30 }, // Producto
      { wch: 40 }, // Descripción
      { wch: 15 }, // Categoría
      { wch: 20 }, // Proveedor
      { wch: 12 }, // Precio
      { wch: 12 }, // Margen Min
      { wch: 12 }, // Margen Obj
      { wch: 10 }, // Stock
      { wch: 10 }, // Unidad
      { wch: 15 }, // Tiempo
      { wch: 30 }, // Keywords
      { wch: 8 },  // Activo
      { wch: 50 }, // URL Imagen
    ];

    XLSX.writeFile(wb, `inventario_firmavb_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Inventario exportado a Excel');
  };

  const handleExportCSV = () => {
    if (inventario.length === 0) {
      toast.error('No hay productos para exportar');
      return;
    }

    const exportData = getExportData();
    const headers = Object.keys(exportData[0]);
    
    // Escape CSV values properly
    const escapeCSV = (value: any): string => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...exportData.map(row => headers.map(h => escapeCSV(row[h as keyof typeof row])).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventario_firmavb_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Inventario exportado a CSV');
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        let importedCount = 0;
        for (const row of jsonData as any[]) {
          const productData: InventoryInput = {
            sku: row['SKU'] || `SKU-${Date.now()}`,
            nombre_producto: row['Producto'] || row['Nombre'] || 'Sin nombre',
            descripcion: row['Descripción'] || row['Descripcion'] || '',
            categoria: row['Categoría'] || row['Categoria'] || 'General',
            proveedor: row['Proveedor'] || '',
            precio_unitario: Number(row['Precio Unitario'] || row['Precio'] || 0),
            margen_minimo: Number(row['Margen Mínimo (%)'] || row['Margen'] || 10),
            margen_objetivo: Number(row['Margen Objetivo (%)'] || 15),
            stock_disponible: Number(row['Stock'] || 0),
            unidad_medida: row['Unidad'] || 'unidad',
            tiempo_entrega_dias: Number(row['Tiempo Entrega (días)'] || row['Tiempo Entrega'] || 5),
            keywords: row['Keywords'] ? String(row['Keywords']).split(',').map(k => k.trim()) : [],
            activo: row['Activo'] === 'Sí' || row['Activo'] === 'Si' || row['Activo'] === true
          };

          await crearProducto.mutateAsync(productData);
          importedCount++;
        }

        toast.success(`${importedCount} productos importados correctamente`);
        refetch();
      } catch (error) {
        console.error('Error importing Excel:', error);
        toast.error('Error al importar el archivo Excel');
      }
    };
    reader.readAsArrayBuffer(file);
    
    // Reset input
    event.target.value = '';
  };

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

  const totalProducts = inventario.length;
  const activeProducts = inventario.filter(p => p.activo).length;
  const lowStockProducts = inventario.filter(p => p.stock_disponible > 0 && p.stock_disponible < 50).length;
  const outOfStockProducts = inventario.filter(p => p.stock_disponible === 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-firmavb-blue to-firmavb-red bg-clip-text text-transparent">
            Lista de Precios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tu catálogo de productos para matching automático con oportunidades
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          {/* Import/Export agrupados */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                Importar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover w-56">
              <DropdownMenuItem onClick={() => setBulkUploadOpen(true)} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Desde Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportDialogOpen(true)} className="gap-2 cursor-pointer">
                <FileJson className="h-4 w-4" />
                Desde Script (JSON)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover w-56">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DownloadTemplateButton />

          <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar Producto
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
              <p className="text-sm text-muted-foreground">Total Productos</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckSquare className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{activeProducts}</p>
              <p className="text-sm text-muted-foreground">Activos</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Package className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{lowStockProducts}</p>
              <p className="text-sm text-muted-foreground">Stock Bajo</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Inbox className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{outOfStockProducts}</p>
              <p className="text-sm text-muted-foreground">Sin Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Import History Panel */}
      <ImportHistoryPanel />

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, SKU o proveedor..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>
            Mostrando {startIndex + 1}-{Math.min(startIndex + pageSize, filteredInventory.length)} de {filteredInventory.length} productos
            {filteredInventory.length !== totalProducts && ` (${totalProducts} total)`}
          </span>
        </div>
        
        {selectedIds.size > 0 && (
          <Button 
            variant="destructive" 
            size="sm"
            className="gap-2"
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash className="h-4 w-4" />
            Eliminar ({selectedIds.size})
          </Button>
        )}
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
            <p className="text-lg font-medium">No hay productos en tu lista de precios</p>
            <p className="text-sm">Carga tu lista Excel o agrega productos manualmente para activar el matching</p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => setBulkUploadOpen(true)} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Cargar Excel
              </Button>
              <Button variant="outline" onClick={() => setAddDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar Manual
              </Button>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedIds.size === filteredInventory.length && filteredInventory.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="font-semibold w-[50px]"></TableHead>
                <TableHead className="font-semibold w-[100px]">SKU</TableHead>
                <TableHead className="font-semibold min-w-[200px]">Producto</TableHead>
                <TableHead className="font-semibold">Categoría</TableHead>
                <TableHead className="font-semibold text-right w-[110px]">Precio Unit.</TableHead>
                <TableHead className="font-semibold text-right w-[80px]">Margen</TableHead>
                <TableHead className="font-semibold text-right w-[80px]">Stock</TableHead>
                <TableHead className="font-semibold text-center w-[110px]">Oportunidades</TableHead>
                <TableHead className="font-semibold w-[90px]">Estado</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInventory.map((item) => {
                const oportunidadesCount = countsByProductId[item.id] ?? 0;

                return (
                <TableRow key={item.id} className="group hover:bg-muted/30">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <button 
                      onClick={() => setGalleryProduct(item)}
                      className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden relative group/img hover:ring-2 hover:ring-primary/50 transition-all"
                    >
                      {item.imagen_url ? (
                        <img 
                          src={item.imagen_url} 
                          alt={item.nombre_producto}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <Package className={cn("h-4 w-4 text-muted-foreground", item.imagen_url && "hidden")} />
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium text-primary">
                    {item.sku}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{item.nombre_producto}</p>
                      {item.descripcion && (
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {item.descripcion}
                        </p>
                      )}
                      {item.proveedor && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Proveedor: {item.proveedor}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.categoria || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-medium">
                    ${item.precio_unitario.toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {item.margen_minimo || 10}%
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono text-sm font-medium",
                    item.stock_disponible === 0 && "text-destructive",
                    item.stock_disponible > 0 && item.stock_disponible < 50 && "text-warning"
                  )}>
                    {(item.stock_disponible || 0).toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      type="button"
                      onClick={() => setOportunidadesProducto(item)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs font-medium"
                      aria-label={`Ver oportunidades de ${item.nombre_producto}`}
                    >
                      {isLoadingComprasAgiles ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : oportunidadesCount > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-firmavb-blue/10 text-firmavb-blue px-2 py-0.5 rounded-md hover:bg-firmavb-blue/20">
                          <Gavel className="h-3 w-3" />
                          {oportunidadesCount} match
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.stock_disponible || 0, item.activo)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem 
                          className="gap-2 cursor-pointer"
                          onClick={() => setEditingProduct(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => setGalleryProduct(item)}
                        >
                          <Image className="h-4 w-4" />
                          Imágenes
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-destructive cursor-pointer"
                          onClick={() => setConfirmDelete({ id: item.id, nombre: item.nombre_producto })}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Edit Dialog */}
      <EditProductDialog
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        product={editingProduct}
        onSave={handleEdit}
        isLoading={actualizarProducto.isPending}
      />

      {/* Delete Dialog */}
      <DeleteProductDialog
        open={!!deletingProduct}
        onOpenChange={(open) => !open && setDeletingProduct(null)}
        product={deletingProduct}
        onConfirm={handleDelete}
        isLoading={eliminarProducto.isPending}
      />

      {/* Confirm Delete Alert Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>
                  Estás a punto de eliminar <strong>{confirmDelete.nombre}</strong> del inventario.
                  <br />
                  <br />
                  <span className="text-amber-600 dark:text-amber-400">
                    ⚠️ Esta acción no se puede deshacer. El producto será eliminado permanentemente.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDelete) {
                  const product = inventario.find(p => p.id === confirmDelete.id);
                  if (product) {
                    setDeletingProduct(product);
                    setConfirmDelete(null);
                  }
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import from Script Dialog */}
      <ImportScriptDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onSuccess={refetch}
      />

      {/* Add Product Dialog */}
      <AddProductDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={handleAddProduct}
        isLoading={crearProducto.isPending}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedIds.size}
        onConfirm={handleBulkDelete}
        isLoading={eliminarProducto.isPending}
      />

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        open={bulkUploadOpen}
        onOpenChange={setBulkUploadOpen}
        onSuccess={refetch}
      />

      {/* Oportunidades Modal */}
      <OportunidadesModal
        open={!!oportunidadesProducto}
        onOpenChange={(open) => !open && setOportunidadesProducto(null)}
        producto={oportunidadesProducto}
        compras={oportunidadesSeleccionadas}
        isLoading={isLoadingComprasAgiles}
      />

      {/* Product Gallery Dialog */}
      {galleryProduct && user && (
        <ProductGallery
          productId={galleryProduct.id}
          productType="inventory"
          userId={user.id}
          productName={galleryProduct.nombre_producto}
          open={!!galleryProduct}
          onOpenChange={(open) => !open && setGalleryProduct(null)}
        />
      )}
    </div>
  );
}
