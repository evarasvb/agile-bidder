import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ queryFn: null as null | (() => Promise<unknown>), responses: [] as unknown[] }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: {queryFn: () => Promise<unknown>}) => { mocks.queryFn = opts.queryFn; return {}; },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({}),
}));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'isolated-user' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => Promise.resolve(mocks.responses.shift()) }) }),
} }));
import { useCalendarioIntegrado } from './useCalendarioIntegrado';

describe('calendar source failures', () => {
  beforeEach(() => { mocks.responses = []; });
  it('propagates pipeline timeout instead of returning an empty calendar', async () => {
    const error = { code: '57014' };
    mocks.responses = [{ data: null, error }];
    useCalendarioIntegrado();
    await expect(mocks.queryFn!()).rejects.toEqual(error);
  });
  it('propagates manual event failure rather than showing an incomplete calendar', async () => {
    const error = { code: '500' };
    mocks.responses = [{ data: [], error: null }, { data: null, error }];
    useCalendarioIntegrado();
    await expect(mocks.queryFn!()).rejects.toEqual(error);
  });
  it('accepts successful empty sources after recovery', async () => {
    mocks.responses = [{ data: [], error: null }, { data: [], error: null }];
    useCalendarioIntegrado();
    await expect(mocks.queryFn!()).resolves.toEqual([]);
  });
});
