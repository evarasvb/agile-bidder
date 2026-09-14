export interface ExecuteRequest {
  pieza_id: string;
  contactos_ids?: string[];
  categoria_filtro?: string;
}

export interface MarketingPiece {
  id: string;
  campana_id: string;
  contenido: string;
  asunto: string | null;
  tipo: string;
  canal: string;
  estado: string;
}

export interface MarketingContact {
  id: string;
  email: string;
  nombre: string | null;
}

export interface EmailSendResult {
  success: boolean;
  uncertain?: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

export interface MarketingExecutionRow {
  pieza_id: string;
  contacto_id: string;
  email: string;
  estado: 'enviado' | 'fallo' | 'pendiente';
  id_externo?: string;
  respuesta_codigo: number;
  respuesta_mensaje: string;
  fecha_envio: string;
}

export interface ExecutionResult {
  pieza_id: string;
  total_objetivo: number;
  total_procesados: number;
  total_enviados: number;
  total_exitosos: number;
  total_errores: number;
  total_inciertos: number;
  requiere_revision_manual: boolean;
  advertencias: string[];
  detalle: Array<{
    contacto_id: string;
    email: string;
    estado: 'enviado' | 'fallo' | 'incierto';
    error?: string;
  }>;
}

export interface ExecutionError {
  error: string;
  codigo: string;
  requiere_revision_manual?: boolean;
  resultado?: ExecutionResult;
}

export interface ExecutionOutcome {
  status: number;
  body: ExecutionResult | ExecutionError;
}

export interface ClaimResult {
  piece: MarketingPiece | null;
  failed?: boolean;
}

export interface MarketingExecutionStore {
  claimPiece(piezaId: string): Promise<ClaimResult>;
  releasePieceClaim(piezaId: string): Promise<boolean>;
  getContacts(filters: {
    contactIds?: string[];
    category?: string;
  }): Promise<MarketingContact[]>;
  persistExecutions(rows: MarketingExecutionRow[]): Promise<void>;
  markPieceExecuted(piezaId: string): Promise<void>;
  markCampaignExecuting(campaignId: string, updatedAt: string): Promise<void>;
  calculateMetrics(campaignId: string, date: string): Promise<void>;
}

export interface MarketingExecutionDependencies {
  store: MarketingExecutionStore;
  sendEmail(input: {
    to: string;
    subject: string;
    html: string;
    idempotencyKey: string;
  }): Promise<EmailSendResult>;
  now?: () => Date;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRequest(input: unknown): ExecuteRequest | null {
  if (!input || typeof input !== 'object') return null;

  const candidate = input as Record<string, unknown>;
  if (typeof candidate.pieza_id !== 'string' || !UUID_PATTERN.test(candidate.pieza_id)) {
    return null;
  }

  if (
    candidate.contactos_ids !== undefined &&
    (!Array.isArray(candidate.contactos_ids) ||
      candidate.contactos_ids.length === 0 ||
      candidate.contactos_ids.length > 1000 ||
      candidate.contactos_ids.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)))
  ) {
    return null;
  }

  if (
    candidate.categoria_filtro !== undefined &&
    (typeof candidate.categoria_filtro !== 'string' ||
      candidate.categoria_filtro.length === 0 ||
      candidate.categoria_filtro.length > 80)
  ) {
    return null;
  }

  return {
    pieza_id: candidate.pieza_id,
    contactos_ids: candidate.contactos_ids as string[] | undefined,
    categoria_filtro: candidate.categoria_filtro as string | undefined,
  };
}

