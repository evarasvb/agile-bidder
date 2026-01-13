import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, FileUp, ImageIcon } from 'lucide-react';
import { useClienteInventarioBulk, BulkProductRow, ValidationError } from '@/hooks/useClienteInventarioBulk';
import { validateImageUrl } from '@/hooks/useProductImageUpload';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

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

export function BulkUploadDialog({ open, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const bulkImport = useClienteInventarioBulk();

  const resetState = () => {
    setPreviewData(null);
    setParseErrors([]);
    setValidationErrors([]);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
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

      // Map columns to expected format
      const rows: BulkProductRow[] = jsonData.map((row: any) => ({
        sku: row['SKU'] || row['sku'] || row['Sku'] || '',
        nombre: row['Nombre del Producto'] || row['Nombre'] || row['nombre'] || row['Producto'] || '',
        descripcion: row['Descripción'] || row['Descripcion'] || row['descripcion'] || '',
        categoria: row['Categoría'] || row['Categoria'] || row['categoria'] || '',
        precio_unitario: Number(row['Precio Unitario'] || row['Precio'] || row['precio_unitario'] || 0),
        unidad_medida: row['Unidad de Medida'] || row['Unidad'] || row['unidad_medida'] || 'UN',
        keywords: row['Keywords para Matching'] || row['Keywords'] || row['keywords'] || row['palabras_clave'] || '',
        imagen_url: row['URL Imagen'] || row['Imagen'] || row['imagen_url'] || row['Image URL'] || '',
      }));

      // Pre-validate for display
      const errors: string[] = [];
      const skuSet = new Set<string>();
      
      rows.forEach((row, index) => {
        const rowNum = index + 2;
        
        if (!row.sku || row.sku.trim() === '') {
          errors.push(`Fila ${rowNum}: SKU es obligatorio`);
        } else if (skuSet.has(row.sku.toLowerCase())) {
          errors.push(`Fila ${rowNum}: SKU "${row.sku}" duplicado en el archivo`);
        } else {
          skuSet.add(row.sku.toLowerCase());
        }
        
        if (!row.nombre || row.nombre.trim() === '') {
          errors.push(`Fila ${rowNum}: Nombre del Producto es obligatorio`);
        }
        
        // Validate image URL
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!previewData) return;

    try {
      const result = await bulkImport.mutateAsync(previewData.rows);
      
      if (result.errors.length > 0) {
        setValidationErrors(result.errors);
      } else {
        handleClose();
        onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
    }
  };

  const validRows = previewData?.rows.filter(row => 
    row.sku && row.sku.trim() !== '' && row.nombre && row.nombre.trim() !== ''
  ).length || 0;
  
  const rowsWithImages = previewData?.rows.filter(row => 
    row.imagen_url && row.imagen_url.trim() !== '' && validateImageUrl(row.imagen_url)
  ).length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Drop Zone */}
          {!previewData && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                isDragging 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50"
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
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer" asChild>
                  <span>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Seleccionar Archivo
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                Formatos soportados: .xlsx, .xls, .csv (máximo 10,000 productos)
              </p>
            </div>
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
          {previewData && (
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

              {/* Preview Table */}
              <ScrollArea className="flex-1 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead className="w-[50px]">Img</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Precio</TableHead>
                      <TableHead>Unidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.slice(0, 10).map((row, index) => {
                      const hasError = !row.sku || !row.nombre;
                      const hasValidImage = row.imagen_url && validateImageUrl(row.imagen_url);
                      return (
                        <TableRow key={index} className={hasError ? 'bg-destructive/5' : ''}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell>
                            {hasValidImage ? (
                              <div className="w-8 h-8 rounded overflow-hidden bg-muted">
                                <img 
                                  src={row.imagen_url} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
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
                          <TableCell className="text-muted-foreground">
                            {row.categoria || '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {row.precio_unitario ? `$${row.precio_unitario.toLocaleString('es-CL')}` : '-'}
                          </TableCell>
                          <TableCell>{row.unidad_medida || 'UN'}</TableCell>
                        </TableRow>
                      );
                    })}
                    {previewData.totalRows > 10 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-4">
                          ... y {previewData.totalRows - 10} productos más
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
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span><strong>{validRows}</strong> productos listos</span>
                  </div>
                  {rowsWithImages > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      <span>{rowsWithImages} con imagen</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleImport}
                    disabled={validRows === 0 || bulkImport.isPending}
                    className="min-w-[140px]"
                  >
                    {bulkImport.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar {validRows} productos
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
