import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMisPostulaciones, useOportunidadesNoTomadas, type HistoricoPostulacion } from './useHistoricoPostulaciones';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabaseClient: { rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'fixture-company-user' } }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: (config: unknown) => config }));
type FixtureQuery = { queryFn: () => Promise<HistoricoPostulacion[]> };

describe('RPC fixtures → estados de historial', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T12:00:00Z')); rpc.mockReset(); });
  afterEach(() => vi.useRealTimers());
  it('participación futura no se convierte en perdida y conserva estado de award', async () => {
    rpc.mockImplementation((name) => Promise.resolve({ data: name === 'mis_postulaciones_licitaciones' ? [{ codigo: 'FUTURE', tipo: 'licitacion', fecha_cierre: '2026-10-04', gano: false, estado_award: 'pending' }] : [], error: null }));
    const rows = await (useMisPostulaciones() as unknown as FixtureQuery).queryFn();
    expect(rows[0]).toMatchObject({ codigo: 'FUTURE', resultado: 'en_curso', estado_award: 'pending' });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('match abierto y compra ágil sin oferentes no se vuelven no-postuladas definitivas', async () => {
    rpc.mockResolvedValue({ data: [{ codigo: 'OPEN', tipo: 'licitacion', fecha_cierre: '2026-10-04' }, { codigo: 'CA', tipo: 'compra_agil', fecha_cierre: '2026-09-01', estado_award: 'active', ganador_nombre: 'Otro' }], error: null });
    const rows = await (useOportunidadesNoTomadas() as unknown as FixtureQuery).queryFn();
    expect(rows.map((r) => r.resultado)).toEqual(['abierta', 'sin_registro']);
  });
  it('licitación cerrada con adjudicación verificada y RUT excluido conserva sin_tomar', async () => {
    rpc.mockResolvedValue({ data: [{ codigo: 'CLOSED', tipo: 'licitacion', fecha_cierre: '2026-09-01', estado_award: 'active', ganador_nombre: 'Otro' }], error: null });
    expect((await (useOportunidadesNoTomadas() as unknown as FixtureQuery).queryFn())[0].resultado).toBe('sin_tomar');
  });
});
