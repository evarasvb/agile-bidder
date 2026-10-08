/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { describe, expect, it, vi } from 'vitest';
import { createLibroActionScope, readLibroDownload, readLibroResult, readSavedPptx } from './libroRequests';

const codigo = '900001-1-LE26';
const base = 'https://synthetic-project.supabase.co';
const signedUrl = `${base}/storage/v1/object/sign/documentos-trabajo/owner/${codigo}/file.pptx?token=synthetic-token`;

describe('book response validation', () => {
  it('propagates RPC errors instead of treating them as an empty book', () => {
    const error = { code: '500', message: 'synthetic database failure' };
    expect(() => readLibroResult({ data: null, error }, codigo)).toThrow();
    expect(readLibroResult({ data: null, error: null }, codigo)).toBeNull();
    expect(readLibroResult({ data: { codigo, documentos: [] }, error: null }, codigo)).toEqual({ codigo, documentos: [] });
  });
  it('rejects another book or malformed payload', () => {
    for (const data of [{ codigo: '900002-2-LE26' }, {}, [], undefined]) {
      expect(() => readLibroResult({ data, error: null }, codigo)).toThrow('verificar');
    }
  });
  it('confirms PowerPoint success only for an actual saved document for this book', () => {
    const saved = { ok: true, codigo, documento_id: '00000000-0000-4000-8000-000000000001', nombre: `Matriz_${codigo}.pptx`, slides: 7 };
    expect(readSavedPptx(saved, codigo)).toEqual({ slides: 7 });
    for (const patch of [{ ok: false }, { documento_id: null }, { documento_id: 'null' }, { documento_id: '' }, { codigo: '900002-2-LE26' }, { nombre: 'wrong.pptx' }, { slides: 0 }, { slides: '7' }]) {
      expect(() => readSavedPptx({ ...saved, ...patch }, codigo)).toThrow('confirmar');
    }
    expect(() => readSavedPptx(null, codigo)).toThrow('confirmar');
  });
  it('accepts only a signed URL from the configured private document bucket', () => {
    expect(readLibroDownload({ ok: true, url: signedUrl, nombre: 'Archivo.pptx' }, base)).toEqual({ url: signedUrl, nombre: 'Archivo.pptx' });
    for (const url of ['javascript:alert(1)', signedUrl.replace(base, 'https://untrusted.example'), signedUrl.replace('/sign/', '/public/'), signedUrl.split('?')[0], signedUrl.replace('documentos-trabajo/', 'other-bucket/')]) {
      expect(() => readLibroDownload({ ok: true, url }, base)).toThrow('preparar la descarga');
    }
    expect(() => readLibroDownload({ ok: true, url: '' }, base)).toThrow();
  });
});

describe('book action lifecycle', () => {
  it('blocks double clicks before React rerenders, then allows retry after failure', () => {
    const scope = createLibroActionScope();
    const first = scope.start('pptx')!;
    expect(scope.start('pptx')).toBeNull();
    expect(first.finish()).toBe(true);
    const retry = scope.start('pptx')!;
    expect(retry).not.toBeNull();
    expect(first.isCurrent()).toBe(false);
    expect(first.finish()).toBe(false);
    expect(scope.start('pptx')).toBeNull();
    retry.finish();
  });
  it('cancels old downloads on navigation, including back to the same book', async () => {
    const oldScope = createLibroActionScope();
    const old = oldScope.start('descargar:doc')!;
    const publish = vi.fn();
    let resolve: (value: unknown) => void = () => {};
    const response = new Promise((done) => { resolve = done; });
    const lateCompletion = response.then((value) => {
      if (old.isCurrent()) publish(readLibroDownload(value, base));
    }).finally(() => old.finish());
    oldScope.close();
    expect(old.signal.aborted).toBe(true);
    // A -> B -> A creates a new request scope without resurrecting old requests.
    const returnedScope = createLibroActionScope();
    const current = returnedScope.start('descargar:doc')!;
    resolve({ ok: true, url: signedUrl });
    await lateCompletion;
    expect(publish).not.toHaveBeenCalled();
    expect(current.isCurrent()).toBe(true);
    expect(returnedScope.start('descargar:doc')).toBeNull();
    current.finish();
  });
  it('does not resurrect requests after effect cleanup/setup or unmount', () => {
    const scope = createLibroActionScope();
    const first = scope.start('pptx')!;
    scope.close();
    expect(scope.start('pptx')).toBeNull();
    scope.activate();
    const current = scope.start('pptx')!;
    expect(first.isCurrent()).toBe(false);
    expect(first.finish()).toBe(false);
    expect(current.isCurrent()).toBe(true);
    scope.close();
  });
  it('releases timed-out locks in finally and removes timers on success', () => {
    vi.useFakeTimers();
    try {
      const scope = createLibroActionScope();
      const slow = scope.start('download', 30_000)!;
      vi.advanceTimersByTime(30_000);
      expect(slow.signal.aborted).toBe(true);
      expect(slow.isCurrent()).toBe(true);
      slow.finish();
      const retry = scope.start('download', 30_000)!;
      retry.finish();
      vi.advanceTimersByTime(30_000);
      expect(retry.signal.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
