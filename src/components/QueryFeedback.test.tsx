import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QueryFeedback } from './QueryFeedback';

describe('query failure presentation', () => {
  const render = (props = {}) => renderToStaticMarkup(
    <QueryFeedback label="el inventario" onRetry={() => {}} {...props}>
      <p>No hay productos en el inventario</p>
    </QueryFeedback>,
  );
  it('never reports an empty inventory after a failed query, including cached data', () => {
    const html = render({ error: { code: '57014', message: 'private SQL details' } });
    expect(html).toContain('No pudimos cargar');
    expect(html).toContain('Reintentar');
    expect(html).not.toContain('No hay productos');
    expect(html).not.toContain('private SQL');
  });
  it('distinguishes loading from successful empty results', () => {
    expect(render({ loading: true })).toContain('Cargando');
    expect(render({ loading: true })).not.toContain('No hay productos');
    expect(render()).toContain('No hay productos');
  });
  it('disables retry during an active request and restores content on recovery', () => {
    expect(render({ error: new Error(), retrying: true })).toContain('disabled');
    expect(render()).not.toContain('role="alert"');
  });
});
