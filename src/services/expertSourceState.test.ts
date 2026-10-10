import { describe, expect, it, vi } from 'vitest';
import {
  readExpertSource, expertCriticalSourceReply, expertSourceWarning,
  hasDocumentSourceError, EXPERT_MISSING_SUMMARY_RULE, type ExpertSourceStates,
} from '../../supabase/functions/_shared/expertSourceState';

const ok = { estado: 'ok' as const };
const empty = { estado: 'empty' as const };
const error = { estado: 'error' as const };

describe('expert source state (pure, no network)', () => {
  it.each([null, undefined, [], '', {}])('distinguishes a successful empty result: %j', async data => {
    expect(await readExpertSource(async () => ({ data, error: null }))).toMatchObject({ state: empty });
  });

  it('normalizes an empty object so it cannot count as a present ficha', async () => {
    expect(await readExpertSource(async () => ({ data: {}, error: null }))).toEqual({ data: null, state: empty });
  });

  it.each([[{ archivo: 'bases.pdf' }], { codigo: '123-1-LE26' }, 0, false])('preserves successful nonempty data: %j', async data => {
    expect(await readExpertSource(async () => ({ data, error: null }))).toEqual({ data, state: { ...ok, ...(Array.isArray(data) ? { cantidad: data.length } : {}) } });
  });

  it('discards even partial data when the RPC resolves with an error', async () => {
    const project = vi.fn();
    const result = await readExpertSource(async () => ({ data: [{ texto: 'partial' }], error: { message: 'private SQL secret', code: '42501' } }), project);
    expect(result).toMatchObject({ data: null, state: { estado: 'error', conocimiento: 'desconocido' } });
    expect(result.state.mensaje).toContain('no es verificable');
    expect(JSON.stringify(result)).not.toMatch(/private|SQL|secret|42501/);
    expect(project).not.toHaveBeenCalled();
  });

  it.each(['sync', 'async', 'projection'])('records %s exceptions as error, never empty', async kind => {
    const operation = () => {
      if (kind === 'sync') throw new Error('private sync');
      if (kind === 'async') return Promise.reject(new Error('private async'));
      return Promise.resolve({ data: [1], error: null });
    };
    const result = await readExpertSource(operation, () => { throw new Error('private projection'); });
    expect(result).toMatchObject({ data: null, state: error });
    expect(JSON.stringify(result)).not.toContain('private');
  });

  it('classifies projected data only after checking error', async () => {
    const result = await readExpertSource(async () => ({ data: { conversaciones_recientes: [] }, error: null }), data => data.conversaciones_recientes);
    expect(result).toEqual({ data: [], state: { ...empty, cantidad: 0 } });
  });

  it.each(['ficha', 'bases', 'anexos'])('blocks assessment on a failed decisive source: %s', source => {
    const states = { ficha: ok, bases: ok, anexos: ok, [source]: error };
    expect(hasDocumentSourceError(states)).toBe(true);
    const text = expertCriticalSourceReply('123-1-LE26', states);
    expect(text).toContain('123-1-LE26');
    expect(text).toContain('desconocida y no verificable');
    expect(text).not.toMatch(/NO HAY BASES|Subir bases|documentación aparentemente completa/i);
  });

  it.each(['panorama', 'docs'])('does not mark documentation complete after %s fails', source => {
    expect(hasDocumentSourceError({ ficha: ok, bases: ok, anexos: ok, [source]: error })).toBe(true);
  });

  it.each([
    { ficha: ok, bases: empty, anexos: empty },
    { ficha: empty, bases: empty, anexos: empty },
    { ficha: ok, bases: ok, anexos: ok },
  ])('keeps successful empty and populated reads distinct from a technical error', states => {
    expect(expertCriticalSourceReply('123-1-LE26', states)).toBeNull();
    expect(hasDocumentSourceError(states)).toBe(false);
    expect(expertSourceWarning(states)).toBe('');
  });

  it('names failed sources without claiming that their records do not exist', () => {
    const states: ExpertSourceStates = { lic: error, normOr: error, normAnd: error, noticias: ok };
    const text = expertSourceWarning(states);
    expect(text).toContain('licitaciones abiertas; fuentes normativas');
    expect(text).not.toContain('noticias');
    expect(text).toContain('el error no confirma que no exista');
    expect(expertCriticalSourceReply(null, states)).toBeNull();
  });

  it('keeps missing summary fields unknown until the original clause supports a conclusion', () => {
    expect(EXPERT_MISSING_SUMMARY_RULE).toContain('no demuestra que no se exija');
    expect(EXPERT_MISSING_SUMMARY_RULE).toContain('cláusula o numeral del documento original');
    expect(EXPERT_MISSING_SUMMARY_RULE).toContain('no es verificable');
  });
});
