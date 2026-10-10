import { describe, expect, it, vi } from 'vitest';
import { loadLiveContext, summarizeBusinessContext } from '../../supabase/functions/evaristo-soporte/businessContext';

describe('Evaristo: contexto operativo autorizado y honesto', () => {
  it('consulta las dos fuentes en paralelo y conserva la base si falla el marketplace', async () => {
    let resolveBase!: (value: { data: unknown; error: null }) => void;
    const rpc = vi.fn((name: string) => name === 'evaristo_contexto'
      ? new Promise<{ data: unknown; error: null }>(resolve => { resolveBase = resolve; })
      : Promise.resolve({ data: null, error: { message: 'RPC unavailable' } }));
    const pending = loadLiveContext(rpc, '4168-377-COT26');
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe('evaristo_negocio_contexto');
    resolveBase({ data: { inventario: { total: 12 } }, error: null });
    const context = await pending;
    expect(context.inventario).toEqual({ total: 12 });
    expect(context.negocio).toEqual({ estado: 'error' });
    expect(summarizeBusinessContext(context.negocio).join(' ')).toContain('no pude consultar');
  });
  it('un fallo de la base no elimina cotizaciones consultadas correctamente', async () => {
    const negocio = { marketplace: { estado: 'ok', solicitudes_enviadas: 2, solicitudes_recibidas: 0, pendientes: 1, cotizaciones_recibidas: 1, recientes: [] }, pipeline: { estado: 'ok', por_etapa: { preparacion: 1 }, proximas: [] } };
    const context = await loadLiveContext(async name => ({ data: name === 'evaristo_negocio_contexto' ? negocio : null, error: name === 'evaristo_contexto' ? { message: 'error' } : null }), null);
    expect(context.contexto_base_estado).toBe('error');
    expect(context.negocio).toEqual(negocio);
    const summary = summarizeBusinessContext(context.negocio).join(' ');
    expect(summary).toContain('cotización recibida');
    expect(summary).toContain('usuario actual');
    expect(summary).toContain('montos son estimados');
  });
  it('consulta fallida o sin sesión nunca se resume como cero solicitudes', async () => {
    const context = await loadLiveContext(async () => { throw new Error('network'); }, null);
    expect(summarizeBusinessContext(context.negocio).join(' ')).not.toContain('0 solicitudes');
    expect(summarizeBusinessContext({ estado: 'sin_sesion' }).join(' ')).toContain('no pude consultar');
  });
});
