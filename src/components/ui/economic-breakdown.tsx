import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { IVA_RATE } from '@/lib/constants';

interface LineItem {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

interface EconomicBreakdownProps {
  items: LineItem[];
  className?: string;
  showCard?: boolean;
  ivaRate?: number; // Default 19% for Chile
}

export function EconomicBreakdown({
  items,
  className,
  showCard = true,
  ivaRate = IVA_RATE,
}: EconomicBreakdownProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const subtotalNeto = items.reduce((acc, item) => acc + item.subtotal, 0);
  const iva = Math.round(subtotalNeto * ivaRate);
  const total = subtotalNeto + iva;

  const content = (
    <div className={cn('space-y-4', className)}>
      {/* Items Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Producto</th>
              <th className="px-4 py-2 text-right font-medium">Cant.</th>
              <th className="px-4 py-2 text-right font-medium">P. Unit.</th>
              <th className="px-4 py-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-2">{item.nombre}</td>
                <td className="px-4 py-2 text-right">{item.cantidad}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(item.precioUnitario)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal Neto</span>
          <span>{formatCurrency(subtotalNeto)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IVA ({Math.round(ivaRate * 100)}%)</span>
          <span>{formatCurrency(iva)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-base font-semibold">
          <span>Total con IVA</span>
          <span className="text-green-600">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );

  if (!showCard) return content;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Desglose Economico</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

// Simple inline version for tables
export function EconomicSummary({
  subtotal,
  ivaRate = IVA_RATE,
  className,
}: {
  subtotal: number;
  ivaRate?: number;
  className?: string;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const iva = Math.round(subtotal * ivaRate);
  const total = subtotal + iva;

  return (
    <div className={cn('text-xs space-y-0.5', className)}>
      <div className="text-muted-foreground">
        Neto: {formatCurrency(subtotal)}
      </div>
      <div className="text-muted-foreground">
        IVA: {formatCurrency(iva)}
      </div>
      <div className="font-medium text-green-600">
        Total: {formatCurrency(total)}
      </div>
    </div>
  );
}
