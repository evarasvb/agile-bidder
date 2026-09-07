// Bases y anexos de la licitación: lo que el robot bajó de Mercado Público, con descarga
// (link firmado, requiere sesión) y botón para traerlos ahora si todavía no están.
import { Download, FileText, Loader2, Paperclip, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdjuntosLicitacion, useTraerAdjuntos } from '@/hooks/useAdjuntosLicitacion';

const tamano = (b?: number | null) => {
  if (!b) return null;
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

export function AdjuntosLicitacion({ codigo }: { codigo: string }) {
  const { data, isLoading } = useAdjuntosLicitacion(codigo);
  const traer = useTraerAdjuntos(codigo);
  const adjuntos = data?.adjuntos ?? [];

  const traerAhora = () =>
    traer.mutate(undefined, {
      onSuccess: (r) => {
        if (!r.encontrados) toast.info('Mercado Público no muestra anexos para esta licitación todavía.');
        else if (!r.nuevos) toast.info('Ya teníamos todos los anexos publicados.');
        else toast.success(`${r.nuevos} archivo${r.nuevos === 1 ? '' : 's'} nuevo${r.nuevos === 1 ? '' : 's'}${r.bases ? ` · ${r.bases} leído${r.bases === 1 ? '' : 's'} por el Experto` : ''}`);
        if (r.errores?.length) toast.warning(r.errores[0]);
      },
      onError: (e) => toast.error(e.message),
    });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" />Bases y anexos</CardTitle>
        <Button size="sm" variant="outline" onClick={traerAhora} disabled={traer.isPending}>
          {traer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          {adjuntos.length ? 'Buscar nuevos' : 'Traer desde Mercado Público'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : adjuntos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no bajamos las bases de esta licitación. Con el botón las traemos ahora mismo desde Mercado Público y el Experto las lee.
          </p>
        ) : (
          <ul className="space-y-2">
            {adjuntos.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="font-medium underline break-all">{a.nombre}</a>
                  ) : (
                    <span className="font-medium break-all" title="Inicia sesión para descargar">{a.nombre}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {[a.tipo, tamano(a.bytes), a.fecha_adjunto].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {a.es_bases && (
                  <Badge variant="secondary" className="shrink-0 gap-1"><Sparkles className="h-3 w-3" />Leído por el Experto</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        {data?.estado?.pendientes ? (
          <p className="text-xs text-muted-foreground mt-2">Quedan {data.estado.pendientes} archivo(s) por bajar; el robot sigue en la próxima pasada.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
