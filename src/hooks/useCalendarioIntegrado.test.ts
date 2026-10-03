import { describe, it, expect, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ queryFn: null as null | (() => Promise<unknown>), responses: [] as unknown[], staleTime: 0 }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: {queryFn: () => Promise<unknown>; staleTime: number}) => { mocks.queryFn = opts.queryFn; mocks.staleTime = opts.staleTime; return {}; },
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
  it('keeps a successful fetch fresh while allowing an explicit refresh', async () => {
    useCalendarioIntegrado();
    expect(mocks.staleTime).toBe(60_000);
    const { QueryClient, QueryObserver } = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
    const client = new QueryClient();
    let resolveRefresh!: (value: string[]) => void;
    let calls = 0;
    const observer = new QueryObserver(client, {
      queryKey: ['isolated-calendar-freshness'], staleTime: mocks.staleTime,
      queryFn: () => ++calls === 1 ? Promise.resolve(['event']) : new Promise<string[]>(resolve => { resolveRefresh = resolve; }),
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await observer.refetch();
      expect(observer.getCurrentResult()).toMatchObject({ isStale: false, isFetching: false, data: ['event'] });
      const refresh = observer.refetch();
      expect(observer.getCurrentResult()).toMatchObject({ isStale: false, isFetching: true, data: ['event'] });
      resolveRefresh(['updated-event']);
      await refresh;
      expect(observer.getCurrentResult()).toMatchObject({ isStale: false, isFetching: false, data: ['updated-event'] });
    } finally { unsubscribe(); client.clear(); }
  });
  it('accepts successful empty sources after recovery', async () => {
    mocks.responses = [{ data: [], error: null }, { data: [], error: null }];
    useCalendarioIntegrado();
    await expect(mocks.queryFn!()).resolves.toEqual([]);
  });
});
