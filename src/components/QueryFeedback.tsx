import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  error?: unknown;
  loading?: boolean;
  retrying?: boolean;
  onRetry: () => void;
  label: string;
  children?: ReactNode;
}

export function QueryFeedback({ error, loading, retrying, onRetry, label, children }: Props) {
  if (error) return (
    <div role="alert" className="rounded-lg border border-destructive/30 p-6 text-center space-y-3">
      <p className="font-medium">No pudimos cargar {label}</p>
      <p className="text-sm text-muted-foreground">Revisa tu conexión e inténtalo de nuevo. Tus datos no se han eliminado.</p>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </Button>
    </div>
  );
  if (loading) return <p role="status" className="p-6 text-center">Cargando {label}…</p>;
  return <>{children}</>;
}
