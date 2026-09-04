// Enlaces "agregar a mi calendario" (Google, Outlook y archivo .ics) para el cierre
// de una oportunidad. No requiere que el cliente conecte cuentas: cada enlace abre
// su propio calendario con el evento ya completo.

export interface EventoCalendario {
  titulo: string;
  descripcion?: string;
  inicio: Date;
  fin: Date;
  ubicacion?: string;
  url?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha en formato UTC compacto que entienden Google y los archivos .ics: 20260904T150000Z */
export const fechaIcs = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export function urlGoogleCalendar(e: EventoCalendario): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${fechaIcs(e.inicio)}/${fechaIcs(e.fin)}`,
    details: e.descripcion ?? '',
  });
  if (e.ubicacion) p.set('location', e.ubicacion);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function urlOutlook(e: EventoCalendario): string {
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.titulo,
    startdt: e.inicio.toISOString(),
    enddt: e.fin.toISOString(),
    body: e.descripcion ?? '',
  });
  if (e.ubicacion) p.set('location', e.ubicacion);
  return `https://outlook.office.com/calendar/0/deeplink/compose?${p.toString()}`;
}

// Texto seguro para .ics: se escapan comas, punto y coma y saltos de línea.
const escIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Las líneas de un .ics no deben pasar de 75 caracteres: se cortan con espacio inicial.
const plegar = (linea: string) => {
  const partes: string[] = [];
  let resto = linea;
  while (resto.length > 73) { partes.push(resto.slice(0, 73)); resto = ' ' + resto.slice(73); }
  partes.push(resto);
  return partes.join('\r\n');
};

export function contenidoIcs(e: EventoCalendario, uid: string): string {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FirmaVB//Agile Bidder//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fechaIcs(new Date())}`,
    `DTSTART:${fechaIcs(e.inicio)}`,
    `DTEND:${fechaIcs(e.fin)}`,
    `SUMMARY:${escIcs(e.titulo)}`,
    e.descripcion ? `DESCRIPTION:${escIcs(e.descripcion)}` : '',
    e.ubicacion ? `LOCATION:${escIcs(e.ubicacion)}` : '',
    e.url ? `URL:${e.url}` : '',
    // Avisos: un día antes y dos horas antes del cierre.
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs('Mañana cierra: ' + e.titulo)}`, 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs('Cierra en 2 horas: ' + e.titulo)}`, 'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** Descarga el .ics (Apple Calendar, Outlook de escritorio, Thunderbird y cualquier otro). */
export function descargarIcs(e: EventoCalendario, archivo: string, uid: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenidoIcs(e, uid)], { type: 'text/calendar;charset=utf-8' }));
  a.download = archivo.endsWith('.ics') ? archivo : archivo + '.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
