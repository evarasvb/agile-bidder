export type HistoricoResultado =
  | 'ganada' | 'perdida' | 'sin_tomar'
  | 'en_curso' | 'pendiente_resultado' | 'abierta' | 'sin_registro';

interface ResultadoProceso {
  tipo?: string;
  gano?: boolean | null;
  fecha_cierre?: string | null;
  estado_award?: string | null;
  ganador_nombre?: string | null;
}

// Solo estados afirmativos conocidos. Un dato desconocido, cancelado o
// pendiente nunca acredita una adjudicación definitiva.
const ADJUDICADA = new Set(['active', 'adjudicada', 'adjudicado', 'awarded']);

export function resultadoHistorico(row: ResultadoProceso, participo: boolean, ahora = Date.now()): HistoricoResultado {
  const cierre = row.fecha_cierre ? Date.parse(row.fecha_cierre) : NaN;
  if (Number.isFinite(cierre) && cierre > ahora) return participo ? 'en_curso' : 'abierta';

  // El RPC de compras propias devuelve OC ganadas, sin estado_award OCDS.
  if (participo && row.tipo !== 'licitacion' && row.tipo != null && row.gano === true) return 'ganada';

  const adjudicada = ADJUDICADA.has(row.estado_award?.trim().toLowerCase() ?? '');
  const cerrada = Number.isFinite(cierre) && cierre <= ahora;
  if (participo) {
    if (cerrada && adjudicada && row.gano === true) return 'ganada';
    if (cerrada && adjudicada && row.gano === false && row.ganador_nombre?.trim()) return 'perdida';
    return 'pendiente_resultado';
  }

  // En compra ágil no hay lista pública de oferentes: falta de registro
  // nunca demuestra que el cliente no postuló. El RPC de licitaciones sí
  // excluye su RUT de la lista de participantes.
  if (row.tipo === 'licitacion' && cerrada && adjudicada && row.ganador_nombre?.trim()) return 'sin_tomar';
  return 'sin_registro';
}

export function admiteAnalisisHistorico(resultado: HistoricoResultado): resultado is 'ganada' | 'perdida' | 'sin_tomar' {
  return resultado === 'ganada' || resultado === 'perdida' || resultado === 'sin_tomar';
}
