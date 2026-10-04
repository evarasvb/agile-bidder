import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth } }));
import { chatIaRequest, CHAT_IA_UNAVAILABLE } from './chatIaTransport';
import { isChatLicitacion, isDocumentoLicitacion } from '@/hooks/useChatIA';
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://synthetic.invalid');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-fixture');
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'synthetic-jwt' } }, error: null });
});
describe('optional legacy ChatIA boundary', () => {
  it('does not turn a missing table into empty documents', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'PGRST205' }), { status: 404 }));
    await expect(chatIaRequest('documentos_licitacion', { select: 'id' })).rejects.toThrow(CHAT_IA_UNAVAILABLE);
  });
  it('does not request data or use an administrative key without a session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(chatIaRequest('chat_licitacion', {})).rejects.toThrow('No autenticado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('retains the current user JWT and encodes the tenant query', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { status: 200 }));
    expect(await chatIaRequest('chat_licitacion', { licitacion_id: 'eq.synthetic/code', user_id: 'eq.owner', limit: '1' })).toEqual([]);
    const [url, options] = fetchMock.mock.calls[0];
    expect(new URL(url).searchParams.get('user_id')).toBe('eq.owner');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer synthetic-jwt', apikey: 'public-fixture' });
  });
  it('handles a successful delete without JSON and does not leak backend errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await chatIaRequest('chat_licitacion', { id: 'eq.synthetic' }, { method: 'DELETE' })).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'private backend detail' }), { status: 403 }));
    await expect(chatIaRequest('chat_licitacion', {})).rejects.not.toThrow('private backend detail');
  });
  it('rejects malformed conversation data rather than asserting a fabricated schema', () => {
    expect(isChatLicitacion({ id: 'a', licitacion_id: 'b', created_at: 'c', updated_at: 'd', mensajes: [] })).toBe(true);
    expect(isChatLicitacion({ id: 'a', licitacion_id: 'b', created_at: 'c', updated_at: 'd', mensajes: [{ role: 'system', content: 'x', timestamp: 'y' }] })).toBe(false);
    expect(isDocumentoLicitacion({ id: 'a', status: 'ready' })).toBe(false);
  });
});
