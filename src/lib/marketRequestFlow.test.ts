import { describe, expect, it, vi } from 'vitest';
import { registerLinkedMarketRequest } from './marketRequestFlow';

describe('Solicitud comunitaria y vínculo privado: recuperación de fallos parciales', () => {
  it('conserva la solicitud creada si falla el vínculo; el reintento solo vuelve a vincular', async () => {
    const create = vi.fn(async () => 'request-1');
    const onRegistered = vi.fn();
    const first = await registerLinkedMarketRequest({ create, link: async () => { throw new Error('network'); }, onRegistered });
    expect(first).toEqual({ status: 'registered', created: true, requestId: 'request-1' });
    expect(onRegistered).toHaveBeenCalledWith('request-1');
    const link = vi.fn(async () => 'request-1');
    expect(await registerLinkedMarketRequest({ registeredId: 'request-1', create, link, onRegistered })).toEqual({ status: 'linked', created: false, requestId: 'request-1' });
    expect(create).toHaveBeenCalledTimes(1);
    expect(link).toHaveBeenCalledWith('request-1');
  });
  it('no intenta vincular ni confirma éxito cuando no se pudo crear la solicitud', async () => {
    const link = vi.fn();
    const onRegistered = vi.fn();
    const result = await registerLinkedMarketRequest({ create: async () => null, link, onRegistered });
    expect(result.status).toBe('failed');
    expect(link).not.toHaveBeenCalled();
    expect(onRegistered).not.toHaveBeenCalled();
  });
});
