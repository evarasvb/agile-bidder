import { useMemo } from 'react';
import { sanitizarHtmlLegal, type FuenteLegal } from '@/lib/legalHtml';

interface Props { rol: 'yo' | 'exp'; texto: string; fuentes?: FuenteLegal[] }

export function MensajeLegal({ rol, texto, fuentes }: Props) {
  const html = useMemo(() => rol === 'exp' ? sanitizarHtmlLegal(texto || '…', fuentes) : '', [rol, texto, fuentes]);
  const className = `inline-block rounded-lg px-3 py-2 text-sm max-w-[85%] ${rol === 'yo' ? 'bg-primary text-primary-foreground whitespace-pre-wrap' : 'bg-muted'}`;
  return rol === 'yo'
    ? <div className={className}>{texto}</div>
    : <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
