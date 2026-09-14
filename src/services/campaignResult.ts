export interface CampaignCounts {
  total_objetivo: number;
  total_procesados: number;
  total_enviados: number;
  total_exitosos: number;
  total_errores: number;
  total_inciertos: number;
}
export interface CampaignOutcome {
  status: number | null;
  message: string;
  manualReview: boolean;
  counts?: CampaignCounts;
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const uncertain = (status: number | null): CampaignOutcome => ({ status, manualReview: true, message: 'No se pudo confirmar el resultado. Requiere revisión manual antes de volver a enviar.' });

export function normalizeCampaignResult(status: number, body: unknown): CampaignOutcome {
  if (!record(body)) return uncertain(status);
  if (status === 409) return { status, manualReview: true, message: 'La pieza ya fue reclamada o no está disponible. Revisa su estado; no vuelvas a enviarla.' };
  const source = status === 500 ? body.resultado : body;
  if (status === 500 && source === undefined) {
    const beforeSend = ['claim_failed', 'contacts_failed'].includes(String(body.codigo));
    return { status, manualReview: true, message: beforeSend ? 'La ejecución falló antes de iniciar los envíos. Revisa la pieza y la audiencia antes de intentar nuevamente.' : 'El servidor no pudo confirmar el resultado. Requiere revisión manual antes de volver a enviar.' };
  }
  if (![200, 202, 500].includes(status)) return status >= 500 ? uncertain(status) : { status, manualReview: false, message: 'La solicitud no pudo completarse. Revisa el acceso y los destinatarios antes de enviar.' };
  if (!record(source)) return uncertain(status);
  const keys = ['total_objetivo', 'total_procesados', 'total_enviados', 'total_exitosos', 'total_errores', 'total_inciertos'] as const;
  if (!keys.every(k => typeof source[k] === 'number' && Number.isSafeInteger(source[k]) && source[k] >= 0)) return uncertain(status);
  const counts = Object.fromEntries(keys.map(k => [k, source[k]])) as unknown as CampaignCounts;
  if (counts.total_enviados !== counts.total_exitosos || counts.total_procesados !== counts.total_enviados + counts.total_errores + counts.total_inciertos || counts.total_procesados > counts.total_objetivo) return uncertain(status);
  const manualReview = status !== 200 || body.requiere_revision_manual === true || source.requiere_revision_manual === true || counts.total_inciertos > 0 || counts.total_procesados < counts.total_objetivo;
  const zero = keys.every(k => counts[k] === 0);
  const warning = Array.isArray(source.advertencias) && source.advertencias.length > 0 ? ' Hay actualizaciones de estado o métricas pendientes de comprobar.' : '';
  return { status, counts, manualReview, message: `Objetivo: ${counts.total_objetivo}. Procesados: ${counts.total_procesados}. Confirmados por el proveedor: ${counts.total_enviados}. Fallidos: ${counts.total_errores}. Inciertos: ${counts.total_inciertos}. ${manualReview ? 'Requiere conciliación y revisión manual; no vuelvas a enviar.' : zero ? 'No se envió ningún correo.' : 'Aceptado por el proveedor no significa entregado.'}${warning}` };
}

export async function requestCampaign(url: string, token: string, piezaId: string, ids: string[], fetcher: typeof fetch = fetch): Promise<CampaignOutcome> {
  if (!token || ids.length === 0 || ids.length > 1000) return { status: null, manualReview: false, message: 'Envío bloqueado: revisa la sesión y selecciona entre 1 y 1.000 contactos suscritos.' };
  try {
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ pieza_id: piezaId, contactos_ids: ids }), signal: AbortSignal.timeout(60000) });
    try { return normalizeCampaignResult(response.status, await response.json()); }
    catch { return uncertain(response.status); }
  } catch { return uncertain(null); }
}

export function campaignAudience(contacts: ReadonlyArray<{ id: string; estado_suscripcion: string }>, reliable: boolean): { ids: string[]; error: string | null } {
  const ids = contacts.filter(c => c.estado_suscripcion === 'suscrito').map(c => c.id);
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!reliable || ids.some(id => !valid.test(id)) || new Set(ids).size !== ids.length) return { ids: [], error: 'No se pudo determinar una audiencia completa y confiable. Actualiza Gestión de Contactos.' };
  if (!ids.length || ids.length > 1000) return { ids: [], error: 'Selecciona con los filtros entre 1 y 1.000 contactos suscritos antes de enviar.' };
  return { ids, error: null };
}
