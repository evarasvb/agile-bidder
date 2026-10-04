import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  error?: unknown;
  loading?: boolean;
  retrying?: boolean;
  refreshing?: boolean;
  stale?: boolean;
  hasPreviousData?: boolean;
  onRetry: () => void;
  label: string;
  children?: ReactNode;
}

export function QueryFeedback({ error, loading, retrying, refreshing, stale, hasPreviousData, onRetry, label, children }: Props) {
  if (error) return (
    <div role="alert" className="rounded-lg border border-destructive/30 p-6 text-center space-y-3">
      <p className="font-medium">No pudimos cargar {label}</p>
      <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo. Tus datos no se han eliminado.</p>
      {hasPreviousData && <p className="text-sm">Los datos anteriores están desactualizados y se han ocultado.</p>}
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </Button>
    </div>
  );
  if (loading) return <p role="status" className="p-6 text-center">Cargando {label}…</p>;
  return <>
    {(refreshing || stale) && <p role="status" className="text-sm text-muted-foreground mb-3">
      {refreshing ? `Actualizando ${label}… Los datos visibles son de la última consulta.` : `Los datos de ${label} están pendientes de actualización.`}
    </p>}
    {children}
  </>;
}
