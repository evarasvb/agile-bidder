import { useNavigate } from 'react-router-dom';
import { Coins, Infinity as InfinityIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreditosSaldo } from '@/hooks/useCreditos';

/**
 * Píldora de créditos siempre visible en la barra superior.
 * Muestra el saldo (o "Ilimitado"), avisa en ámbar cuando queda poco y
 * lleva a facturación al hacer clic.
 */
export function CreditosBar({ className }: { className?: string }) {
  const { data, isLoading } = useCreditosSaldo();
  const navigate = useNavigate();

  if (isLoading || !data) return null; // sin datos (o RPC no disponible): no mostramos nada

  if (data.ilimitado) {
    return (
      <button
        onClick={() => navigate('/cuenta/facturacion')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
          'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 transition-colors',
          className,
        )}
        title="Créditos ilimitados"
      >
        <InfinityIcon className="h-3.5 w-3.5" />
        Ilimitado
      </button>
    );
  }

  const bajo = data.saldo <= 10;
  return (
    <button
      onClick={() => navigate('/cuenta/facturacion')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        bajo
          ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
          : 'bg-muted/50 border-border text-foreground hover:bg-muted',
        className,
      )}
      title={bajo ? 'Te quedan pocos créditos. Pasa a Pro.' : 'Tus créditos FirmaVB'}
    >
      <Coins className={cn('h-3.5 w-3.5', bajo ? 'text-amber-600' : 'text-muted-foreground')} />
      {data.saldo}
      <span className="hidden sm:inline font-normal text-muted-foreground">créditos</span>
    </button>
  );
}
