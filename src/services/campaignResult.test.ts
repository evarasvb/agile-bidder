import { describe, it, expect, vi } from 'vitest';
import { campaignAudience, normalizeCampaignResult as normalize, requestCampaign } from './campaignResult';
const counts = (sent = 2, failed = 0, unknown = 0) => ({ total_objetivo: sent + failed + unknown, total_procesados: sent + failed + unknown, total_enviados: sent, total_exitosos: sent, total_errores: failed, total_inciertos: unknown });
const id = '11111111-1111-4111-8111-111111111111';
describe('campaign result contract', () => {
  it.each([[2,0],[2,1],[0,0]])('accepts 200 sent=%i failed=%i', (sent, failed) => {
    const r = normalize(200, counts(sent, failed));
    expect(r.counts?.total_enviados).toBe(sent);
    expect(r.manualReview).toBe(false);
    expect(r.message.includes('No se envió ningún correo')).toBe(sent + failed === 0);
  });
  it.each([[2,1,1],[0,0,1]])('preserves 202 uncertainty', (sent, failed, unknown) => {
    const r = normalize(202, counts(sent, failed, unknown));
    expect(r.manualReview).toBe(true);
    expect(r.counts?.total_inciertos).toBe(unknown);
    expect(r.message).not.toContain('No se envió ningún correo');
  });
  it('409 is not retried', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', {status:409}));
    const r = await requestCampaign('/mock','test',id,[id],mock);
    expect(r.message).toContain('reclamada');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('distinguishes known pre-send failure from unknown server failure', () => {
    expect(normalize(500,{codigo:'contacts_failed'}).message).toContain('antes de iniciar');
    expect(normalize(500,{}).message).not.toContain('antes de iniciar');
  });
  it.each(['persistence_failed','piece_finalize_failed'])('preserves counts for %s', codigo => {
    const r=normalize(500,{codigo,resultado:counts(2,1)});
    expect(r.counts?.total_enviados).toBe(2);
    expect(r.manualReview).toBe(true);
  });
  it.each(['network','timeout'])('treats %s as uncertain without retry', async name => {
    const mock=vi.fn<typeof fetch>().mockRejectedValue(new Error(name));
    expect((await requestCampaign('/mock','test',id,[id],mock)).manualReview).toBe(true);
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('invalid JSON preserves HTTP status and uncertainty', async () => {
    const mock=vi.fn<typeof fetch>().mockResolvedValue(new Response('invalid',{status:202}));
    expect(await requestCampaign('/mock','test',id,[id],mock)).toMatchObject({status:202,manualReview:true});
  });
  it.each([{total_enviados:-1},{total_exitosos:3},{total_procesados:9},{total_objetivo:1},{total_inciertos:0.5}])('rejects invalid counts %o', overrides => {
    expect(normalize(200,{...counts(),...overrides})).toMatchObject({manualReview:true});
    expect(normalize(200,{...counts(),...overrides}).counts).toBeUndefined();
  });
  it('explicit audience keeps only subscribed IDs and request sends them', async () => {
    const audience=campaignAudience([{id,estado_suscripcion:'suscrito'},{id:'other',estado_suscripcion:'baja'}],true);
    expect(audience.ids).toEqual([id]);
    const mock=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(counts(1)),{status:200}));
    await requestCampaign('/mock','test',id,audience.ids,mock);
    expect(JSON.parse(String(mock.mock.calls[0][1]?.body))).toEqual({pieza_id:id,contactos_ids:[id]});
  });
  it('empty or unreliable audience is blocked', async () => {
    expect(campaignAudience([],true).error).toBeTruthy();
    expect(campaignAudience([{id,estado_suscripcion:'suscrito'}],false).ids).toEqual([]);
    const mock=vi.fn<typeof fetch>();
    await requestCampaign('/mock','test',id,[],mock);
    expect(mock).not.toHaveBeenCalled();
  });
});
