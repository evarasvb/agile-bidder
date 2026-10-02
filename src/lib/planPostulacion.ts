// Plan de postulación del Libro: pasos con fecha límite y responsable, calculados
// desde las fechas reales de Mercado Público (fin de preguntas, respuestas, cierre,
// apertura, adjudicación) con el método de Evaristo: decidir primero, preguntar en
// el foro por área, Bajo el Agua antes de fijar precio, garantía con tiempo, nunca
// postular el último día, y en la adjudicación leer el acta y aprender del precio.

export type IrPlan = 'informe' | 'matriz' | 'bajo_agua' | 'anexos' | 'postular';

export interface PasoPlan {
  id: string;
  titulo: string;
  detalle?: string;
  /** YYYY-MM-DD o null si no hay fecha de referencia. */
  fecha: string | null;
  responsable?: string;
  hecho?: boolean;
  hecho_en?: string | null;
  origen: 'auto' | 'manual';
  /** true cuando el usuario cambió la fecha a mano: no se recalcula. */
  fecha_manual?: boolean;
  ir?: IrPlan;
}

interface FichaFechas {
  tipo?: string | null;
  fecha_publicacion?: string | null;
  fecha_cierre?: string | null;
  fecha_adjudicacion?: string | null;
  fechas_api?: Record<string, string | null> | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Fecha local en YYYY-MM-DD (sin saltos por zona horaria). */
export const isoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hoyIso = () => isoDia(new Date());

export function aFecha(v?: string | null): Date | null {
  if (!v) return null;
  // Las fechas de la API vienen sin zona ("2026-11-16T15:30:00"): se leen como hora local de Chile.
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Suma (o resta) días hábiles de lunes a viernes. */
export function diasHabiles(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  const paso = n < 0 ? -1 : 1;
  let faltan = Math.abs(n);
  while (faltan > 0) {
    r.setDate(r.getDate() + paso);
    const dia = r.getDay();
    if (dia !== 0 && dia !== 6) faltan -= 1;
  }
  return r;
}

/** Días calendario entre hoy y una fecha YYYY-MM-DD (negativo si ya pasó). */
export function diasHasta(fecha: string | null, hoy: string = hoyIso()): number | null {
  const a = aFecha(fecha); const b = aFecha(hoy);
  if (!a || !b) return null;
  return Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86400000);
}

export function etiquetaPlazo(p: PasoPlan, hoy: string = hoyIso()): { texto: string; tono: 'ok' | 'hoy' | 'pronto' | 'vencido' | 'neutro' } {
  if (p.hecho) return { texto: 'Listo', tono: 'ok' };
  const n = diasHasta(p.fecha, hoy);
  if (n == null) return { texto: 'Sin fecha', tono: 'neutro' };
  if (n < 0) return { texto: n === -1 ? 'Venció ayer' : `Venció hace ${-n} días`, tono: 'vencido' };
  if (n === 0) return { texto: 'Hoy', tono: 'hoy' };
  if (n === 1) return { texto: 'Mañana', tono: 'pronto' };
  if (n <= 3) return { texto: `En ${n} días`, tono: 'pronto' };
  return { texto: `En ${n} días`, tono: 'neutro' };
}

/** Pasos automáticos según las fechas de la ficha. Las fechas ya vencidas de pasos pendientes se traen a hoy mientras la licitación siga abierta. */
export function planAutomatico(ficha: FichaFechas | null | undefined, hoy: Date = new Date()): PasoPlan[] {
  if (!ficha) return [];
  const fa = ficha.fechas_api ?? {};
  const pub = aFecha(ficha.fecha_publicacion) ?? aFecha(fa.FechaPublicacion);
  const cierre = aFecha(ficha.fecha_cierre) ?? aFecha(fa.FechaCierre);
  const finPreguntas = aFecha(fa.FechaFinal);
  const respuestas = aFecha(fa.FechaPubRespuestas);
  const visita = aFecha(fa.FechaVisitaTerreno);
  const antecedentes = aFecha(fa.FechaEntregaAntecedentes);
  const apertura = aFecha(fa.FechaActoAperturaTecnica) ?? aFecha(fa.FechaActoAperturaEconomica);
  const adjudicacion = aFecha(ficha.fecha_adjudicacion) ?? aFecha(fa.FechaAdjudicacion) ?? aFecha(fa.FechaEstimadaAdjudicacion);
  const esAgil = /gil/i.test(String(ficha.tipo ?? ''));
  const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12);
  const abierta = !cierre || cierre.getTime() >= hoy0.getTime();

