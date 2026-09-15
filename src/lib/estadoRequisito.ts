// Estado de un requisito de la matriz de postulación (admisibilidad, evaluación, tareas).
// Un solo lugar para etiqueta y color: antes SalaPostulacion.tsx y MatrizPostulacion.tsx
// tenían cada uno su propio mapa (mismos 8 estados, definidos dos veces) y podían
// desincronizarse si se agregaba un estado nuevo en uno solo de los dos.
export const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  cumple: 'Cumple',
  ok: 'OK',
  no_cumple: 'No cumple',
  revisar: 'Revisar',
  verificar: 'Verificar',
  no_aplica: 'No aplica',
  solo_si_adjudica: 'Solo si adjudica',
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-muted text-muted-foreground',
  cumple: 'bg-green-100 text-green-800',
  ok: 'bg-green-100 text-green-800',
  no_cumple: 'bg-red-100 text-red-800',
  revisar: 'bg-yellow-100 text-yellow-800',
  verificar: 'bg-yellow-100 text-yellow-800',
  no_aplica: 'bg-muted text-muted-foreground',
  solo_si_adjudica: 'bg-blue-100 text-blue-800',
};

export function colorEstadoRequisito(e?: string): string {
  return ESTADO_COLOR[e ?? 'pendiente'] ?? ESTADO_COLOR.pendiente;
}

export function labelEstadoRequisito(e?: string): string {
  return ESTADO_LABEL[e ?? 'pendiente'] ?? ESTADO_LABEL.pendiente;
}
