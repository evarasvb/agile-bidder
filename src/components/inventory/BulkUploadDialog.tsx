import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, FileUp, ImageIcon, Download, ImageOff } from 'lucide-react';
import { useInventoryBulk, BulkProductRow, ImportProgress, generateInventoryTemplateData, generateInventoryInstructions } from '@/hooks/useInventoryBulk';
import { useCreateImportHistory } from '@/hooks/useImportHistory';
import { validateImageUrl } from '@/hooks/useProductImageUpload';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PreviewData {
  rows: BulkProductRow[];
  totalRows: number;
  fileName: string;
}

// Image thumbnail component with loading state
function ImageThumbnail({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error || !url) {
    return (
      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
        <ImageOff className="h-4 w-4 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded overflow-hidden bg-muted relative">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        </div>
      )}
      <img 
        src={url} 
        alt="" 
        className={cn("w-full h-full object-cover transition-opacity", loaded ? "opacity-100" : "opacity-0")}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

export function BulkUploadDialog({ open, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ row: number; field: string; message: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const bulkImport = useInventoryBulk((progress) => {
    setImportProgress(progress);
  });
  const createImportHistory = useCreateImportHistory();

  const resetState = () => {
    setPreviewData(null);
    setParseErrors([]);
    setValidationErrors([]);
    setImportProgress(null);
  };

  const handleClose = () => {
    if (bulkImport.isPending) return; // Don't close while importing
    resetState();
    onOpenChange(false);
  };

  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Products sheet with template data
      const templateData = generateInventoryTemplateData();
      const wsProducts = XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths - Updated for new fields
      wsProducts['!cols'] = [
        { wch: 15 },  // Código
        { wch: 40 },  // Descripción
        { wch: 12 },  // Precio Neto
        { wch: 10 },  // Unidad
        { wch: 20 },  // Categoría
        { wch: 10 },  // Stock
        { wch: 15 },  // Margen Mínimo
        { wch: 15 },  // Margen Objetivo
        { wch: 18 },  // Tiempo Entrega
        { wch: 20 },  // Proveedor
        { wch: 40 },  // Keywords
        { wch: 50 },  // URL Imagen
      ];
      
      XLSX.utils.book_append_sheet(wb, wsProducts, 'Productos');
      
      // Instructions sheet
      const instructionsData = generateInventoryInstructions();
      const wsInstructions = XLSX.utils.json_to_sheet(instructionsData);
      wsInstructions['!cols'] = [{ wch: 80 }];
      
      XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instrucciones');
      
      XLSX.writeFile(wb, 'plantilla_inventario.xlsx');
      toast.success('📥 Plantilla descargada');
    } catch (error) {
      console.error('Error downloading template:', error);
      toast.error('Error al descargar la plantilla');
    }
  };

  const parseFile = async (file: File) => {
    resetState();
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
      setParseErrors(['Formato no soportado. Use archivos .xlsx, .xls o .csv']);
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        setParseErrors(['El archivo está vacío o no tiene datos válidos']);
        return;
      }

      // Map columns to expected format - flexible column matching with new required fields
      const rows: BulkProductRow[] = jsonData.map((row: any) => ({
        sku: row['Código'] || row['Codigo'] || row['SKU'] || row['sku'] || row['Sku'] || '',
        nombre: row['Descripción'] || row['Descripcion'] || row['descripcion'] || row['Nombre'] || row['nombre'] || '',
        descripcion: row['Detalle'] || row['detalle'] || '',
        categoria: row['Categoría'] || row['Categoria'] || row['categoria'] || '',
        precio_unitario: Number(row['Precio Neto'] || row['Precio'] || row['Precio Unitario'] || row['precio'] || row['precio_unitario'] || 0),
        unidad_medida: row['Unidad'] || row['Unidad de Medida'] || row['unidad'] || row['unidad_medida'] || '',
        stock: Number(row['Stock'] || row['stock'] || row['Stock Disponible'] || 0),
        margen_minimo: Number(row['Margen Mínimo (%)'] || row['Margen Minimo'] || row['margen_minimo'] || 10),
        margen_objetivo: Number(row['Margen Objetivo (%)'] || row['Margen Objetivo'] || row['margen_objetivo'] || 15),
        tiempo_entrega_dias: Number(row['Tiempo Entrega (días)'] || row['Tiempo Entrega'] || row['tiempo_entrega'] || 5),
        proveedor: row['Proveedor'] || row['proveedor'] || '',
        keywords: row['Keywords'] || row['keywords'] || row['Palabras Clave'] || row['palabras_clave'] || '',
        imagen_url: row['URL Imagen'] || row['Imagen'] || row['imagen_url'] || row['Image URL'] || '',
      }));

      // Pre-validate for display - Updated required fields
      const errors: string[] = [];
      const skuSet = new Set<string>();
      
      rows.forEach((row, index) => {
        const rowNum = index + 2;
        
        // Required: Código
        if (!row.sku || row.sku.trim() === '') {
          errors.push(`Fila ${rowNum}: Código es obligatorio`);
        } else if (skuSet.has(row.sku.toLowerCase())) {
          errors.push(`Fila ${rowNum}: Código "${row.sku}" duplicado en el archivo`);
        } else {
          skuSet.add(row.sku.toLowerCase());
        }
        
        // Required: Descripción
        if (!row.nombre || row.nombre.trim() === '') {
          errors.push(`Fila ${rowNum}: Descripción es obligatoria`);
        }
        
        // Required: Precio Neto
        if (row.precio_unitario === undefined || row.precio_unitario === null || isNaN(Number(row.precio_unitario)) || row.precio_unitario === 0) {
          errors.push(`Fila ${rowNum}: Precio Neto es obligatorio`);
        }
        
        // Required: Unidad
        if (!row.unidad_medida || row.unidad_medida.trim() === '') {
          errors.push(`Fila ${rowNum}: Unidad es obligatoria`);
        }
        
        // Validate image URL if provided
        if (row.imagen_url && row.imagen_url.trim() !== '') {
          if (!validateImageUrl(row.imagen_url)) {
            errors.push(`Fila ${rowNum}: URL de imagen inválida (debe ser https://)`);
          }
        }
      });

      setParseErrors(errors);
      setPreviewData({
        rows,
        totalRows: rows.length,
        fileName: file.name
      });
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseErrors(['Error al leer el archivo. Verifique que sea un archivo Excel/CSV válido.']);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      parseFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!previewData) return;

    const extension = previewData.fileName.split('.').pop()?.toLowerCase() as 'xlsx' | 'xls' | 'csv';

    try {
      const result = await bulkImport.mutateAsync(previewData.rows);
      
      // Log import to history
      const status = result.errors.length > 0 
        ? (result.inserted + result.updated > 0 ? 'partial' : 'failed')
        : 'completed';
      
      await createImportHistory.mutateAsync({
        file_name: previewData.fileName,
        file_type: extension || 'xlsx',
        total_rows: previewData.totalRows,
        inserted_count: result.inserted,
        updated_count: result.updated,
        error_count: result.errors.length,
        status,
        errors: result.errors.slice(0, 50) // Limit stored errors
      });
      
      if (result.errors.length > 0) {
        setValidationErrors(result.errors);
      } else {
        handleClose();
        onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      
      // Log failed import
      await createImportHistory.mutateAsync({
        file_name: previewData.fileName,
        file_type: extension || 'xlsx',
        total_rows: previewData.totalRows,
        inserted_count: 0,
        updated_count: 0,
        error_count: 1,
        status: 'failed',
        errors: [{ message: error instanceof Error ? error.message : 'Error desconocido' }]
      });
    }
  };

  // Count valid rows based on new required fields
  const validRows = previewData?.rows.filter(row => 
    row.sku && row.sku.trim() !== '' && 
    row.nombre && row.nombre.trim() !== '' &&
    row.precio_unitario !== undefined && row.precio_unitario !== null && !isNaN(Number(row.precio_unitario)) && row.precio_unitario !== 0 &&
    row.unidad_medida && row.unidad_medida.trim() !== ''
  ).length || 0;
  
  const rowsWithImages = previewData?.rows.filter(row => 
    row.imagen_url && row.imagen_url.trim() !== '' && validateImageUrl(row.imagen_url)
  ).length || 0;

  // Calculate progress percentage
  const progressPercentage = importProgress 
    ? Math.round((importProgress.current / Math.max(importProgress.total, 1)) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Cargar Productos desde Excel
          </DialogTitle>
          <DialogDescription>
            Sube un archivo Excel o CSV con tus productos para importarlos masivamente
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Progress Indicator */}
          {importProgress && bulkImport.isPending && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {importProgress.message}
                </span>
                <span className="text-muted-foreground">{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {importProgress.phase === 'validating' && 'Validando datos...'}
                  {importProgress.phase === 'inserting' && 'Insertando nuevos productos...'}
                  {importProgress.phase === 'updating' && 'Actualizando productos existentes...'}
                  {importProgress.phase === 'complete' && '¡Completado!'}
                </span>
                <span>
                  {importProgress.current} de {importProgress.total}
                </span>
              </div>
            </div>
          )}

          {/* Drop Zone */}
          {!previewData && !bulkImport.isPending && (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={handleFileInputClick}
                className={cn(
                  "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                  isDragging 
                    ? "border-primary bg-primary/5" 
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <FileUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Arrastra tu archivo aquí
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  o haz clic para seleccionar
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button variant="outline" className="pointer-events-none">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Seleccionar Archivo
                </Button>
                <p className="text-xs text-muted-foreground mt-4">
                  Formatos soportados: .xlsx, .xls, .csv (máximo 10,000 productos)
                </p>
              </div>
              
              {/* Download Template Button */}
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  className="gap-2"
                  onClick={handleDownloadTemplate}
                >
                  <Download className="h-4 w-4" />
                  Descargar Plantilla de Ejemplo
                </Button>
              </div>
            </>
          )}

          {/* Parse Errors */}
          {parseErrors.length > 0 && !previewData && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error al procesar el archivo</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-2">
                  {parseErrors.slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                  {parseErrors.length > 5 && (
                    <li>... y {parseErrors.length - 5} errores más</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {previewData && !bulkImport.isPending && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{previewData.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {previewData.totalRows} productos encontrados
                      {rowsWithImages > 0 && (
                        <span className="text-primary ml-2">
                          ({rowsWithImages} con imagen)
                        </span>
                      )}
                      {parseErrors.length > 0 && (
                        <span className="text-destructive ml-2">
                          ({parseErrors.length} con errores)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={resetState}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Validation Warnings */}
              {parseErrors.length > 0 && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {parseErrors.slice(0, 3).join(' • ')}
                    {parseErrors.length > 3 && ` • +${parseErrors.length - 3} más`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Import Errors */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Errores durante la importación</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      {validationErrors.slice(0, 5).map((error, i) => (
                        <li key={i}>
                          Fila {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Preview Table - Updated columns */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead className="w-[50px]">Img</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Precio Neto</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.slice(0, 15).map((row, index) => {
                      const hasError = !row.sku || !row.nombre || !row.precio_unitario || !row.unidad_medida;
                      const hasValidImage = row.imagen_url && validateImageUrl(row.imagen_url);
                      return (
                        <TableRow key={index} className={hasError ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            {hasValidImage ? (
                              <ImageThumbnail url={row.imagen_url!} />
                            ) : (
                              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={cn("font-mono", !row.sku && "text-destructive")}>
                            {row.sku || '⚠️ Vacío'}
                          </TableCell>
                          <TableCell className={!row.nombre ? "text-destructive" : ""}>
                            {row.nombre || '⚠️ Vacío'}
                          </TableCell>
                          <TableCell className={cn("text-right font-mono", !row.precio_unitario && "text-destructive")}>
                            {row.precio_unitario ? `$${row.precio_unitario.toLocaleString('es-CL')}` : '⚠️ Vacío'}
                          </TableCell>
                          <TableCell className={!row.unidad_medida ? "text-destructive" : ""}>
                            {row.unidad_medida || '⚠️ Vacío'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.categoria || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.stock !== undefined ? row.stock : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {previewData.totalRows > 15 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-4">
                          ... y {previewData.totalRows - 15} productos más
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Summary */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{validRows} válidos</span>
                  </div>
                  {rowsWithImages > 0 && (
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <span>{rowsWithImages} con imagen</span>
                    </div>
                  )}
                  {parseErrors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span>{parseErrors.length} errores</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetState}>
                    Cambiar archivo
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={validRows === 0 || bulkImport.isPending}
                  >
                    {bulkImport.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar {validRows} Productos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}