  // Un paso pendiente no puede vencer antes de hoy si la licitación sigue abierta: si partiste tarde, es para hoy.
  const f = (d: Date | null): string | null => {
    if (!d) return null;
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
    if (abierta && dd.getTime() < hoy0.getTime()) return isoDia(hoy0);
    return isoDia(dd);
  };
  const antes = (d: Date | null, habiles: number): Date | null => (d ? diasHabiles(d, -habiles) : null);
  const maxD = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a.getTime() > b.getTime() ? a : b);
  const minD = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a.getTime() < b.getTime() ? a : b);
  const base = pub ?? hoy0;
  const paso = (id: string, titulo: string, detalle: string, fecha: Date | null, ir?: IrPlan): PasoPlan => ({ id, titulo, detalle, fecha: f(fecha), origen: 'auto', ir });

  if (esAgil) {
    return [
      paso('decidir', 'Decidir si vale la pena', 'Informe con veredicto: qué piden, cuánto pagan y si compites. Si dice descartar, no gastes más tiempo.', hoy0, 'informe'),
      paso('precio', 'Fijar precio y plazo de entrega', 'Revisa cómo paga el organismo y qué precio ganó antes. En compra ágil gana el precio con entrega creíble.', antes(cierre, 1), 'bajo_agua'),
      paso('envio', 'Enviar la cotización en Mercado Público', 'Sube la cotización con tiempo y guarda el comprobante. No esperes la última hora.', cierre, 'postular'),
      paso('resultado', 'Revisar el resultado y aceptar la orden de compra', 'Si ganaste, acepta la OC dentro del plazo y parte el protocolo de cobro (guía, factura y seguimiento). Si no, mira el precio ganador.', cierre ? diasHabiles(cierre, 3) : null),
    ];
  }

  const limitePreguntas = finPreguntas ? antes(finPreguntas, 1) : antes(cierre, 7);
  const pasos: PasoPlan[] = [
    paso('decidir', 'Decidir si vale la pena', 'Informe de trabajo con veredicto: postular, con reservas o descartar. Se decide antes de leer las bases completas.', minD(diasHabiles(base, 2), limitePreguntas), 'informe'),
    paso('matriz', 'Leer las bases y armar la matriz de postulación', 'Requisitos de admisibilidad, cómo se puntúa, anexos exigidos y garantías. Lo que no entiendas va al foro.', minD(diasHabiles(base, 3), limitePreguntas), 'matriz'),
    paso('foro', 'Preguntar en el foro por área', 'Una pregunta por área: técnica, administrativa, económica y forma de pago. Las respuestas son parte de las bases y te protegen después.', limitePreguntas),
  ];
  if (visita) pasos.push(paso('visita', 'Visita a terreno', 'Si las bases la exigen es obligatoria; si es opcional, igual sirve para medir el trabajo real.', visita));
  pasos.push(
    paso('respuestas', 'Leer las respuestas del foro y ajustar la oferta', 'Lee todas las respuestas, no solo las tuyas. Una aclaración puede cambiar precio, plazo o anexos.', respuestas ?? antes(cierre, 5)),
    paso('bajo_agua', 'Bajo el Agua antes de fijar el precio', 'Cómo paga el organismo, quién le gana y a qué precio, reclamos y compras paralelas. Con eso se fija precio y plazo.', maxD(respuestas ? diasHabiles(respuestas, 1) : null, antes(cierre, 5)), 'bajo_agua'),
    paso('garantia', 'Garantía de seriedad de la oferta', 'Si las bases la exigen, pídela al banco o aseguradora con anticipación: monto, beneficiario y vigencia exactos.', antes(cierre, 4)),
    paso('anexos', 'Anexos administrativos y técnicos firmados', 'Completa los anexos con los datos de la empresa, revísalos contra las bases y fírmalos. Nada en blanco.', antes(cierre, 2), 'anexos'),
    paso('precio', 'Cerrar la oferta económica', 'Precio y plazo definitivos con la información del foro y Bajo el Agua. Revisa que el precio cubra el tiempo de pago del organismo.', antes(cierre, 2)),
    paso('envio', 'Subir la oferta a Mercado Público', 'Carga todo en el orden del portal y guarda el comprobante. Nunca el último día: el portal se cae y el reloj no espera.', antes(cierre, 1), 'postular'),
  );
  if (antecedentes) pasos.push(paso('antecedentes', 'Entregar antecedentes físicos', 'Lleva los documentos en papel que piden las bases a la dirección y hora indicadas, con copia timbrada.', antecedentes));
  pasos.push(
    paso('apertura', 'Acto de apertura: confirmar que tu oferta quedó aceptada', 'Revisa en el portal que la oferta fue aceptada y qué otros proveedores postularon.', apertura ?? cierre),
    paso('adjudicacion', 'Adjudicación: leer el acta y actuar', 'Si ganaste, acepta la OC, prepara la garantía de fiel cumplimiento y parte el protocolo de cobro. Si no, pide el acta y aprende del precio ganador.', adjudicacion ? diasHabiles(adjudicacion, 1) : null),
  );
  return pasos;
}

