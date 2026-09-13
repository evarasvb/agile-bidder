export type EstadoFuente = 'faltante' | 'pendiente' | 'parcial' | 'completa' | 'bloqueada';
export type NivelCompletitud = 'insuficiente' | 'parcial' | 'suficiente' | 'verificado';
export type DecisionExperto = 'participar' | 'participar_con_reservas' | 'estudiar' | 'asociarse' | 'descartar';

export interface FuenteExpediente {
  estado: EstadoFuente;
  requerida: boolean;
  peso: number;
  detalle?: string;
  fuenteId?: string;
  version?: string;
  obtenidoEn?: string;
}

export interface EntradaCompletitud {
  tipoProceso?: 'licitacion' | 'compra_agil' | 'convenio_marco' | 'otro';
  ficha: EstadoFuente;
  items: EstadoFuente;
  bases?: EstadoFuente;
  anexos?: EstadoFuente;
  aclaraciones?: EstadoFuente;
  modificaciones?: EstadoFuente;
  historial?: EstadoFuente;
  noticias?: EstadoFuente;
}

export interface CompletitudExpediente {
  nivel: NivelCompletitud;
  porcentaje: number;
  puedeEmitirVeredictoDefinitivo: boolean;
  fuentes: Record<string, FuenteExpediente>;
  faltantesCriticos: string[];
  advertencias: string[];
}

export interface DecisionLegacy {
  decision: DecisionExperto | null;
  etiqueta: string;
  clase: string;
  esEstructurada: false;
}

const VALOR: Record<EstadoFuente, number> = {
  faltante: 0,
  bloqueada: 0,
  pendiente: 0.2,
  parcial: 0.55,
  completa: 1,
};

const etiquetaFuente: Record<string, string> = {
  ficha: 'ficha del proceso',
  items: 'ítems y cantidades',
  bases: 'bases vigentes',
  anexos: 'anexos',
  aclaraciones: 'preguntas y aclaraciones',
  modificaciones: 'modificaciones posteriores',
  historial: 'historial de compras y adjudicaciones',
  noticias: 'señales y noticias',
};

export function evaluarCompletitudExpediente(input: EntradaCompletitud): CompletitudExpediente {
  const requiereBases = input.tipoProceso !== 'compra_agil';
  const fuentes: Record<string, FuenteExpediente> = {
    ficha: { estado: input.ficha, requerida: true, peso: 15 },
    items: { estado: input.items, requerida: true, peso: 15 },
    bases: { estado: input.bases ?? 'faltante', requerida: requiereBases, peso: requiereBases ? 25 : 0 },
    anexos: { estado: input.anexos ?? 'faltante', requerida: requiereBases, peso: requiereBases ? 15 : 0 },
    aclaraciones: { estado: input.aclaraciones ?? 'pendiente', requerida: false, peso: 8 },
    modificaciones: { estado: input.modificaciones ?? 'pendiente', requerida: requiereBases, peso: requiereBases ? 7 : 0 },
    historial: { estado: input.historial ?? 'pendiente', requerida: false, peso: requiereBases ? 10 : 18 },
    noticias: { estado: input.noticias ?? 'pendiente', requerida: false, peso: requiereBases ? 5 : 12 },
  };

  const pesoTotal = Object.values(fuentes).reduce((s, f) => s + f.peso, 0);
  const logrado = Object.values(fuentes).reduce((s, f) => s + f.peso * VALOR[f.estado], 0);
  const porcentaje = Math.round((logrado / Math.max(1, pesoTotal)) * 100);

  const faltantesCriticos = Object.entries(fuentes)
    .filter(([, f]) => f.requerida && ['faltante', 'bloqueada'].includes(f.estado))
    .map(([k, f]) => etiquetaFuente[k] + (f.estado === 'bloqueada' ? ' bloqueados' : ' faltantes'));

  const advertencias = Object.entries(fuentes)
    .filter(([, f]) => f.peso > 0 && ['pendiente', 'parcial'].includes(f.estado))
    .map(([k, f]) => etiquetaFuente[k] + (f.estado === 'parcial' ? ' incompletos' : ' pendientes de verificar'));

  const puedeEmitirVeredictoDefinitivo = faltantesCriticos.length === 0
    && fuentes.ficha.estado === 'completa'
    && fuentes.items.estado === 'completa'
    && (!requiereBases || (fuentes.bases.estado === 'completa' && fuentes.anexos.estado === 'completa'));

  let nivel: NivelCompletitud;
  if (!puedeEmitirVeredictoDefinitivo || porcentaje < 45) nivel = 'insuficiente';
  else if (porcentaje < 70) nivel = 'parcial';
  else if (porcentaje < 90 || advertencias.length > 0) nivel = 'suficiente';
  else nivel = 'verificado';

  return { nivel, porcentaje, puedeEmitirVeredictoDefinitivo, fuentes, faltantesCriticos, advertencias };
}

/**
 * Compatibilidad temporal con informes narrativos existentes.
 * Las decisiones nuevas deben llegar estructuradas desde el backend.
 */
export function extraerDecisionLegacy(informe?: string | null): DecisionLegacy {
  if (!informe) return { decision: null, etiqueta: 'Sin evaluación', clase: 'bg-muted text-foreground', esEstructurada: false };
  const texto = informe.slice(0, 3000).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const linea = texto.match(/veredicto[^\n]{0,240}/)?.[0]
    ?? texto.match(/vale la pena postular[^\n]{0,240}/)?.[0]
    ?? '';

  if (!linea) return { decision: null, etiqueta: 'Evaluar', clase: 'bg-muted text-foreground', esEstructurada: false };
  if (/con reservas|con condiciones|si corriges|depende/.test(linea)) {
    return { decision: 'participar_con_reservas', etiqueta: 'Postular con reservas', clase: 'bg-yellow-100 text-yellow-900 border-yellow-300', esEstructurada: false };
  }
  if (/\bno\b(?! hay atajos)/.test(linea) && !/\bsi\b/.test(linea.slice(0, linea.indexOf('no')))) {
    return { decision: 'descartar', etiqueta: 'Descartar', clase: 'bg-red-100 text-red-900 border-red-300', esEstructurada: false };
  }
  if (/\bsi\b|vale la pena/.test(linea)) {
    return { decision: 'participar', etiqueta: 'Postular', clase: 'bg-green-100 text-green-900 border-green-300', esEstructurada: false };
  }
  return { decision: 'estudiar', etiqueta: 'Evaluar', clase: 'bg-muted text-foreground', esEstructurada: false };
}
