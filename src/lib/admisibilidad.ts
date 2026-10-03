export interface RequisitoAdmisibilidad {
  entrada?: unknown;
  estado?: string;
  estado_origen?: 'humano';
  entrada_verificada?: string;
  chequeo?: { tipo?: string; esperado?: unknown; umbral?: unknown; umbral2?: unknown };
}

const texto = (value: unknown) => String(value ?? '').trim();
const ESTADOS_HUMANOS = new Set(['pendiente', 'cumple', 'ok', 'no_cumple', 'revisar', 'verificar', 'no_aplica', 'solo_si_adjudica']);
const ESTADOS_EXCEL: Record<string, string> = { pendiente: 'PENDIENTE', cumple: 'CUMPLE', ok: 'CUMPLE', no_cumple: 'NO CUMPLE', revisar: 'REVISAR', verificar: 'VERIFICAR', no_aplica: 'NO APLICA', solo_si_adjudica: 'SOLO SI ADJUDICA' };

// No extraer números de frases ni convertir texto sin dígitos en cero.
export function numeroAdmisibilidad(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const input = texto(value);
  // Una sola agrupación con tres cifras ("1.234", "0.001") puede ser
  // decimal o miles: no elegir una interpretación que acredite cumplimiento.
  if (/^-?\d+\.\d{3}$/.test(input)) return null;
  const chileno = /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)$/.test(input)
    || /^-?\d{1,3}(?:\.\d{3}){2,}$/.test(input);
  if (!chileno && !/^-?\d+(?:[.,]\d+)?$/.test(input)) return null;
  const normalized = (chileno ? input.replace(/\./g, '') : input).replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const respuesta = (value: unknown): 'SI' | 'NO' | null => /^s[ií]$/i.test(texto(value)) ? 'SI' : /^no$/i.test(texto(value)) ? 'NO' : null;

export function evaluarEntrada(r: RequisitoAdmisibilidad): string {
  const e = texto(r.entrada);
  if (!e) return 'pendiente';
  const ch = r.chequeo;
  if (!ch) return 'revisar';
  if (ch.tipo === 'si_no') {
    const esperado = respuesta(ch.esperado), valor = respuesta(e);
    return !esperado || !valor ? 'revisar' : valor === esperado ? 'cumple' : 'no_cumple';
  }
  const n = numeroAdmisibilidad(r.entrada), u = numeroAdmisibilidad(ch.umbral), u2 = numeroAdmisibilidad(ch.umbral2);
  if (n == null || u == null) return 'revisar';
  if (ch.tipo === 'minimo') return n >= u ? 'cumple' : 'no_cumple';
  if (ch.tipo === 'maximo') return n <= u ? 'cumple' : 'no_cumple';
  if (ch.tipo === 'rango' && u2 != null && u <= u2) return n >= u && n <= u2 ? 'cumple' : 'no_cumple';
  return 'revisar';
}

export function estadoAdmisibilidad(r: RequisitoAdmisibilidad): string {
  if (r.estado_origen === 'humano' && r.entrada_verificada === texto(r.entrada) && ESTADOS_HUMANOS.has(r.estado ?? '')) {
    if ((r.estado === 'cumple' || r.estado === 'ok') && !texto(r.entrada)) return 'pendiente';
    return r.estado!;
  }
  // Conservar bloqueos/decisiones previas y estados desconocidos; un "cumple"
  // sin trazabilidad no es prueba. El editor recalcula al cambiar la entrada.
  if (r.estado && r.estado !== 'cumple' && r.estado !== 'ok' && r.estado !== 'pendiente') return r.estado;
  return evaluarEntrada(r);
}

export function actualizarEntradaAdmisibilidad<T extends RequisitoAdmisibilidad>(r: T, entrada: string): T {
  // Un input HTML devuelve string incluso cuando el dato original es number.
  // Sin cambio de representación, preservar el tipo y la revisión originales.
  if (texto(entrada) === texto(r.entrada)) return { ...r };
  const changed = { ...r, entrada, estado_origen: undefined, entrada_verificada: undefined };
  return { ...changed, estado: evaluarEntrada(changed) };
}

export function confirmarEstadoAdmisibilidad<T extends RequisitoAdmisibilidad>(r: T, estado: string): T {
  return { ...r, estado, estado_origen: 'humano', entrada_verificada: texto(r.entrada) };
}

const literalExcel = (value: string) => `"${value.replace(/"/g, '""')}"`;

/** La exportación usa la misma evidencia explícita; texto libre no se vuelve
 * "CUMPLE" al abrir Excel. Una decisión humana caduca si cambia su entrada. */
export function formulaAdmisibilidad(r: RequisitoAdmisibilidad, celda: string): string {
  const ch = r.chequeo ?? {};
  const u = numeroAdmisibilidad(ch.umbral), u2 = numeroAdmisibilidad(ch.umbral2);
  let calculo = '"REVISAR"';
  const esperado = respuesta(ch.esperado);
  if (ch.tipo === 'si_no' && esperado) {
    const valor = `SUBSTITUTE(UPPER(TRIM(${celda})),"Í","I")`;
    calculo = `IF(OR(${valor}="SI",${valor}="NO"),IF(${valor}="${esperado}","CUMPLE","NO CUMPLE"),"REVISAR")`;
  } else if (u != null && (ch.tipo === 'minimo' || ch.tipo === 'maximo')) {
    calculo = `IF(ISNUMBER(${celda}),IF(${celda}${ch.tipo === 'minimo' ? '>=' : '<='}${u},"CUMPLE","NO CUMPLE"),"REVISAR")`;
  } else if (ch.tipo === 'rango' && u != null && u2 != null && u <= u2) {
    calculo = `IF(ISNUMBER(${celda}),IF(AND(${celda}>=${u},${celda}<=${u2}),"CUMPLE","NO CUMPLE"),"REVISAR")`;
  }
  const automatico = `IF(${celda}="","PENDIENTE",${calculo})`;
  const estado = estadoAdmisibilidad(r);
  const manual = r.estado_origen === 'humano' && r.entrada_verificada === texto(r.entrada);
  const conservado = r.estado && !['cumple', 'ok', 'pendiente'].includes(r.estado);
  if (manual || conservado) {
    // Excel recibe números reales para chequeos numéricos. Vincular la
    // revisión al mismo valor normalizado, no a su formato chileno original.
    const numeroEntrada = ['minimo', 'maximo', 'rango'].includes(ch.tipo ?? '') ? numeroAdmisibilidad(r.entrada) : null;
    const mismaEntrada = numeroEntrada != null ? `AND(ISNUMBER(${celda}),${celda}=${numeroEntrada})` : `TRIM(${celda}&"")=${literalExcel(texto(r.entrada))}`;
    return `IF(${mismaEntrada},${literalExcel(ESTADOS_EXCEL[estado] ?? estado.toUpperCase())},${automatico})`;
  }
  return automatico;
}
