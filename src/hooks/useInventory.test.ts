import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ queryFn: null as null | (() => Promise<unknown>), rpc: vi.fn(), from: vi.fn(), chain: null as unknown }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: { queryFn: () => Promise<unknown> }) => { mocks.queryFn = opts.queryFn; return {}; },
  useMutation: () => ({}), useQueryClient: () => ({}),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-A' }, loading: false }) }));
vi.mock('@/lib/supabaseClient', () => ({ supabaseClient: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@/lib/matchRecalc', () => ({ recalcularMatchInventario: vi.fn() }));
import { useInventarioPagina, useInventarioResumen } from './useInventory';

describe('inventory queries', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('propagates owner lookup failure instead of declaring the inventory empty', async () => {
    const error = { code: '57014' };
    mocks.rpc.mockResolvedValue({ data: null, error });
    useInventarioPagina({ page: 1, pageSize: 100 });
    await expect(mocks.queryFn!()).rejects.toEqual(error);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('propagates a summary timeout', async () => {
    const error = { code: '57014' };
    mocks.rpc.mockResolvedValue({ data: null, error });
    useInventarioResumen();
    await expect(mocks.queryFn!()).rejects.toEqual(error);
  });
  it('keeps pagination and tenant filtering with explicit columns', async () => {
    mocks.rpc.mockResolvedValue({ data: 'tenant-A', error: null });
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain);
    chain.range.mockResolvedValue({ data: [], count: 16359, error: null });
    mocks.from.mockReturnValue(chain);
    useInventarioPagina({ page: 2, pageSize: 100 });
    await expect(mocks.queryFn!()).resolves.toEqual({ items: [], total: 16359 });
    expect(chain.eq).toHaveBeenCalledWith('cliente_id', 'tenant-A');
    expect(chain.range).toHaveBeenCalledWith(100, 199);
    expect(chain.select.mock.calls[0][0]).not.toContain('*');
    expect(chain.order).toHaveBeenCalledWith('id', { ascending: true });
  });
  it('propagates a page timeout without returning partial or empty rows', async () => {
    mocks.rpc.mockResolvedValue({ data: 'tenant-A', error: null });
    const chain = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); chain.order.mockReturnValue(chain);
    const error = { code: '57014' };
    chain.range.mockResolvedValue({ data: null, error });
    mocks.from.mockReturnValue(chain);
    useInventarioPagina({ page: 1, pageSize: 100 });
    await expect(mocks.queryFn!()).rejects.toEqual(error);
  });
});
