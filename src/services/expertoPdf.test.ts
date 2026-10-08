/** © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { jsPDF } from 'jspdf';
import { crearPdfExperto } from './expertoPdf';

interface TextDraw {
  text: string;
  page: number;
  size: number;
  color: string;
  style: string;
  y: number;
}

const recorded = vi.hoisted(() => ({ draws: [] as TextDraw[] }));

// jsPDF serializes color channels with finite precision (45 may read as 44).
function expectColor(actual: string, expected: string) {
  for (const offset of [1, 3, 5]) {
    const difference = Math.abs(parseInt(actual.slice(offset, offset + 2), 16) - parseInt(expected.slice(offset, offset + 2), 16));
    expect(difference).toBeLessThanOrEqual(1);
  }
}

// Keep the real PDF renderer, font metrics and page layout. Record the state
// used for each draw so invisible white text cannot pass an extraction test.
vi.mock('jspdf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jspdf')>();
  return {
    ...actual,
    default: function (...args: ConstructorParameters<typeof jsPDF>) {
      const doc = new actual.jsPDF(...args);
      const text = doc.text.bind(doc);
      doc.text = (...textArgs: Parameters<typeof doc.text>) => {
        recorded.draws.push({
          text: String(textArgs[0]),
          page: doc.getCurrentPageInfo().pageNumber,
          size: doc.getFontSize(),
          color: doc.getTextColor(),
          style: doc.getFont().fontStyle,
          y: Number(textArgs[2]),
        });
        return text(...textArgs);
      };
      return doc;
    },
  };
});

beforeEach(() => {
  recorded.draws.length = 0;
  // No browser, external assets or customer information are needed.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No external assets in PDF test')));
});

afterEach(() => vi.unstubAllGlobals());

describe('crearPdfExperto pagination', () => {
  it.each([
    { label: 'paragraph', prefix: '', size: 10, color: '#2d2d2d', allBold: false },
    { label: 'list item', prefix: '- ', size: 10, color: '#2d2d2d', allBold: false },
    { label: 'subheading', prefix: '### ', size: 11, color: '#1b2540', allBold: true },
  ])('preserves text and header styles across pages in a $label', async ({ prefix, size, color, allBold }) => {
    const words = Array.from({ length: 900 }, (_, i) => `garantia${String(i).padStart(4, '0')}`);
    const content = words.map((word, i) => i % 7 === 0 ? `**${word}**` : word).join(' ');
    const blob = await crearPdfExperto({
      titulo: 'Prueba sintética de garantías',
      empresa: 'Empresa DEMO',
      fecha: '2026-10-08T12:00:00Z',
      contenido: `${prefix}${content}`,
    });

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(1000);
    const body = recorded.draws.filter((draw) => /^garantia\d{4}$/.test(draw.text));
    expect(body.map((draw) => draw.text)).toEqual(words);
    expect(new Set(body.map((draw) => draw.page)).size).toBeGreaterThanOrEqual(3);
    for (const [i, draw] of body.entries()) {
      expect(draw.size, `${draw.text} on page ${draw.page}`).toBe(size);
      expectColor(draw.color, color);
      expect(draw.color, `${draw.text} on page ${draw.page}`).toBe(body[0].color);
      expect(draw.style).toBe(allBold || i % 7 === 0 ? 'bold' : 'normal');
      expect(draw.y).toBeGreaterThanOrEqual(33);
      expect(draw.y).toBeLessThanOrEqual(273);
    }

    const headers = recorded.draws.filter((draw) => draw.text === 'Don Evaristo');
    const pages = Math.max(...recorded.draws.map((draw) => draw.page));
    expect(headers).toHaveLength(pages);
    for (const header of headers) {
      expect(header).toMatchObject({ color: '#ffffff', size: 11, style: 'bold', y: 11 });
    }
    const footers = recorded.draws.filter((draw) => draw.text === 'firmavb.cl · Hecho por Empresa DEMO con Don Evaristo');
    expect(footers).toHaveLength(pages);
    for (const footer of footers) {
      expectColor(footer.color, '#6e6e6e');
      expect(footer).toMatchObject({ size: 7.5, style: 'normal', y: 283 });
    }
  });
});
