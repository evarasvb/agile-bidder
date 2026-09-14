import { describe, expect, it, vi } from 'vitest';
import {
  executeMarketingCampaign,
  type ExecutionError,
  type ExecutionResult,
  type MarketingExecutionStore,
  type MarketingPiece,
} from '../../supabase/functions/marketing-ejecutar/logic';

const pieceId = '11111111-1111-4111-8111-111111111111';
const campaignId = '22222222-2222-4222-8222-222222222222';
const contactId = '33333333-3333-4333-8333-333333333333';

const piece: MarketingPiece = {
  id: pieceId,
  campana_id: campaignId,
  contenido: '<p>Contenido de prueba</p>',
  asunto: 'Asunto de prueba',
  tipo: 'email',
  canal: 'email',
  estado: 'ejecutando',
};

function createStore(
  overrides: Partial<MarketingExecutionStore> = {},
): MarketingExecutionStore {
  return {
    claimPiece: async () => ({ piece }),
    releasePieceClaim: async () => true,
    getContacts: async () => [{ id: contactId, email: 'test@example.com', nombre: 'Test' }],
    persistExecutions: async () => undefined,
    markPieceExecuted: async () => undefined,
    markCampaignExecuting: async () => undefined,
    calculateMetrics: async () => undefined,
    ...overrides,
  };
}

describe('marketing-ejecutar', () => {
  it('rechaza una selección explícitamente vacía para no convertirla en envío masivo', async () => {
    const sendEmail = vi.fn(async () => ({ success: true, statusCode: 200 }));
    const store = createStore();

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: [] },
      { store, sendEmail },
    );

    expect(outcome.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('permite que solo una ejecución concurrente reclame y envíe la pieza', async () => {
    let state: 'draft' | 'ejecutando' = 'draft';
    const sendEmail = vi.fn(async () => ({ success: true, statusCode: 200 }));
    const store = createStore({
      claimPiece: async () => {
        if (state !== 'draft') return { piece: null };
        state = 'ejecutando';
        return { piece };
      },
    });

    const outcomes = await Promise.all([
      executeMarketingCampaign({ pieza_id: pieceId }, { store, sendEmail }),
      executeMarketingCampaign({ pieza_id: pieceId }, { store, sendEmail }),
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `marketing-${pieceId}-${contactId}`,
      }),
    );
  });

  it('no declara éxito ni cierra la pieza cuando falla la persistencia', async () => {
    const markPieceExecuted = vi.fn(async () => undefined);
    const store = createStore({
      persistExecutions: async () => {
        throw new Error('fallo simulado');
      },
      markPieceExecuted,
    });

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId },
      {
        store,
        sendEmail: async () => ({ success: true, statusCode: 200 }),
      },
    );

    expect(outcome.status).toBe(500);
    expect(outcome.body).toMatchObject({
      codigo: 'persistence_failed',
      requiere_revision_manual: true,
    });
    expect((outcome.body as ExecutionError).resultado).toMatchObject({
      total_objetivo: 1,
      total_procesados: 1,
      total_enviados: 1,
    });
    expect(markPieceExecuted).not.toHaveBeenCalled();
  });

  it('separa enviados, fallos confirmados y resultados inciertos sin reintentar', async () => {
    const contacts = [
      { id: contactId, email: 'ok@example.com', nombre: 'OK' },
      {
        id: '44444444-4444-4444-8444-444444444444',
        email: 'fail@example.com',
        nombre: 'Fail',
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        email: 'unknown@example.com',
        nombre: 'Unknown',
      },
    ];
    const persistExecutions = vi.fn(async () => undefined);
    const markPieceExecuted = vi.fn(async () => undefined);
    const sendEmail = vi.fn(async ({ to }: { to: string }) => {
      if (to === 'ok@example.com') return { success: true, statusCode: 200 };
      if (to === 'fail@example.com') {
        return { success: false, statusCode: 400, error: 'rechazado' };
      }
      return { success: false, uncertain: true, error: 'sin confirmación' };
    });
    const store = createStore({
      getContacts: async () => contacts,
      persistExecutions,
      markPieceExecuted,
    });

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId },
      { store, sendEmail },
    );

    expect(outcome.status).toBe(202);
    expect(outcome.body as ExecutionResult).toMatchObject({
      total_objetivo: 3,
      total_procesados: 3,
      total_enviados: 1,
      total_exitosos: 1,
      total_errores: 1,
      total_inciertos: 1,
      requiere_revision_manual: true,
    });
    expect(sendEmail).toHaveBeenCalledTimes(3);
    expect(persistExecutions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ email: 'ok@example.com', estado: 'enviado' }),
        expect.objectContaining({ email: 'fail@example.com', estado: 'fallo' }),
        expect.objectContaining({ email: 'unknown@example.com', estado: 'pendiente' }),
      ]),
    );
    expect(markPieceExecuted).not.toHaveBeenCalled();
  });
});
