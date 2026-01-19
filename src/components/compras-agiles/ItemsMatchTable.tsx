import { useState, useMemo, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Calculator, Loader2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLicitacionItems, type LicitacionItem } from '@/hooks/useLicitacionItems';
import { useProductMatching, type ItemConMatch } from '@/hooks/useProductMatching';
import { cn } from '@/lib/utils';

interface ItemRow {
  id: number;
  requerimiento: string;
  cantidad: number;
  unidad: string;
  productoMatch: ItemConMatch | null;
  precioUnitario: number;
  matchScore: number;
}

interface ItemsMatchTableProps {
  licitacionId: string;
  onSubmit?: (items: ItemRow[], totals: { neto: number; iva: number; total: number }) => void;
  onValidationChange?: (isValid: boolean) => void;
}

const IVA_RATE = 0.19;
const MATCH_THRESHOLD = 70;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ItemsMatchTable({ licitacionId, onSubmit, onValidationChange }: ItemsMatchTableProps) {
  const { data: licitacionItems, isLoading: loadingItems } = useLicitacionItems(licitacionId);
  const { procesarCompra, isLoading: loadingInventario } = useProductMatching();
  
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Procesar items y buscar matches cuando cambian
  useEffect(() => {
    if (!licitacionItems || licitacionItems.length === 0 || loadingInventario) {
      setItemRows([]);
      return;
    }

    setIsProcessing(true);
    
    // Convertir LicitacionItem a ItemRequerido para el matching
    const itemsParaMatch = licitacionItems.map((item) => ({
      id: `licitacion-${item.id}`,
      nombre: item.nombre_producto,
      descripcion: item.descripcion || undefined,
      cantidad: item.cantidad || 1,
      unidad: item.unidad || 'UN',
    }));

    // Procesar matches
    const itemsConMatch = procesarCompra(itemsParaMatch);
    
    // Crear filas con matches
    const rows: ItemRow[] = licitacionItems.map((item, index) => {
      const matchResult = itemsConMatch[index] || null;
      const bestMatch = matchResult?.bestMatch;
      
      return {
        id: item.id,
        requerimiento: item.nombre_producto,
        cantidad: item.cantidad || 1,
        unidad: item.unidad || 'UN',
        productoMatch: matchResult,
        precioUnitario: bestMatch?.inventoryItem.precio_unitario || 0,
        matchScore: bestMatch?.score || 0,
      };
    });

    setItemRows(rows);
    setIsProcessing(false);
  }, [licitacionItems, procesarCompra, loadingInventario]);

  // Manejar cambio de precio
  const handlePriceChange = useCallback((itemId: number, newPrice: string) => {
    const numericPrice = parseFloat(newPrice) || 0;
    setItemRows(prev => 
      prev.map(row => 
        row.id === itemId ? { ...row, precioUnitario: numericPrice } : row
      )
    );
  }, []);

  // Calcular totales
  const totals = useMemo(() => {
    const neto = itemRows.reduce((sum, row) => sum + (row.precioUnitario * row.cantidad), 0);
    const iva = neto * IVA_RATE;
    const total = neto + iva;
    return { neto, iva, total };
  }, [itemRows]);

  // Validar que todos tengan precio
  const validation = useMemo(() => {
    const sinPrecio = itemRows.filter(row => row.precioUnitario <= 0);
    const isValid = sinPrecio.length === 0 && itemRows.length > 0;
    return { isValid, sinPrecio };
  }, [itemRows]);

  // Notificar cambio de validación
  useEffect(() => {
    onValidationChange?.(validation.isValid);
  }, [validation.isValid, onValidationChange]);

  // Manejar envío
  const handleSubmit = () => {
    if (!validation.isValid) return;
    onSubmit?.(itemRows, totals);
  };

  if (loadingItems || loadingInventario || isProcessing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Buscando matches en inventario...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!licitacionItems || licitacionItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No se encontraron items para esta licitación</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">Requerimiento Solicitado</TableHead>
              <TableHead className="w-[10%] text-center">Cantidad</TableHead>
              <TableHead className="w-[10%] text-center">Unidad</TableHead>
              <TableHead className="w-[25%]">Producto Inventario</TableHead>
              <TableHead className="w-[10%] text-right">Precio Unit.</TableHead>
              <TableHead className="w-[10%] text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemRows.map((row) => {
              const hasGoodMatch = row.matchScore >= MATCH_THRESHOLD;
              const inventoryProduct = row.productoMatch?.bestMatch?.inventoryItem;
              
              return (
                <TableRow key={row.id}>
                  {/* Requerimiento */}
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-sm">{row.requerimiento}</p>
                      {row.productoMatch?.bestMatch && (
                        <div className="flex items-center gap-1">
                          <Badge 
                            variant={hasGoodMatch ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs',
                              hasGoodMatch 
                                ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {row.matchScore}% match
                          </Badge>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  {/* Cantidad */}
                  <TableCell className="text-center font-medium">
                    {row.cantidad}
                  </TableCell>
                  
                  {/* Unidad */}
                  <TableCell className="text-center text-muted-foreground">
                    {row.unidad}
                  </TableCell>
                  
                  {/* Producto Match */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {hasGoodMatch ? (
                        <Tooltip>
                          <TooltipTrigger>
                            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Match alto ({row.matchScore}%)</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger>
                            <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{row.matchScore > 0 ? `Match bajo (${row.matchScore}%)` : 'Sin match'}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <div className="min-w-0">
                        {inventoryProduct ? (
                          <div>
                            <p className={cn(
                              'text-sm truncate',
                              hasGoodMatch ? 'font-medium text-foreground' : 'text-muted-foreground'
                            )}>
                              {inventoryProduct.nombre_producto}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SKU: {inventoryProduct.sku}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            Sin producto asignado
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  
                  {/* Precio Unitario (editable) */}
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={row.precioUnitario || ''}
                      onChange={(e) => handlePriceChange(row.id, e.target.value)}
                      className={cn(
                        'w-24 text-right ml-auto',
                        row.precioUnitario <= 0 && 'border-destructive'
                      )}
                      placeholder="0"
                    />
                  </TableCell>
                  
                  {/* Subtotal */}
                  <TableCell className="text-right font-medium">
                    {formatCurrency(row.precioUnitario * row.cantidad)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} />
              <TableCell className="text-right font-medium">Total Neto:</TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(totals.neto)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell colSpan={4} />
              <TableCell className="text-right text-muted-foreground">IVA (19%):</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCurrency(totals.iva)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableCell colSpan={4} />
              <TableCell className="text-right font-bold text-lg">Total Final:</TableCell>
              <TableCell className="text-right font-bold text-lg text-primary">
                {formatCurrency(totals.total)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>

        {/* Mensaje de validación */}
        {!validation.isValid && itemRows.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm text-destructive">
              {validation.sinPrecio.length} {validation.sinPrecio.length === 1 ? 'item no tiene' : 'items no tienen'} precio asignado
            </span>
          </div>
        )}

        {/* Botón de envío */}
        {onSubmit && (
          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSubmit}
              disabled={!validation.isValid}
              size="lg"
              className="gap-2"
            >
              <Calculator className="h-4 w-4" />
              Generar Propuesta
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
