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
import { IVA_RATE } from '@/lib/constants';

interface ItemRow {
  id: number;
  requerimiento: string;
  cantidad: number;
  unidad: string;
  productoMatch: ItemConMatch | null;
  precioUnitario: number;
  matchScore: number;
}

// Interface for fallback items from datos_json
interface FallbackItem {
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
}

interface ItemsMatchTableProps {
  licitacionId: string | number;
  fallbackItems?: FallbackItem[]; // Items extracted from datos_json
  onSubmit?: (items: ItemRow[], totals: { neto: number; iva: number; total: number }) => void;
  onValidationChange?: (isValid: boolean) => void;
}

const MATCH_THRESHOLD = 70;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ItemsMatchTable({ licitacionId, fallbackItems = [], onSubmit, onValidationChange }: ItemsMatchTableProps) {
  const { data: licitacionItems, isLoading: loadingItems } = useLicitacionItems(licitacionId);
  const { procesarCompra, isLoading: loadingInventario } = useProductMatching();
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Use DB items if available, otherwise use fallback items from datos_json
  const effectiveItems = useMemo(() => {
    if (licitacionItems && licitacionItems.length > 0) {
      return licitacionItems.map(item => ({
        id: item.id,
        nombre_producto: item.nombre_producto,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        unidad: item.unidad,
      }));
    }
    
    // Use fallback items
    return fallbackItems.map((item, index) => ({
      id: index + 1,
      nombre_producto: item.nombre || item.descripcion || 'Sin nombre',
      descripcion: item.descripcion || null,
      cantidad: item.cantidad || 1,
      unidad: item.unidad || 'Unidad',
    }));
  }, [licitacionItems, fallbackItems]);

  // Process items and find matches
  useEffect(() => {
    if (effectiveItems.length === 0 || loadingInventario) {
      setItemRows([]);
      return;
    }

    setIsProcessing(true);

    const itemsParaMatch = effectiveItems.map((item) => ({
      id: `item-${item.id}`,
      nombre: item.nombre_producto,
      descripcion: item.descripcion || undefined,
      cantidad: item.cantidad || 1,
      unidad: item.unidad || 'UN',
    }));

    const itemsConMatch = procesarCompra(itemsParaMatch);

    const rows: ItemRow[] = effectiveItems.map((item, index) => {
      const matchResult = itemsConMatch[index] || null;
      const bestMatch = matchResult?.bestMatch;

      return {
        id: typeof item.id === 'string' ? index + 1 : item.id,
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
  }, [effectiveItems, procesarCompra, loadingInventario]);

  const handlePriceChange = useCallback((itemId: number, newPrice: string) => {
    const numericPrice = parseFloat(newPrice) || 0;
    setItemRows(prev =>
      prev.map(row =>
        row.id === itemId ? { ...row, precioUnitario: numericPrice } : row
      )
    );
  }, []);

  const totals = useMemo(() => {
    const neto = itemRows.reduce((sum, row) => sum + (row.precioUnitario * row.cantidad), 0);
    const iva = neto * IVA_RATE;
    const total = neto + iva;
    return { neto, iva, total };
  }, [itemRows]);

  const validation = useMemo(() => {
    const sinPrecio = itemRows.filter(row => row.precioUnitario <= 0);
    const isValid = sinPrecio.length === 0 && itemRows.length > 0;
    return { isValid, sinPrecio };
  }, [itemRows]);

  useEffect(() => {
    onValidationChange?.(validation.isValid);
  }, [validation.isValid, onValidationChange]);

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
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (effectiveItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2" />
        <p>No se encontraron items para esta licitación</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Requerimiento Solicitado</TableHead>
            <TableHead className="w-[80px] text-center">Cantidad</TableHead>
            <TableHead className="w-[80px] text-center">Unidad</TableHead>
            <TableHead className="w-[200px]">Producto Inventario</TableHead>
            <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
            <TableHead className="w-[120px] text-right">Subtotal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itemRows.map((row) => {
            const hasGoodMatch = row.matchScore >= MATCH_THRESHOLD;
            const inventoryProduct = row.productoMatch?.bestMatch?.inventoryItem;

            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.requerimiento}</div>
                  {row.productoMatch?.bestMatch && (
                    <Badge variant={hasGoodMatch ? 'default' : 'secondary'} className="mt-1">
                      {row.matchScore}% match
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">{row.cantidad}</TableCell>
                <TableCell className="text-center">{row.unidad}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          {hasGoodMatch ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {hasGoodMatch ? (
                          <p>Match alto ({row.matchScore}%)</p>
                        ) : (
                          <p>{row.matchScore > 0 ? `Match bajo (${row.matchScore}%)` : 'Sin match'}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {inventoryProduct ? (
                    <div>
                      <div className="font-medium text-sm">{inventoryProduct.nombre_producto}</div>
                      <div className="text-xs text-muted-foreground">SKU: {inventoryProduct.sku}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sin producto asignado</span>
                  )}
                </TableCell>
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
                <TableCell className="text-right font-medium">
                  {formatCurrency(row.precioUnitario * row.cantidad)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}></TableCell>
            <TableCell className="text-right text-muted-foreground">Total Neto:</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(totals.neto)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={4}></TableCell>
            <TableCell className="text-right text-muted-foreground">IVA (19%):</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(totals.iva)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={4}></TableCell>
            <TableCell className="text-right font-bold">Total Final:</TableCell>
            <TableCell className="text-right font-bold text-lg">{formatCurrency(totals.total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>

      {!validation.isValid && itemRows.length > 0 && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md">
          <AlertCircle className="h-4 w-4" />
          <span>
            {validation.sinPrecio.length} {validation.sinPrecio.length === 1 ? 'item no tiene' : 'items no tienen'} precio asignado
          </span>
        </div>
      )}

      {onSubmit && (
        <Button
          onClick={handleSubmit}
          disabled={!validation.isValid}
          className="w-full"
          size="lg"
        >
          <Calculator className="mr-2 h-4 w-4" />
          Generar Propuesta
        </Button>
      )}
    </div>
  );
}
