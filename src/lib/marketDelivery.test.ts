import { describe, expect, it, vi } from 'vitest';
import { deliverGroups } from '../../supabase/functions/mk-avisar-mensajes-email/delivery';

describe('marketplace notification delivery', () => {
  it('acknowledges only accepted deliveries and retains failures and missing recipients', async () => {
    const acknowledge = vi.fn();
    const send = vi.fn(async (email: string) => email === 'accepted@example.test');
    const result = await deliverGroups([
      { id: 'a', destino_email: 'accepted@example.test' },
      { id: 'b', destino_email: 'accepted@example.test' },
      { id: 'c', destino_email: 'failed@example.test' },
      { id: 'd', destino_email: null },
    ], send, acknowledge);
    expect(send).toHaveBeenCalledTimes(2);
    expect(acknowledge).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
    expect(result).toEqual({ avisos: 1, marcados: 2, pendientes: 2, fallos: 1 });
  });
  it('continues after transport failures without acknowledging failed messages', async () => {
    const acknowledge = vi.fn();
    const result = await deliverGroups([
      { id: 'a', destino_email: 'failed@example.test' },
      { id: 'b', destino_email: 'accepted@example.test' },
    ], async email => { if (email.startsWith('failed')) throw new Error('offline'); return true; }, acknowledge);
    expect(acknowledge).toHaveBeenCalledExactlyOnceWith(['b']);
    expect(result.pendientes).toBe(1);
  });
  it('does not mark anything when all sends fail, and surfaces acknowledgement failures', async () => {
    const pending = [{ id: 'a', destino_email: 'a@example.test' }];
    const acknowledge = vi.fn();
    await deliverGroups(pending, async () => false, acknowledge);
    expect(acknowledge).not.toHaveBeenCalled();
    await expect(deliverGroups(pending, async () => true, async () => { throw new Error('database unavailable'); })).rejects.toThrow('database unavailable');
  });
});
