import { describe, expect, it } from 'vitest';
import { contenidoIcs, fechaIcs, urlGoogleCalendar, urlOutlook } from './calendario';
import { asuntoOportunidad, eventoCierre, linkMercadoPublico, mailtoOportunidad, resumenOportunidad } from './compartir';

const op = { codigo: '1234-56-LE26', nombre: 'Resmas de papel; carta y oficio', tipo: 'licitacion', organismo: 'Municipalidad de Talca', monto: 1500000, fecha_cierre: '2026-09-10T15:00:00.000Z', fecha_publicacion: '2026-09-01T12:00:00.000Z' };

describe('calendario y compartir', () => {
  it('arma el evento en la hora de cierre con 30 minutos', () => {
    const e = eventoCierre(op)!;
    expect(e.titulo).toContain('Cierra Licitación 1234-56-LE26');
    expect(fechaIcs(e.inicio)).toBe('20260910T150000Z');
    expect(fechaIcs(e.fin)).toBe('20260910T153000Z');
  });
  it('sin fecha de cierre no hay evento', () => {
    expect(eventoCierre({ ...op, fecha_cierre: null })).toBeNull();
  });
  it('genera enlaces de Google y Outlook con el rango correcto', () => {
    const e = eventoCierre(op)!;
    expect(urlGoogleCalendar(e)).toContain('dates=20260910T150000Z%2F20260910T153000Z');
    expect(urlOutlook(e)).toContain('startdt=2026-09-10T15%3A00%3A00.000Z');
  });
  it('el .ics escapa punto y coma y trae avisos', () => {
    const ics = contenidoIcs(eventoCierre(op)!, 'x@firmavb.cl');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20260910T150000Z');
    expect(ics).toContain('papel\\; carta');
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });
  it('resumen, asunto y mailto', () => {
    expect(asuntoOportunidad(op)).toBe('Licitación 1234-56-LE26: Resmas de papel; carta y oficio');
    const r = resumenOportunidad(op, 'Veredicto: postular');
    expect(r).toContain('Organismo: Municipalidad de Talca');
    expect(r).toContain('Presupuesto: $1.500.000');
    expect(r).toContain('Veredicto: postular');
    expect(mailtoOportunidad(op)).toMatch(/^mailto:\?subject=Licitaci%C3%B3n/);
    expect(linkMercadoPublico({ codigo: '999-1-COT26', tipo: 'compra_agil' })).toContain('CompraAgil/Cotizacion/999-1-COT26');
  });
});