/** Mezcla el plan guardado con el recalculado: conserva hecho, responsable, fechas manuales y pasos propios. */
export function fusionarPlan(previos: PasoPlan[], nuevos: PasoPlan[]): PasoPlan[] {
  const prev = new Map(previos.map((p) => [p.id, p]));
  const salida: PasoPlan[] = nuevos.map((n) => {
    const p = prev.get(n.id);
    if (!p) return n;
    return { ...n, hecho: p.hecho, hecho_en: p.hecho_en ?? null, responsable: p.responsable ?? '', fecha_manual: p.fecha_manual, fecha: p.fecha_manual ? p.fecha : n.fecha };
  });
  const ids = new Set(salida.map((p) => p.id));
  for (const p of previos) if (!ids.has(p.id) && (p.origen === 'manual' || p.hecho)) salida.push(p);
  return ordenarPlan(salida);
}

export function ordenarPlan(pasos: PasoPlan[]): PasoPlan[] {
  return pasos.map((p, i) => ({ p, i })).sort((a, b) => {
    if (a.p.fecha && b.p.fecha && a.p.fecha !== b.p.fecha) return a.p.fecha < b.p.fecha ? -1 : 1;
    if (!a.p.fecha !== !b.p.fecha) return a.p.fecha ? -1 : 1;
    return a.i - b.i;
  }).map((x) => x.p);
}

export function nuevoPasoManual(titulo: string, fecha: string | null): PasoPlan {
  return { id: 'm' + Date.now().toString(36), titulo: titulo.trim(), fecha, origen: 'manual', fecha_manual: true, responsable: '' };
}

const fechaCorta = (f: string | null) => { const d = aFecha(f); return d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}` : 's/f'; };

/** Texto para WhatsApp o correo interno del equipo. */
export function planATexto(cod: string, nombre: string | null | undefined, pasos: PasoPlan[]): string {
  const lineas = pasos.map((p) => `${p.hecho ? '✅' : '☐'} ${fechaCorta(p.fecha)} · ${p.titulo}${p.responsable ? ' · ' + p.responsable : ''}`);
  return [`Plan de postulación ${cod}${nombre ? ' · ' + nombre : ''}`, ...lineas, 'Hecho con FirmaVB'].join('\n');
}

/** Calendario .ics con un evento de día completo por paso pendiente (Google, Outlook, iPhone). */
export function planAIcs(cod: string, nombre: string | null | undefined, pasos: PasoPlan[]): string {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ev = pasos.filter((p) => p.fecha && !p.hecho).map((p) => {
    const d = p.fecha!.replace(/-/g, '');
    const sig = aFecha(p.fecha)!; sig.setDate(sig.getDate() + 1);
    return ['BEGIN:VEVENT', `UID:${cod}-${p.id}@firmavb.cl`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${isoDia(sig).replace(/-/g, '')}`,
      `SUMMARY:${esc(`${cod}: ${p.titulo}${p.responsable ? ' (' + p.responsable + ')' : ''}`)}`,
      `DESCRIPTION:${esc(`${nombre ?? ''}\n${p.detalle ?? ''}\nLibro: https://firmavb.cl/experto/libro/${cod}`)}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FirmaVB//Plan de postulacion//ES', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
