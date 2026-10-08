/** © 2024-2026 Firma VB SpA. Todos los derechos reservados. Software propietario. */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { revisionPostulacion } from '@/lib/matrizReadiness';
import { SalaPostulacion, type SalaProps } from './SalaPostulacion';

const noop = () => {};
function props(): SalaProps {
  const p: SalaProps = {
    cod: '900001-1-LE26', ficha: { fecha_cierre: '2026-10-09T12:00:00Z' },
    bases: [{ id: 'synthetic-source', archivo: 'Bases.pdf', creado_en: '2026-10-07T10:00:00Z' }], documentos: [],
    informe: 'Informe sintético', anexos: 'Anexos sintéticos', faltantes: [], veredicto: null,
    matriz: { codigo: '900001-1-LE26', generada_en: '2026-10-07T11:00:00Z',
      admisibilidad: [{ entrada: 1, estado: 'cumple', fuente: 'Bases p. 3', chequeo: { tipo: 'minimo', umbral: 1 } }],
      evaluacion: [{ criterio: 'Prueba', fuente: 'Bases p. 4', ponderacion: '100%', puntaje_max: 100, puntaje_estimado: 80 }],
    },
    onGenerar: noop, onIr: noop, onMatriz: noop, onPreguntar: noop, aprobar: noop, ocupado: null,
  };
  p.matriz!.aprobacion = { en: '2026-10-07T12:00:00Z', revision: revisionPostulacion({ codigo: p.cod, matriz: p.matriz, bases: p.bases, documentos: p.documentos, cierre: p.ficha.fecha_cierre, informe: p.informe, anexos: p.anexos, faltantes: p.faltantes }) };
  return p;
}
describe('honest preparation labels', () => {
  afterEach(() => vi.useRealTimers());
  const render = (p: SalaProps) => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T12:00:00Z')); return renderToStaticMarkup(<SalaPostulacion {...p} />); };
  it('shows readiness only for the complete current package', () => expect(render(props())).toContain('Lista para postular'));
  it('never claims completion for an empty or unchecked matrix', () => {
    for (const rows of [[], [{ estado: 'verificar' }], [{ estado: 'unknown' }]]) {
      const p = props(); p.matriz!.admisibilidad = rows;
      const html = render(p);
      expect(html).not.toContain('Lista para postular');
      expect(html).not.toContain('Requisitos de admisibilidad revisados, sin pendientes.');
    }
  });
  it('does not display missing criteria as a known score or threshold success', () => {
    const p = props(); p.matriz!.evaluacion = []; p.matriz!.umbral_adjudicacion = 0;
    const html = render(p);
    expect(html).toContain('No hay un puntaje completo');
    expect(html).not.toContain('superas el umbral');
    expect(html).not.toContain('Lista para postular');
  });
  it('never shows a successful threshold comparison for a negative threshold', () => {
    const p = props(); p.matriz!.umbral_adjudicacion = -1;
    const html = render(p);
    expect(html).not.toContain('superas el umbral');
    expect(html).toContain('El umbral de adjudicación requiere revisión');
  });
  it('keeps real annex missing-fields visible even when placeholders are absent', () => {
    const p = props(); p.faltantes = ['Campo sintético'];
    const html = render(p);
    expect(html).toContain('1 campos por completar');
    expect(html).not.toContain('completos, listos para firmar');
    expect(html).not.toContain('Lista para postular');
  });
  it('blocks readiness for an expired tender, foreign source or invalid approval', () => {
    for (const change of [
      (p: SalaProps) => { p.ficha.fecha_cierre = '2026-10-08T11:59:59Z'; },
      (p: SalaProps) => { p.bases[0].archivo = 'PDF900002-2-LE26.pdf'; },
      (p: SalaProps) => { p.matriz!.aprobacion!.en = 'invalid'; },
    ]) { const p = props(); change(p); expect(render(p)).not.toContain('Lista para postular'); }
  });
});
