/**
 * Traduce el error de llamar a un asistente de IA (edge function) a una frase
 * clara para el usuario que no programa: nunca mostrar "Error 500" o un
 * código crudo. Hallazgo de la auditoría UX: los chats de Don Evaristo
 * Abogado y Don Experto mostraban el error técnico tal cual.
 *
 * Si el backend ya mandó un mensaje pensado para el usuario (401/402, con
 * `mensaje` o `error` en el cuerpo), se respeta tal cual — ya es amigable.
 */
export function mensajeErrorIA(e: unknown): string {
  const err = e as { message?: string; status?: number } | null;
  const status = err?.status;
  const texto = String(err?.message ?? '').toLowerCase();

  // 401/402: el backend ya arma un mensaje específico (límite de plan, etc.)
  if (status === 401 || status === 402) return err?.message || 'Necesitas iniciar sesión o actualizar tu plan para esto.';

  if (status === 429 || texto.includes('too many') || texto.includes('límite') || texto.includes('limite')) {
    return 'Alcanzaste el límite de consultas por ahora. Intenta de nuevo en unos minutos.';
  }
  if (texto.includes('failed to fetch') || texto.includes('network') || texto.includes('load failed')) {
    return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
  }
  if (status && status >= 500) return 'El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.';
  if (/^error \d+$/.test(texto) || texto.includes('ia_no_disponible') || texto.includes('sin_ia')) {
    return 'El asistente no está disponible en este momento. Intenta de nuevo en unos minutos.';
  }
  return err?.message && err.message.length < 140 ? err.message : 'No pudimos completar esto. Intenta de nuevo.';
}
