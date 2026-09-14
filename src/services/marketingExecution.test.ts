import { describe, expect, it, vi } from 'vitest';
import {
  claimEmailPiece,
  executeMarketingCampaign,
  getMarketingContactsPage,
  type AtomicClaimQuery,
  type ExecutionError,
  type ExecutionResult,
  type MarketingExecutionStore,
  type MarketingContactsQuery,
  type MarketingContactsTable,
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
    getContactsPage: async () => ({
      contacts: [{ id: contactId, email: 'test@example.com', nombre: 'Test' }],
      total: 1,
    }),
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

  it('exige una audiencia explícita, válida y sin IDs duplicados', async () => {
    const sendEmail = vi.fn(async () => ({ success: true, statusCode: 200 }));
    const store = createStore();

    const missing = await executeMarketingCampaign({ pieza_id: pieceId }, { store, sendEmail });
    const duplicated = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: [contactId, contactId] },
      { store, sendEmail },
    );

    expect(missing.status).toBe(400);
    expect(duplicated.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rechaza audiencias superiores a 1.000 contactos', async () => {
    const sendEmail = vi.fn(async () => ({ success: true, statusCode: 200 }));
    const store = createStore();
    const tooManyIds = Array.from(
      { length: 1001 },
      (_, index) => `33333333-3333-4333-8333-${index.toString(16).padStart(12, '0')}`,
    );

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: tooManyIds },
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
      executeMarketingCampaign({ pieza_id: pieceId, contactos_ids: [contactId] }, { store, sendEmail }),
      executeMarketingCampaign({ pieza_id: pieceId, contactos_ids: [contactId] }, { store, sendEmail }),
    ]);

    expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `marketing-${pieceId}-${contactId}`,
      }),
    );
  });

  it('no reclama ni envía piezas que no sean del canal email', async () => {
    const socialPiece: MarketingPiece = {
      ...piece,
      canal: 'facebook',
      tipo: 'social',
      estado: 'draft',
    };
    let storedState = socialPiece.estado;
    let nextState = storedState;
    const filters = new Map<string, string>();
    const query: AtomicClaimQuery = {
      update: vi.fn((values) => {
        nextState = values.estado;
        return query;
      }),
      eq: vi.fn((column, value) => {
        filters.set(column, value);
        return query;
      }),
      select: vi.fn(() => ({
        maybeSingle: async () => {
          const matches =
            filters.get('id') === socialPiece.id &&
            filters.get('estado') === storedState &&
            filters.get('canal') === socialPiece.canal;
          if (!matches) return { data: null, error: null };

          storedState = nextState;
          return { data: { ...socialPiece, estado: storedState }, error: null };
        },
      })),
    };
    const sendEmail = vi.fn(async () => ({ success: true, statusCode: 200 }));
    const store = createStore({
      claimPiece: (id) => claimEmailPiece(query, id),
    });

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: [contactId] },
      { store, sendEmail },
    );

    expect(outcome.status).toBe(409);
    expect(filters.get('canal')).toBe('email');
    expect(filters.get('estado')).toBe('draft');
    expect(storedState).toBe('draft');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('pagina la audiencia con orden estable y usa el total exacto', async () => {
    const contacts = [
      { id: contactId, email: 'one@example.com', nombre: 'One' },
      {
        id: '44444444-4444-4444-8444-444444444444',
        email: 'two@example.com',
        nombre: 'Two',
      },
      {
        id: '55555555-5555-4555-8555-555555555555',
        email: 'three@example.com',
        nombre: 'Three',
      },
    ];
    let selectedIds = contacts.map(({ id }) => id);
    const query: MarketingContactsQuery = {
      eq: vi.fn(() => query),
      in: vi.fn((_column, values) => {
        selectedIds = values;
        return query;
      }),
      order: vi.fn(() => query),
      range: vi.fn(async (from, to) => ({
        data: contacts.filter(({ id }) => selectedIds.includes(id)).slice(from, to + 1),
        error: null,
        count: contacts.filter(({ id }) => selectedIds.includes(id)).length,
      })),
    };
    const table: MarketingContactsTable = {
      select: vi.fn(() => query),
    };
    const getContactsPage = vi.fn((filters) => getMarketingContactsPage(table, filters));
    const store = createStore({ getContactsPage });

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: contacts.map(({ id }) => id) },
      {
        store,
        contactPageSize: 2,
        sendEmail: async () => ({ success: true, statusCode: 200 }),
      },
    );

    expect(outcome.status).toBe(200);
    expect(outcome.body as ExecutionResult).toMatchObject({
      total_objetivo: 3,
      total_procesados: 3,
      total_enviados: 3,
    });
    expect(table.select).toHaveBeenCalledWith('id, email, nombre', { count: 'exact' });
    expect(query.eq).toHaveBeenCalledWith('estado_suscripcion', 'suscrito');
    expect(query.in).toHaveBeenNthCalledWith(1, 'id', contacts.slice(0, 2).map(({ id }) => id));
    expect(query.in).toHaveBeenNthCalledWith(2, 'id', [contacts[2].id]);
    expect(query.order).toHaveBeenCalledWith('id', { ascending: true });
    expect(getContactsPage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ contactIds: contacts.slice(0, 2).map(({ id }) => id), from: 0, to: 1 }),
    );
    expect(getContactsPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ contactIds: [contacts[2].id], from: 0, to: 0 }),
    );
  });

  it('bloquea antes de enviar si la audiencia suscrita ya no coincide exactamente', async () => {
    const secondContactId = '44444444-4444-4444-8444-444444444444';
    const releasePieceClaim = vi.fn(async () => true);
    const sendEmail = vi.fn(async () => ({ success: true, statusCode: 200 }));
    const store = createStore({ releasePieceClaim });

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: [contactId, secondContactId] },
      { store, sendEmail },
    );

    expect(outcome).toMatchObject({ status: 500, body: { codigo: 'contacts_failed' } });
    expect(releasePieceClaim).toHaveBeenCalledWith(pieceId);
    expect(sendEmail).not.toHaveBeenCalled();
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
      { pieza_id: pieceId, contactos_ids: [contactId] },
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
      getContactsPage: async () => ({ contacts, total: contacts.length }),
      persistExecutions,
      markPieceExecuted,
    });

    const outcome = await executeMarketingCampaign(
      { pieza_id: pieceId, contactos_ids: contacts.map(({ id }) => id) },
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
