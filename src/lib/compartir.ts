// Resumen de una oportunidad listo para calendario, email o portapapeles.
import type { EventoCalendario } from './calendario';

export interface OportunidadCompartible {
  codigo: string;
  nombre?: string | null;
  tipo?: string | null; // 'compra_agil' | 'licitacion' | texto libre de Mercado Público
  organismo?: string | null;
  monto?: number | null;
  moneda?: string | null;
  fecha_cierre?: string | null;
  fecha_publicacion?: string | null;
  link?: string | null; // ficha en Mercado Público, si se conoce
  descripcion?: string | null;
}

export const esCompraAgil = (tipo?: string | null) => /agil|ágil/i.test(tipo ?? '');
export const etiquetaTipo = (tipo?: string | null) => (esCompraAgil(tipo) ? 'Compra Ágil' : 'Licitación');

export function linkMercadoPublico(o: OportunidadCompartible): string {
  if (o.link) return o.link;
  return esCompraAgil(o.tipo)
    ? `https://www.mercadopublico.cl/CompraAgil/Cotizacion/${o.codigo}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=${o.codigo}`;
}

export function linkFirmaVB(o: OportunidadCompartible): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.firmavb.cl';
  return `${origin}/oportunidades/${esCompraAgil(o.tipo) ? 'compra_agil' : 'licitacion'}/${o.codigo}`;
}

const fechaLarga = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('es-CL', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Santiago' });
};

const montoTexto = (o: OportunidadCompartible) => {
  if (o.monto == null || !(o.monto > 0)) return null;
  const moneda = (o.moneda ?? 'CLP').toUpperCase();
  return moneda === 'CLP'
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(o.monto)
    : `${new Intl.NumberFormat('es-CL').format(o.monto)} ${moneda}`;
};

/** Texto plano del resumen (lo mismo que va en el email y en el portapapeles). */
export function resumenOportunidad(o: OportunidadCompartible, extra?: string): string {
  const lineas = [
    `${etiquetaTipo(o.tipo)} ${o.codigo}`,
    o.nombre ? o.nombre : null,
    o.organismo ? `Organismo: ${o.organismo}` : null,
    montoTexto(o) ? `Presupuesto: ${montoTexto(o)}` : null,
    fechaLarga(o.fecha_publicacion) ? `Publicada: ${fechaLarga(o.fecha_publicacion)}` : null,
    fechaLarga(o.fecha_cierre) ? `Cierra: ${fechaLarga(o.fecha_cierre)}` : null,
    '',
    `Ficha en Mercado Público: ${linkMercadoPublico(o)}`,
    `Ver en FirmaVB: ${linkFirmaVB(o)}`,
  ];
  if (extra?.trim()) lineas.push('', extra.trim());
  lineas.push('', 'Enviado desde FirmaVB · www.firmavb.cl');
  return lineas.filter((l) => l !== null).join('\n');
}

export function asuntoOportunidad(o: OportunidadCompartible): string {
  const nombre = (o.nombre ?? '').trim();
  return `${etiquetaTipo(o.tipo)} ${o.codigo}${nombre ? ': ' + nombre.slice(0, 90) : ''}`;
}

/** mailto con asunto y cuerpo listos; el cliente solo pone el destinatario. */
export function mailtoOportunidad(o: OportunidadCompartible, extra?: string, para = ''): string {
  return `mailto:${para}?subject=${encodeURIComponent(asuntoOportunidad(o))}&body=${encodeURIComponent(resumenOportunidad(o, extra))}`;
}

/** Evento de calendario en la hora de cierre (30 minutos de duración). */
export function eventoCierre(o: OportunidadCompartible): EventoCalendario | null {
  if (!o.fecha_cierre) return null;
  const cierre = new Date(o.fecha_cierre);
  if (isNaN(cierre.getTime())) return null;
  const nombre = (o.nombre ?? '').trim().slice(0, 80);
  return {
    titulo: `Cierra ${etiquetaTipo(o.tipo)} ${o.codigo}${nombre ? ' · ' + nombre : ''}`,
    descripcion: resumenOportunidad(o),
    inicio: cierre,
    fin: new Date(cierre.getTime() + 30 * 60 * 1000),
    ubicacion: o.organismo ?? undefined,
    url: linkMercadoPublico(o),
  };
}
