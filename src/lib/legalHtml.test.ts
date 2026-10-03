import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MensajeLegal } from '../components/experto/MensajeLegal';
import { sanitizarHtmlLegal, urlCitaLegal } from './legalHtml';

describe('render legal seguro sin DOM', () => {
  it.each(['javascript:alert(1)', 'data:text/html,fixture', 'file:///tmp/fixture', '//example.invalid', '/relative', 'https://user:password@example.invalid', undefined, {}, true])('rechaza URL de cita %s', (url) => {
    expect(urlCitaLegal(url)).toBeNull();
  });
  it.each(['https://example.invalid/norma', 'http://example.invalid/norma'])('acepta URL %s', (url) => expect(urlCitaLegal(url)).toBe(url));
  it('sin DOM el HTML del experto se degrada a texto escapado', () => {
    expect(sanitizarHtmlLegal('<img src=x onerror="fixture()">')).not.toContain('<img');
  });
  it('el texto del usuario se renderiza como texto React, nunca como HTML', () => {
    const markup = renderToStaticMarkup(createElement(MensajeLegal, { rol: 'yo', texto: '<img src=x onerror="fixture()">\nConsulta [1]' }));
    expect(markup).not.toContain('<img');
    expect(markup).toContain('&lt;img');
    expect(markup).toContain('Consulta [1]');
  });
});
