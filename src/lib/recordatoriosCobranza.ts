// Secuencia de recordatorios de cobranza por días de atraso (respecto al
// vencimiento de la factura). Define el TONO sugerido para cada tramo. El envío
// real es un borrador en Gmail que el usuario revisa antes de mandar — ideal
// para deudores que son organismos del Estado, donde conviene cuidar la relación.
export interface TonoRecordatorio {
  clave: 'por_vencer' | 'amable' | 'firme' | 'prejudicial';
  label: string;
  clase: string;
  descripcion: string;
}

// Devuelve el tono sugerido según los días de atraso, o null si aún no amerita
// recordatorio (falta fecha, o faltan más de 3 días para el vencimiento).
export function tonoRecordatorio(dias: number | null): TonoRecordatorio | null {
  if (dias == null || dias < -3) return null;
  if (dias <= 0) return { clave: 'por_vencer', label: 'Por vencer', clase: 'bg-blue-100 text-blue-700', descripcion: 'Aviso amable: la factura está por vencer.' };
  if (dias <= 7) return { clave: 'amable', label: 'Recordatorio amable', clase: 'bg-amber-100 text-amber-700', descripcion: `Vencida hace ${dias} día${dias === 1 ? '' : 's'}.` };
  if (dias <= 15) return { clave: 'firme', label: 'Aviso firme', clase: 'bg-orange-100 text-orange-700', descripcion: `Atraso de ${dias} días: conviene insistir.` };
  return { clave: 'prejudicial', label: 'Aviso prejudicial', clase: 'bg-red-100 text-red-700', descripcion: `Atraso de ${dias} días: cobro de interés por mora y aviso prejudicial.` };
}
