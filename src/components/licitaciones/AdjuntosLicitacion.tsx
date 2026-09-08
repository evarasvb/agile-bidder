// Bases y anexos de la licitación. El robot baja lo que Mercado Público entrega sin captcha
// (botón "Ver Anexo": formularios y anexos); la sección "Adjuntos", donde suelen ir las bases
// en PDF, exige reCAPTCHA, así que se abre con un clic y el PDF se sube aquí: queda para todos
// y el Experto lo lee (texto + resumen) igual que en el Libro del Experto.
import { useRef } from 'react';
import { Download, ExternalLink, FileText, Loader2, Paperclip, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdjuntosLicitacion, useSubirBases, useTraerAdjuntos } from '@/hooks/useAdjuntosLicitacion';

const tamano = (b?: number | null) => {
  if (!b) return null;
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

export function AdjuntosLicitacion({ codigo }: { codigo: string }) {
  const { data, isLoading } = useAdjuntosLicitacion(codigo);
  const traer = useTraerAdjuntos(codigo);
  const subir = useSubirBases(codigo);
  const fileRef = useRef<HTMLInputElement>(null);
  const adjuntos = data?.adjuntos ?? [];
  const bases = data?.bases ?? [];
  const urlMp = data?.estado?.url_adjuntos_mp || data?.ficha_url || `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${codigo}`;
  const ocupado = traer.isPending || subir.isPending;

  const traerAhora = () =>
    traer.mutate(undefined, {
      onSuccess: (r) => {
        if (!r.encontrados) toast.info('Mercado Público solo publica los adjuntos de esta licitación en su sección con captcha. Ábrela con el botón y sube el PDF de las bases aquí.', { duration: 9000 });
        else if (!r.nuevos) toast.info('Ya teníamos todos los anexos publicados.');
        else toast.success(`${r.nuevos} archivo${r.nuevos === 1 ? '' : 's'} nuevo${r.nuevos === 1 ? '' : 's'}${r.bases ? ` · ${r.bases} leído${r.bases === 1 ? '' : 's'} por el Experto` : ''}`);
        if (r.errores?.length) toast.warning(r.errores[0]);
      },
      onError: (e) => toast.error(e.message),
    });

  const subirArchivos = (files: FileList | null) => {
    const lista = Array.from(files ?? []).filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!lista.length) { toast.error('Sube el PDF de las bases (formato .pdf).'); return; }
    lista.forEach((file) =>
      subir.mutate(file, {
        onSuccess: (r) => toast.success(`Bases leídas: ${file.name}${r.paginas ? ` (${r.paginas} páginas)` : ''}. Quedan disponibles para todos y el Experto ya las tiene.`),
        onError: (e) => toast.error(`${file.name}: ${e.message}`),
      }),
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" />Bases y anexos</CardTitle>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { subirArchivos(e.target.files); e.target.value = ''; }} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={ocupado} title="El PDF queda guardado para todos y el Experto lo lee">
            {subir.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}Subir bases (PDF)
          </Button>
          <Button size="sm" variant="outline" onClick={traerAhora} disabled={ocupado} title="Baja los anexos y formularios que Mercado Público entrega sin captcha">
            {traer.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            {adjuntos.length ? 'Buscar nuevos' : 'Traer anexos'}
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <a href={urlMp} target="_blank" rel="noopener noreferrer" title="Abre la sección Adjuntos de la ficha oficial (Mercado Público pide captcha)">
              <ExternalLink className="h-4 w-4 mr-1" />Adjuntos en Mercado Público
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium mb-1">Bases (PDF)</p>
              {bases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Mercado Público protege con captcha la sección donde publica las bases, así que el robot no puede bajarlas solo.
                  Ábrela con &quot;Adjuntos en Mercado Público&quot;, descarga el PDF y súbelo con &quot;Subir bases (PDF)&quot;: queda
                  guardado para todos y el Experto lo lee de inmediato.
                </p>
              ) : (
                <ul className="space-y-2">
                  {bases.map((b) => (
                    <li key={b.id} className="flex items-start gap-2 text-sm">
                      <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        {b.url ? (
                          <a href={b.url} target="_blank" rel="noopener noreferrer" className="font-medium underline break-all">{b.archivo}</a>
                        ) : (
                          <span className="font-medium break-all" title="Inicia sesión para descargar">{b.archivo}</span>
                        )}
                        <p className="text-xs text-muted-foreground">{[b.paginas ? `${b.paginas} pág.` : null, new Date(b.creado_en).toLocaleDateString('es-CL')].filter(Boolean).join(' · ')}</p>
                      </div>
                      {b.resumen_ok && (
                        <Badge variant="secondary" className="shrink-0 gap-1"><Sparkles className="h-3 w-3" />Leída por el Experto</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Anexos y formularios</p>
              {adjuntos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {data?.estado?.adjuntos_mp_solo_captcha
                    ? 'Esta licitación no tiene anexos en el botón "Ver Anexo" de la ficha; todo está en la sección con captcha.'
                    : 'Todavía no bajamos los anexos de esta licitación. Con "Traer anexos" los traemos ahora desde Mercado Público.'}
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
                        <p className="text-xs text-muted-foreground">{[a.tipo, tamano(a.bytes), a.fecha_adjunto].filter(Boolean).join(' · ')}</p>
                      </div>
                      {a.es_bases ? (
                        <Badge variant="secondary" className="shrink-0 gap-1"><Sparkles className="h-3 w-3" />Leído por el Experto</Badge>
                      ) : a.bases_pendiente ? (
                        <Badge variant="outline" className="shrink-0 gap-1"><Loader2 className="h-3 w-3 animate-spin" />El Experto lo está leyendo</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {data?.estado?.pendientes ? (
                <p className="text-xs text-muted-foreground mt-2">Quedan {data.estado.pendientes} archivo(s) por bajar; el robot sigue en la próxima pasada.</p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
