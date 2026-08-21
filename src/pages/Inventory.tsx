// @ts-nocheck
import { useState, useMemo } from "react";
import { Plus, Upload, Search, MoreHorizontal, Edit2, Trash2, Package, Inbox, Loader2, RefreshCw, FileJson, Download, Trash, Image, FileText, CheckSquare, Square, FileSpreadsheet, Images, HelpCircle, Info, Sparkles } from "lucide-react";
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
import { useEnriquecerInventario } from "@/hooks/useEnriquecerInventario";
import { BuscarFotosDialog } from "@/components/inventory/BuscarFotosDialog";
import { EditProductDialog } from "@/components/inventory/EditProductDialog";
import { DeleteProductDialog } from "@/components/inventory/DeleteProductDialog";
import { ImportScriptDialog } from "@/components/inventory/ImportScriptDialog";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { BulkDeleteDialog } from "@/components/inventory/BulkDeleteDialog";
import { BulkUploadDialog } from "@/components/inventory/BulkUploadDialog";
import { useRequirePro } from "@/components/pro/UpgradeProProvider";
import { DownloadTemplateButton } from "@/components/inventory/DownloadTemplateButton";
import { ProductGallery } from "@/components/inventory/ProductGallery";
import { ImportHistoryPanel } from "@/components/inventory/ImportHistoryPanel";
import { OportunidadesModal } from "@/components/inventory/OportunidadesModal";
import { useAuthUser, useCliente } from "@/hooks/useCliente";
import { useComprasAgilesMatch } from "@/hooks/useComprasAgilesMatch";
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
  const [soloIncompletos, setSoloIncompletos] = useState(false);
  const [fotosProducto, setFotosProducto] = useState<InventoryItem | null>(null);
  
  // Pagination state for UI performance
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // Show 100 products per page to prevent performance issues
  
  const { data: inventario = [], isLoading, refetch } = useInventory();
  const { data: cliente } = useCliente();
  const enriquecer = useEnriquecerInventario();
  const [oportunidadesProducto, setOportunidadesProducto] = useState<InventoryItem | null>(null);

  // Demanda REAL por producto: cruza el inventario con las compras ágiles activas
  // (mismo motor de match). Antes esta columna era un stub siempre en 0.
  const { data: comprasMatches = [], isLoading: isLoadingComprasAgiles } = useComprasAgilesMatch(cliente?.id ?? null);
  const matchesByProductId = useMemo(() => {
    const map: Record<string, typeof comprasMatches> = {};
    for (const c of comprasMatches) {
      for (const pid of c.matched_product_ids || []) {
        (map[pid] ||= []).push(c);
      }
    }
    return map;
  }, [comprasMatches]);
  const oportunidadesSeleccionadas = oportunidadesProducto
    ? matchesByProductId[oportunidadesProducto.id] ?? []
    : [];

  // Enriquecer con IA: completa descripción, palabras clave y fotos de los
  // productos indicados. Sin ids, procesa los que estén incompletos.
  // overwrite=true rehace aunque ya tengan datos (solo con selección).
  const handleEnriquecer = (opts?: { overwrite?: boolean; ids?: string[] }) => {
    const ids = opts?.ids ?? (selectedIds.size > 0 ? Array.from(selectedIds) : undefined);
    if (opts?.overwrite && !ids) {
      toast.warning('Selecciona productos para rehacer (evita sobrescribir todo por accidente).');
      return;
    }
    toast.loading('Enriqueciendo con IA…', { id: 'enriquecer' });
    enriquecer.mutate(
      { ids, overwrite: opts?.overwrite },
      {
        onSuccess: (res) => {
          toast.dismiss('enriquecer');
          if (!res || res.procesados === 0) {
            toast.info(res?.mensaje || 'No hay productos para enriquecer (ya están completos).');
            return;
          }
          const partes = [`${res.procesados} producto${res.procesados === 1 ? '' : 's'} actualizados`];
          if (res.fuente_imagen === 'pexels') partes.push(`${res.con_imagen} con foto nueva`);
          else partes.push('sin fotos (falta configurar la API de imágenes)');
          toast.success(partes.join(' · '));
        },
        onSettled: () => toast.dismiss('enriquecer'),
      }
    );
  };
  const { requirePro, isPro } = useRequirePro();
  const FREE_INV_LIMIT = 20;
  const handleAgregarClick = () => {
    // Free: puede cargar hasta el límite; al llegar, ofrece Pro.
    if (!isPro && inventario.length >= FREE_INV_LIMIT) {
      requirePro(
        undefined,
        `El plan gratuito permite hasta ${FREE_INV_LIMIT} productos. Hazte Pro para inventario ilimitado.`,
      );
      return;
    }
    setAddDialogOpen(true);
  };
  const actualizarProducto = useUpdateInventoryItem();
  const eliminarProducto = useDeleteInventoryItem();
  const crearProducto = useCreateInventoryItem();

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

  // Un producto está "incompleto" si le falta descripción o imagen (lo que
  // resta calidad al matching y a la ficha técnica del PDF).
  const esIncompleto = (item: InventoryItem) => !item.descripcion?.trim() || !item.imagen_url;
  const incompleteCount = inventario.filter(esIncompleto).length;

  const filteredInventory = inventario.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      item.nombre_producto.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      (item.proveedor && item.proveedor.toLowerCase().includes(q));
    if (!matchQ) return false;
    if (soloIncompletos && !esIncompleto(item)) return false;
    return true;
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Inventario</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona tus productos y reglas de matching
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                className="gap-2"
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Actualiza la lista de productos del inventario</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Download Template */}
          <DownloadTemplateButton />
          
          {/* Bulk Upload */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                className="gap-2 bg-primary hover:bg-primary/90"
                onClick={() => setBulkUploadOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Cargar desde Excel
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Importa múltiples productos desde un archivo Excel (.xlsx)</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Export Dropdown */}
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover">
                  <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4" />
                    Exportar a Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    Exportar a CSV (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Exporta tu inventario completo en Excel o CSV</p>
            </TooltipContent>
          </Tooltip>
          
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 border-firmavb-blue text-firmavb-blue hover:bg-firmavb-blue/10"
                    disabled={enriquecer.isPending}
                  >
                    {enriquecer.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Enriquecer con IA
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  Completa con IA la descripción, palabras clave y fotos (banco). Sin selección, procesa los
                  incompletos.
                </p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEnriquecer()} className="gap-2 cursor-pointer">
                <Sparkles className="h-4 w-4" />
                {selectedIds.size > 0 ? `Completar seleccionados (${selectedIds.size})` : 'Completar incompletos'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleEnriquecer({ overwrite: true })}
                className="gap-2 cursor-pointer"
                disabled={selectedIds.size === 0}
              >
                <RefreshCw className="h-4 w-4" />
                Rehacer seleccionados (sobrescribir)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-firmavb-blue text-firmavb-blue hover:bg-firmavb-blue/10"
                onClick={() => setImportDialogOpen(true)}
              >
                <FileJson className="h-4 w-4" />
                Cargar desde Script
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Importa productos desde un script JSON personalizado</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90"
                onClick={handleAgregarClick}
              >
                <Plus className="h-4 w-4" />
                Agregar Producto
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Agrega un nuevo producto al inventario manualmente</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <Button
          variant={soloIncompletos ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
          onClick={() => { setSoloIncompletos((v) => !v); setCurrentPage(1); }}
          disabled={incompleteCount === 0 && !soloIncompletos}
        >
          <Info className="h-4 w-4" />
          {soloIncompletos ? 'Ver todos' : `Incompletos (${incompleteCount})`}
        </Button>

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
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-12 w-12 mb-4 opacity-50" />
            {inventario.length === 0 ? (
              // Inventario realmente vacío: CTA de onboarding.
              <>
                <p className="text-lg font-medium">No hay productos en el inventario</p>
                <p className="text-sm">Agrega tus productos para empezar a recibir oportunidades que hagan match</p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                  <Button onClick={() => setAddDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Agrega tu primer producto
                  </Button>
                  <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Cargar desde Excel
                  </Button>
                </div>
              </>
            ) : (
              // Hay inventario, pero la BÚSQUEDA no arrojó resultados.
              <>
                <p className="text-lg font-medium">Sin resultados</p>
                <p className="text-sm">Ningún producto coincide con tu búsqueda</p>
              </>
            )}
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
                <TableHead className="font-semibold w-[60px]">Imagen</TableHead>
                <TableHead className="font-semibold">SKU</TableHead>
                <TableHead className="font-semibold">Producto</TableHead>
                <TableHead className="font-semibold">Proveedor</TableHead>
                <TableHead className="font-semibold">Categoría</TableHead>
                <TableHead className="font-semibold text-right">Precio</TableHead>
                <TableHead className="font-semibold text-right">Margen</TableHead>
                <TableHead className="font-semibold text-right">Stock</TableHead>
                <TableHead className="font-semibold text-center">Oportunidades</TableHead>
                <TableHead className="font-semibold">Estado</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInventory.map((item) => {
                return (
                <TableRow key={item.id} className="data-row">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <button 
                      onClick={() => setGalleryProduct(item)}
                      className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden relative group hover:ring-2 hover:ring-primary/50 transition-all"
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
                      <Images className={cn("h-5 w-5 text-muted-foreground", item.imagen_url && "hidden")} />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Images className="h-4 w-4 text-white" />
                      </div>
                    </button>
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {item.sku}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.nombre_producto}</p>
                        {esIncompleto(item) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className="bg-warning/10 text-warning border-0 gap-1">
                                <Info className="h-3 w-3" />
                                Incompleto
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Falta descripción o imagen para la ficha del PDF</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {item.descripcion && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {item.descripcion}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.proveedor || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.categoria || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${item.precio_unitario.toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {item.margen_minimo || 10}%
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    item.stock_disponible === 0 && "text-destructive",
                    item.stock_disponible > 0 && item.stock_disponible < 50 && "text-warning"
                  )}>
                    {item.stock_disponible.toLocaleString("es-CL")}
                  </TableCell>
                  <TableCell className="text-center">
                    {isLoadingComprasAgiles ? (
                      <Loader2 className="h-3 w-3 animate-spin inline text-muted-foreground" />
                    ) : (matchesByProductId[item.id]?.length ?? 0) === 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-default">—</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Sin compras ágiles activas que hagan match</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOportunidadesProducto(item)}
                        aria-label={`Ver oportunidades de ${item.nombre_producto}`}
                      >
                        <Badge variant="success" className="cursor-pointer gap-1">
                          <Gavel className="h-3 w-3" />
                          {matchesByProductId[item.id].length}
                        </Badge>
                      </button>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(item.stock_disponible, item.activo)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
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
                            onClick={() => handleEnriquecer({ ids: [item.id] })}
                            disabled={enriquecer.isPending}
                          >
                            <Sparkles className="h-4 w-4" />
                            Enriquecer con IA
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => setFotosProducto(item)}
                          >
                            <Images className="h-4 w-4" />
                            Buscar fotos
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

      {/* Buscar fotos (banco) */}
      <BuscarFotosDialog
        open={!!fotosProducto}
        onOpenChange={(o) => !o && setFotosProducto(null)}
        producto={fotosProducto ? { id: fotosProducto.id, nombre: fotosProducto.nombre_producto } : null}
      />

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

      {/* Oportunidades reales por producto */}
      <OportunidadesModal
        open={!!oportunidadesProducto}
        onOpenChange={(open) => !open && setOportunidadesProducto(null)}
        producto={oportunidadesProducto}
        compras={oportunidadesSeleccionadas as any}
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
