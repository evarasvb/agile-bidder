import {
  isAcademyReversalStatus,
  validateAcademyPaymentIdentity,
  type AcademyPaymentRow,
  type VerifiedMercadoPagoMerchantOrder,
  type VerifiedMercadoPagoPayment,
} from '../mp-curso-webhook/logic.ts';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AcademyInboxProcessingError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable: boolean,
    public readonly haltsBatch = false,
  ) {
    super(code);
    this.name = 'AcademyInboxProcessingError';
  }
}

export function academyInboxRetryDelaySeconds(attempt: number): number {
  return Math.min(3_600, 30 * (2 ** Math.max(0, attempt - 1)));
}

export function academyInboxErrorDetails(error: unknown): {
  code: string;
  retryable: boolean;
  haltsBatch: boolean;
} {
  if (error instanceof AcademyInboxProcessingError) {
    return {
      code: error.code,
      retryable: error.retryable,
      haltsBatch: error.haltsBatch,
    };
  }
  return { code: 'unexpected_worker_error', retryable: true, haltsBatch: false };
}

export interface AcademyChargebackDependencies {
  fetchPayment(paymentId: string): Promise<VerifiedMercadoPagoPayment>;
  fetchMerchantOrder(orderId: string): Promise<VerifiedMercadoPagoMerchantOrder>;
  findPaymentRow(reference: string): Promise<AcademyPaymentRow | null>;
  revokeAccesses(input: {
    paymentId: string;
    mercadoPagoPaymentId: string;
    status: 'refunded' | 'charged_back' | 'cancelled';
  }): Promise<number>;
}

export async function processAcademyChargeback(
  paymentId: string,
  dependencies: AcademyChargebackDependencies,
): Promise<{ paymentReference: string; revoked: number }> {
  const payment = await dependencies.fetchPayment(paymentId);
  const orderId = String(payment.order?.id ?? '');
  if (!/^\d{1,32}$/.test(orderId)) {
    throw new AcademyInboxProcessingError('payment_order_pending', true);
  }

  const merchantOrder = await dependencies.fetchMerchantOrder(orderId);
  const paymentReference = String(merchantOrder.external_reference || '');
  if (!UUID_PATTERN.test(paymentReference)) {
    throw new AcademyInboxProcessingError('invalid_external_reference', false);
  }

  const row = await dependencies.findPaymentRow(paymentReference);
  if (!row) throw new AcademyInboxProcessingError('payment_row_pending', true);

  const identity = validateAcademyPaymentIdentity(payment, merchantOrder, row);
  if (!identity.ok) {
    throw new AcademyInboxProcessingError(
      identity.code,
      identity.code === 'payment_not_in_order',
    );
  }
  if (!isAcademyReversalStatus(payment.status)) {
    throw new AcademyInboxProcessingError('reversal_status_pending', true);
  }

  const revoked = await dependencies.revokeAccesses({
    paymentId: row.id,
    mercadoPagoPaymentId: String(payment.id),
    status: payment.status,
  });
  return { paymentReference: row.id, revoked };
}
