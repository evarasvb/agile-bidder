import { describe, expect, it } from 'vitest';
import { diasHabiles, fusionarPlan, isoDia, planAutomatico, planAIcs } from './planPostulacion';

const hoy = new Date(2026, 9, 2, 10); // viernes 2 de octubre de 2026
const ficha = {
  tipo: 'Licitación Pública',
  fecha_publicacion: '2026-10-01T17:35:27',
  fecha_cierre: '2026-11-16T15:30:00',
  fecha_adjudicacion: '2026-11-25T19:00:00',
  fechas_api: { FechaFinal: '2026-10-16T19:00:00', FechaPubRespuestas: '2026-10-23T19:00:00', FechaActoAperturaTecnica: '2026-11-16T15:35:00', FechaVisitaTerreno: null, FechaEntregaAntecedentes: null },
};

describe('planAutomatico', () => {
  it('arma los pasos del método con fechas hábiles antes del cierre', () => {
    const pasos = planAutomatico(ficha, hoy);
    const por = Object.fromEntries(pasos.map((p) => [p.id, p.fecha]));
    expect(pasos.map((p) => p.id)).toEqual(['decidir', 'matriz', 'foro', 'respuestas', 'bajo_agua', 'garantia', 'anexos', 'precio', 'envio', 'apertura', 'adjudicacion']);
    expect(por.foro).toBe('2026-10-15'); // un día hábil antes del fin de preguntas
    expect(por.respuestas).toBe('2026-10-23');
    expect(por.envio).toBe('2026-11-13'); // viernes: nunca el último día (el cierre es lunes 16)
    expect(por.anexos).toBe('2026-11-12');
    expect(por.garantia).toBe('2026-11-10');
    expect(por.adjudicacion).toBe('2026-11-26');
    expect(pasos.every((p) => !p.fecha || p.fecha >= isoDia(hoy))).toBe(true);
  });
  it('trae a hoy los pasos vencidos si la licitación sigue abierta', () => {
    const tarde = planAutomatico(ficha, new Date(2026, 9, 20, 10));
    expect(tarde.find((p) => p.id === 'foro')?.fecha).toBe('2026-10-20');
  });
  it('incluye visita y antecedentes solo cuando existen', () => {
    const conVisita = planAutomatico({ ...ficha, fechas_api: { ...ficha.fechas_api, FechaVisitaTerreno: '2026-10-09T10:00:00' } }, hoy);
    expect(conVisita.find((p) => p.id === 'visita')?.fecha).toBe('2026-10-09');
  });
  it('compra ágil: plan corto', () => {
    const pasos = planAutomatico({ tipo: 'Compra Ágil', fecha_publicacion: '2026-10-01', fecha_cierre: '2026-10-07T12:00:00' }, hoy);
    expect(pasos.map((p) => p.id)).toEqual(['decidir', 'precio', 'envio', 'resultado']);
    expect(pasos.find((p) => p.id === 'envio')?.fecha).toBe('2026-10-07');
  });
  it('sin ficha no hay plan', () => { expect(planAutomatico(null)).toEqual([]); });
});

describe('fusionarPlan', () => {
  it('conserva hecho, responsable, fechas manuales y pasos propios', () => {
    const auto = planAutomatico(ficha, hoy);
    const previos = auto.map((p) => p.id === 'foro' ? { ...p, hecho: true, responsable: 'Juan' } : p.id === 'envio' ? { ...p, fecha: '2026-11-10', fecha_manual: true } : p);
    previos.push({ id: 'm1', titulo: 'Certificado mutual', fecha: '2026-10-05', origen: 'manual', fecha_manual: true });
    const f = fusionarPlan(previos, planAutomatico(ficha, hoy));
    expect(f.find((p) => p.id === 'foro')).toMatchObject({ hecho: true, responsable: 'Juan' });
    expect(f.find((p) => p.id === 'envio')?.fecha).toBe('2026-11-10');
    expect(f.find((p) => p.id === 'm1')).toBeTruthy();
    expect(f[0].fecha! <= f[1].fecha!).toBe(true);
  });
});

describe('utilidades', () => {
  it('diasHabiles salta fines de semana', () => { expect(isoDia(diasHabiles(new Date(2026, 10, 16, 12), -1))).toBe('2026-11-13'); });
  it('ics con un evento por paso pendiente', () => {
    const ics = planAIcs('X-1', 'Prueba', [{ id: 'a', titulo: 'Foro, preguntas', fecha: '2026-10-15', origen: 'auto' }, { id: 'b', titulo: 'Listo', fecha: '2026-10-16', origen: 'auto', hecho: true }]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261015');
    expect(ics).toContain('SUMMARY:X-1: Foro\\, preguntas');
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(1);
  });
});