export async function executeMarketingCampaign(
  input: unknown,
  dependencies: MarketingExecutionDependencies,
): Promise<ExecutionOutcome> {
  const request = parseRequest(input);
  if (!request) {
    return {
      status: 400,
      body: { error: 'Solicitud inválida', codigo: 'invalid_request' },
    };
  }

  let claim: ClaimResult;
  try {
    claim = await dependencies.store.claimPiece(request.pieza_id);
  } catch {
    claim = { piece: null, failed: true };
  }

  if (claim.failed) {
    return {
      status: 500,
      body: { error: 'No se pudo iniciar la ejecución', codigo: 'claim_failed' },
    };
  }

  if (!claim.piece) {
    return {
      status: 409,
      body: {
        error: 'La pieza ya fue reclamada o no está disponible',
        codigo: 'already_claimed',
      },
    };
  }

  const piece = claim.piece;
  let contacts: MarketingContact[];

  try {
    contacts = await dependencies.store.getContacts({
      contactIds: request.contactos_ids,
      category: request.categoria_filtro,
    });
  } catch {
    let released = false;
    try {
      released = await dependencies.store.releasePieceClaim(request.pieza_id);
    } catch {
      released = false;
    }

    return {
      status: 500,
      body: {
        error: 'No se pudieron obtener los contactos',
        codigo: 'contacts_failed',
        requiere_revision_manual: !released,
      },
    };
  }

  const now = dependencies.now ?? (() => new Date());
  const result: ExecutionResult = {
    pieza_id: request.pieza_id,
    total_objetivo: contacts.length,
    total_procesados: 0,
    total_enviados: 0,
    total_exitosos: 0,
    total_errores: 0,
    total_inciertos: 0,
    requiere_revision_manual: false,
    advertencias: [],
    detalle: [],
  };
  const executionRows: MarketingExecutionRow[] = [];

  for (const contact of contacts) {
    let emailResult: EmailSendResult;
    try {
      emailResult = await dependencies.sendEmail({
        to: contact.email,
        subject: piece.asunto || 'FirmaVB',
        html: piece.contenido,
        idempotencyKey: `marketing-${piece.id}-${contact.id}`,
      });
    } catch {
      emailResult = {
        success: false,
        uncertain: true,
        error: 'No se pudo confirmar la respuesta del proveedor',
      };
    }

    result.total_procesados++;
    const detailState = emailResult.success
      ? 'enviado'
      : emailResult.uncertain
        ? 'incierto'
        : 'fallo';
    const storedState = detailState === 'incierto' ? 'pendiente' : detailState;

    if (emailResult.success) {
      result.total_enviados++;
      result.total_exitosos++;
    } else if (emailResult.uncertain) {
      result.total_inciertos++;
      result.requiere_revision_manual = true;
    } else {
      result.total_errores++;
    }

    result.detalle.push({
      contacto_id: contact.id,
      email: contact.email,
      estado: detailState,
      error: emailResult.error,
    });
    executionRows.push({
      pieza_id: request.pieza_id,
      contacto_id: contact.id,
      email: contact.email,
      estado: storedState,
      id_externo: emailResult.messageId,
      respuesta_codigo: emailResult.statusCode ?? 0,
      respuesta_mensaje: emailResult.error || 'Enviado',
      fecha_envio: now().toISOString(),
    });
  }

  try {
    if (executionRows.length > 0) {
      await dependencies.store.persistExecutions(executionRows);
    }
  } catch {
    result.requiere_revision_manual = true;
    return {
      status: 500,
      body: {
        error: 'Los resultados no pudieron registrarse; no se reintentará automáticamente',
        codigo: 'persistence_failed',
        requiere_revision_manual: true,
        resultado: result,
      },
    };
  }

  if (result.total_inciertos > 0) {
    return { status: 202, body: result };
  }

  try {
    await dependencies.store.markPieceExecuted(request.pieza_id);
  } catch {
    result.requiere_revision_manual = true;
    return {
      status: 500,
      body: {
        error: 'Los resultados se registraron, pero la pieza no pudo cerrarse',
        codigo: 'piece_finalize_failed',
        requiere_revision_manual: true,
        resultado: result,
      },
    };
  }

  const updatedAt = now().toISOString();
  try {
    await dependencies.store.markCampaignExecuting(piece.campana_id, updatedAt);
  } catch {
    result.advertencias.push('No se pudo actualizar el estado de la campaña');
  }

  try {
    await dependencies.store.calculateMetrics(piece.campana_id, updatedAt.slice(0, 10));
  } catch {
    result.advertencias.push('No se pudieron recalcular las métricas');
  }

  return { status: 200, body: result };
}
