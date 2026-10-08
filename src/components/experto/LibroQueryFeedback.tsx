/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import type { ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { LibroDownload } from '@/lib/libroRequests';
import { Button } from '@/components/ui/button';

interface Props {
  codigo: string;
  loading: boolean;
  fetching: boolean;
  error: unknown;
  hasData: boolean;
  onRetry: () => void;
  children: ReactNode;
}

export function LibroQueryFeedback({ codigo, loading, fetching, error, hasData, onRetry, children }: Props) {
  if (!codigo) return <>{children}</>;
  if (loading) return (
    <div role="status" className="rounded-lg border p-6 flex items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Cargando el libro de {codigo}…
    </div>
  );
  return <>
    {error ? (
      <div role="alert" className="rounded-lg border border-destructive/30 p-4 space-y-2">
        <p className="font-medium">No pudimos {hasData ? 'actualizar' : 'cargar'} el libro de {codigo}</p>
        <p className="text-sm text-muted-foreground">{hasData
          ? 'Mostramos la última versión guardada. Puede faltar información reciente.'
          : 'Revisa tu conexión e inténtalo de nuevo. Tus datos no se han eliminado.'}</p>
        <Button variant="outline" onClick={onRetry} disabled={fetching}>{fetching ? 'Reintentando…' : 'Reintentar'}</Button>
      </div>
    ) : fetching ? <p role="status" className="text-sm text-muted-foreground">Actualizando el libro…</p>
      : !hasData ? <p role="status" className="rounded-md border p-4 text-sm">Este libro todavía no tiene información guardada. Puedes subir las bases para comenzar.</p> : null}
    {(!error || hasData) && children}
  </>;
}

/** The fallback remains a normal user-clicked link even if window.open is blocked. */
export function LibroDownloadFeedback({ download, error }: { download?: LibroDownload; error?: string }) {
  return <>
    {download && <div className="basis-full text-xs rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1" role="status">
      <p>Si no se abrió la descarga, usa este enlace. Vence en 5 minutos; puedes renovarlo.</p>
      <a href={download.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 font-medium text-primary underline"><Download className="h-4 w-4" />Descargar {download.nombre}</a>
    </div>}
    {error && <p role="alert" className="basis-full text-xs text-destructive">{error} Pulsa Descargar para reintentar.</p>}
  </>;
}
