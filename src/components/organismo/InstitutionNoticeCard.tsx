import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SavedInstitutionNotice } from '@/hooks/useInstitutionNotice';
import { noticeText, safeSourceUrl } from '@/lib/institutionFollowing';

/** The original receipt remains visible even if its source drops off the recent list. */
export function InstitutionNoticeCard({ notice }: { notice: SavedInstitutionNotice }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'start' });
    ref.current?.focus({ preventScroll: true });
  }, [notice.id]);
  const url = safeSourceUrl(notice.datos?.url);
  const date = new Date(notice.created_at);
  return (
    <section ref={ref} tabIndex={-1} aria-label="Evento del aviso" className="scroll-mt-20 rounded-lg focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="border-primary bg-primary/5">
        <CardHeader className="pb-2">
          <p className="text-xs font-semibold text-primary">El aviso que abriste</p>
          <CardTitle className="text-base break-words">
            {noticeText(notice.datos, 'titulo') || noticeText(notice.datos, 'licitacion_titulo') || 'Novedad de la institución'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm whitespace-pre-line break-words">{noticeText(notice.datos, 'detalle')}</p>
          <p className="text-xs text-muted-foreground">
            {!Number.isNaN(date.getTime()) && <>Aviso recibido el {date.toLocaleDateString('es-CL')}. </>}
            Las demás novedades de esta institución están más abajo.
          </p>
          {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline">
            Abrir fuente original <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>}
          {notice.licitacion_id && <Button asChild variant="outline">
            <Link to={`/oportunidades/${notice.datos?.tipo_oportunidad === 'compra_agil' ? 'compra_agil' : 'licitacion'}/${encodeURIComponent(notice.licitacion_id)}`}>Ver proceso del aviso</Link>
          </Button>}
        </CardContent>
      </Card>
    </section>
  );
}
