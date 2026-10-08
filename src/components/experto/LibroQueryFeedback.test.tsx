/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readLibroResult } from '@/lib/libroRequests';
import { LibroDownloadFeedback, LibroQueryFeedback } from './LibroQueryFeedback';

const codigo = '900001-1-LE26';
const key = ['experto_libro', codigo, 'synthetic-user'];
const content = <p>Contenido guardado del libro</p>;

function render(client: QueryClient, queryKey = key) {
  const state = client.getQueryState(queryKey);
  return renderToStaticMarkup(<LibroQueryFeedback codigo={String(queryKey[1])}
    loading={!state || state.status === 'pending'} fetching={state?.fetchStatus === 'fetching'}
    error={state?.error} hasData={!!state?.data} onRetry={() => {}}>{content}</LibroQueryFeedback>);
}

describe('book loading and recovery presentation', () => {
  it('distinguishes RPC 500, retrying and a legitimate empty result', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { status: 500, message: 'private SQL details' } });
    const queryFn = async () => readLibroResult(await rpc(), codigo);
    try {
      expect(render(client)).toContain('Cargando el libro');
      expect(render(client)).not.toContain('Contenido guardado');
      await expect(client.fetchQuery({ queryKey: key, queryFn })).rejects.toEqual({ status: 500, message: 'private SQL details' });
      const failed = render(client);
      expect(failed).toContain('No pudimos cargar');
      expect(failed).toContain('Reintentar');
      expect(failed).not.toContain('todavía no tiene información');
      expect(failed).not.toContain('Contenido guardado');
      expect(failed).not.toContain('private SQL');
      let resolve: (value: unknown) => void = () => {};
      rpc.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
      const retry = client.fetchQuery({ queryKey: key, queryFn });
      expect(render(client)).toContain('Cargando el libro');
      resolve({ data: null, error: null });
      await retry;
      const empty = render(client);
      expect(empty).toContain('todavía no tiene información guardada');
      expect(empty).not.toContain('No pudimos cargar');
      expect(rpc).toHaveBeenCalledTimes(2);
    } finally { client.clear(); }
  });
  it('preserves valid cached content after a refresh fails, with a visible warning', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(key, { codigo, documentos: [] });
    try {
      await expect(client.fetchQuery({ queryKey: key, queryFn: async () => readLibroResult({ data: null, error: new Error('private details') }, codigo) })).rejects.toThrow();
      const html = render(client);
      expect(html).toContain('No pudimos actualizar');
      expect(html).toContain('última versión guardada');
      expect(html).toContain('Contenido guardado');
      expect(html).not.toContain('todavía no tiene información');
      expect(html).not.toContain('private details');
    } finally { client.clear(); }
  });
  it('never shows another book or account cache while the current view is loading', () => {
    const client = new QueryClient();
    try {
      client.setQueryData(key, { codigo, documentos: [] });
      for (const nextKey of [['experto_libro', '900002-2-LE26', 'synthetic-user'], ['experto_libro', codigo, 'different-user']]) {
        expect(render(client, nextKey)).toContain('Cargando el libro');
        expect(render(client, nextKey)).not.toContain('Contenido guardado');
      }
    } finally { client.clear(); }
  });
  it('disables the retry button during a cached-data retry', () => {
    const html = renderToStaticMarkup(<LibroQueryFeedback codigo={codigo} loading={false} fetching error={new Error()} hasData onRetry={() => {}}>{content}</LibroQueryFeedback>);
    expect(html).toContain('Reintentando');
    expect(html).toContain('disabled');
    expect(html).toContain('Contenido guardado');
  });
});

describe('download fallback presentation', () => {
  it('renders a directly usable private download link with popup isolation and renewal guidance', () => {
    const url = 'https://synthetic-project.supabase.co/storage/v1/object/sign/documentos-trabajo/test.pptx?token=synthetic';
    const html = renderToStaticMarkup(<LibroDownloadFeedback download={{ url, nombre: 'Archivo de prueba.pptx' }} />);
    expect(html).toContain(`href="${url}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Descargar Archivo de prueba.pptx');
    expect(html).toContain('Si no se abrió');
    expect(html).toContain('5 minutos');
    expect(html).toContain('renovarlo');
    expect(html).not.toContain('descargado');
  });
  it('shows an actionable retry after download errors and never fabricates a link', () => {
    const html = renderToStaticMarkup(<LibroDownloadFeedback error="No pude preparar la descarga." />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Pulsa Descargar para reintentar');
    expect(html).not.toContain('href=');
    expect(renderToStaticMarkup(<LibroDownloadFeedback />)).toBe('');
  });
});

describe('book query navigation', () => {
  it('ignores a late response after switching books and isolates the next account', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let resolveOld: (data: { codigo: string }) => void = () => {};
    let resolveNext: (data: { codigo: string }) => void = () => {};
    const oldResponse = new Promise<{ codigo: string }>((resolve) => { resolveOld = resolve; });
    const nextResponse = new Promise<{ codigo: string }>((resolve) => { resolveNext = resolve; });
    const observer = new QueryObserver(client, { queryKey: key, queryFn: () => oldResponse });
    const unsubscribe = observer.subscribe(() => {});
    const nextCode = '900002-2-LE26';
    const nextKey = ['experto_libro', nextCode, 'synthetic-user'];
    try {
      observer.setOptions({ queryKey: nextKey, queryFn: () => nextResponse });
      resolveOld({ codigo });
      await vi.waitFor(() => expect(client.getQueryData(key)).toEqual({ codigo }));
      expect(observer.getCurrentResult().isPending).toBe(true);
      expect(observer.getCurrentResult().data).toBeUndefined();
      resolveNext({ codigo: nextCode });
      await vi.waitFor(() => expect(observer.getCurrentResult().data).toEqual({ codigo: nextCode }));
      observer.setOptions({ queryKey: ['experto_libro', nextCode, 'different-user'], queryFn: () => new Promise(() => {}) });
      expect(observer.getCurrentResult().data).toBeUndefined();
    } finally { unsubscribe(); client.clear(); }
  });
});
