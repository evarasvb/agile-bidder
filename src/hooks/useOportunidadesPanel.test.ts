/**
 * © 2024-2026 Firma VB SpA. Todos los derechos reservados.
 * Software propietario - Prohibida reproducción o modificación.
 * Ley 19.912 - Protección de Derechos de Autor (Chile)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClienteFiltros } from './useClienteFiltros';
import type { OportunidadPanel, PanelFilters, PanelStats } from './useOportunidadesPanel';

type Result = { data: OportunidadPanel[]; stats: PanelStats };
type Options = {
  queryFn: () => Promise<Result>;
  placeholderData: (previous: Result, query: { queryKey: unknown[] }) => Result | undefined;
};
type Row = Record<string, unknown>;
type Operation = { name: string; args: unknown[] };
const mocks = vi.hoisted(() => ({
  options: null as Options | null,
  rpc: vi.fn(),
  from: vi.fn(),
  rows: {} as Record<string, Row[]>,
  failures: {} as Record<string, object>,
  filtros: {} as Partial<ClienteFiltros>,
  owner: "cliente-actual" as string | null,
  perfil: [] as string[],
  queries: [] as { table: string; operations: Operation[] }[],
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: Options) => { mocks.options = options; return {}; },
  useMutation: () => ({}), useQueryClient: () => ({}),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@/lib/supabaseClient', () => ({ supabaseClient: {} }));
vi.mock('./useAuth', () => ({ useAuth: () => ({}) }));
import { useOportunidadesPanel } from './useOportunidadesPanel';

const CODE = '9999999-999999-LE99';
const CA_CODE = '9999999-999999-COT99';
const LIC: Row = {
  id: 'synthetic-lic', codigo: CODE, nombre: 'Tóner sintético', descripcion: 'Solo prueba',
  estado: 'Publicada', fecha_cierre: '2099-12-31T00:00:00Z', fecha_publicacion: '2026-01-01T00:00:00Z',
  institucion_nombre: 'Organismo sintético', unidad_compra_region: 'Metropolitana',
  presupuesto_estimado: 1000, match_score: 10, match_encontrado: false,
};

async function query(filters: PanelFilters) {
  // useQuery is mocked above to capture options without mounting React.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useOportunidadesPanel(filters);
  return mocks.options!.queryFn();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows = { licitaciones_bi: [LIC], compras_agiles: [] };
  mocks.failures = {};
  mocks.filtros = {};
  mocks.owner = "cliente-actual";
  mocks.perfil = [];
  mocks.queries = [];
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === 'buscar_oportunidades'
      ? [{ codigo: CODE, tipo: 'licitacion', coincidencia: 'Tóner sintético' }]
      : name === 'cliente_owner_id' ? mocks.owner
      : name === 'cliente_afinidad' ? { afinidad: [], aversion: [] } : null,
    error: null,
  }));
  mocks.from.mockImplementation((table: string) => {
    const operations: Operation[] = [];
    const record = { table, operations };
    const chain: Record<string, unknown> = {};
    for (const name of ['select', 'order', 'eq', 'in', 'or', 'gt', 'gte', 'limit', 'maybeSingle', 'range']) {
      chain[name] = (...args: unknown[]) => { operations.push({ name, args }); return chain; };
    }
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      mocks.queries.push(record);
      if (table === 'cliente_filtros_oportunidades') {
        return Promise.resolve({ data: mocks.filtros, error: null }).then(resolve, reject);
      }
      if (table === 'clientes') return Promise.resolve({ data: { palabras_clave_busqueda: mocks.perfil }, error: null }).then(resolve, reject);
      let data = [...(mocks.rows[table] ?? [])];
      for (const { name, args } of operations) {
        if (name === 'range') data = data.slice(Number(args[0]), Number(args[1]) + 1);
        if (name === 'eq') data = data.filter(row => row[String(args[0])] === args[1]);
        if (name === 'in') data = data.filter(row => (args[1] as unknown[]).includes(row[String(args[0])]));
        if (name === 'gte') data = data.filter(row => row[String(args[0])] != null && row[String(args[0])]! >= args[1]!);
        if (name === 'gt') data = data.filter(row => String(row[String(args[0])] ?? '') > String(args[1]));
      }
      const head = operations.some(op => op.name === 'select' && (op.args[1] as { head?: boolean })?.head);
      return Promise.resolve({ data: head ? null : data, count: data.length, error: mocks.failures[table] ?? null }).then(resolve, reject);
    };
    return chain;
  });
});

describe('direct opportunity ID lookup', () => {
  it('retains an exact result despite every recommendation filter, without changing preferences', async () => {
    mocks.filtros = {
      palabras_incluir: ['muebles'], palabras_incluir_ia: ['escritorios'], palabras_excluir: ['toner'],
      regiones_activas: ['Valparaíso'], monto_min: 2000, monto_max: 3000,
    };
    const saved = structuredClone(mocks.filtros);
    const filters: PanelFilters = { search: `  ${CODE.toLowerCase()}  `, tipo: 'compra_agil', scoreMin: 90, estado: 'Adjudicada', institucion: 'Otro organismo' };
    const original = structuredClone(filters);
    const result = await query(filters);
    expect(result.data.map(row => row.codigo)).toEqual([CODE]);
    expect(result.stats.busqueda).toMatchObject({ codigoExacto: true, coincidencias: 1, ocultas: 0 });
    expect(mocks.filtros).toEqual(saved);
    expect(filters).toEqual(original);
    expect(mocks.rpc).not.toHaveBeenCalledWith('buscar_oportunidades', expect.anything());
    for (const table of ['compras_agiles', 'licitaciones_bi']) {
      const ops = mocks.queries.find(q => q.table === table)!.operations;
      expect(ops).toContainEqual({ name: 'eq', args: ['codigo', CODE] });
      expect(ops.some(op => op.name === 'gt' || op.name === 'or')).toBe(false);
    }
  });

  it('finds a closed purchase by its exact code while showing its real status', async () => {
    mocks.rows.licitaciones_bi = [];
    mocks.rows.compras_agiles = [{ ...LIC, codigo: CA_CODE, estado: 'Cerrada', fecha_cierre: '2001-01-01T00:00:00Z', compras_agiles_items: [] }];
    const result = await query({ search: CA_CODE, tipo: 'licitacion', scoreMin: 90 });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ codigo: CA_CODE, estado: 'Cerrada', tipo: 'compra_agil' });
    expect(result.stats.totalActivas).toBe(0);
  });

  it('does not count a revoked exact hit as active even before its scheduled deadline', async () => {
    mocks.rows.licitaciones_bi = [{ ...LIC, estado: 'Revocada', fecha_cierre: new Date(Date.now() + 86_400_000).toISOString() }];
    const result = await query({ search: CODE });
    expect(result.data[0].estado).toBe('Revocada');
    expect(result.stats).toMatchObject({ totalActivas: 0, cierranEstaSemana: 0 });
  });

  it('reports a successful direct lookup with no exact hit as empty', async () => {
    const result = await query({ search: '9999999-888888-LE99' });
    expect(result.data).toEqual([]);
    expect(result.stats.busqueda).toMatchObject({ codigoExacto: true, coincidencias: 0, ocultas: 0 });
  });

  it('propagates a tender lookup failure instead of claiming the exact ID does not exist', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = { code: '500', message: 'Synthetic unavailable' };
    mocks.failures.licitaciones_bi = error;
    await expect(query({ search: CODE })).rejects.toBe(error);
    vi.restoreAllMocks();
  });

  it('does not retain the previous ID result while a different search is loading', async () => {
    const previous = await query({ search: CODE });
    useOportunidadesPanel({ search: CA_CODE });
    expect(mocks.options!.placeholderData(previous, { queryKey: ['oportunidades-panel', { search: CODE }] })).toBeUndefined();
    expect(mocks.options!.placeholderData(previous, { queryKey: ['oportunidades-panel', { search: CA_CODE }] })).toBe(previous);
  });
});

describe('ordinary keyword filters stay unchanged', () => {
  it.each([
    { palabras_excluir: ['toner'] },
    { regiones_activas: ['Valparaíso'] },
    { monto_min: 2000 },
    { monto_max: 100 },
  ])('still applies saved %j', async filtros => {
    mocks.filtros = filtros;
    expect((await query({ search: 'toner' })).data).toEqual([]);
  });

  it.each([
    { tipo: 'compra_agil' as const },
    { scoreMin: 90 },
    { estado: 'Adjudicada' },
    { institucion: 'Otro organismo' },
  ])('still applies view %j', async filters => {
    expect((await query({ search: 'toner', ...filters })).data).toEqual([]);
  });

  it('continues letting explicit keywords override inclusion words only', async () => {
    mocks.filtros = { palabras_incluir: ['muebles'] };
    const result = await query({ search: 'toner' });
    expect(result.data.map(row => row.codigo)).toEqual([CODE]);
    expect(result.stats.busqueda?.codigoExacto).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith('buscar_oportunidades', { p_texto: 'toner', p_incluir_cerradas: false, p_limite: 200 });
  });

  it('treats text containing an ID as an ordinary filtered search', async () => {
    mocks.filtros = { palabras_excluir: ['toner'] };
    const result = await query({ search: `ver ${CODE}` });
    expect(result.data).toEqual([]);
    expect(result.stats.busqueda?.codigoExacto).toBe(false);
  });
});


describe('search profile and inventory coverage', () => {
  it('uses onboarding words before inventory is loaded, preserving other filters', async () => {
    mocks.perfil = ['tóner'];
    mocks.filtros = { palabras_incluir: null, regiones_activas: ['Metropolitana'] };
    const result = await query({});
    expect(result.data[0]).toMatchObject({ rubro_match: true, match_score: null, match_encontrado: false });
    expect(mocks.rpc).toHaveBeenCalledWith('buscar_oportunidades', expect.objectContaining({ p_texto: 'tóner' }));
    mocks.filtros.regiones_activas = ['Valparaíso'];
    expect((await query({})).data).toEqual([]);
  });

  it('keeps explicitly cleared inclusion words empty instead of restoring onboarding', async () => {
    mocks.perfil = ['tóner'];
    mocks.filtros = { palabras_incluir: [] };
    await query({});
    expect(mocks.rpc).not.toHaveBeenCalledWith('buscar_oportunidades', expect.anything());
  });

  it('never uses a shared tender score as a match for this company', async () => {
    mocks.rows.licitaciones_bi = [{ ...LIC, match_score: 100, match_encontrado: true }];
    const result = await query({});
    expect(result.data[0]).toMatchObject({ match_score: null, match_encontrado: false });
  });

  it('counts distinct compatible items from only the owner inventory, including low coverage', async () => {
    mocks.rows.licitaciones_bi = [{ ...LIC, licitaciones_bi_items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }];
    mocks.rows.lic_item_matches = [
      { cliente_id: mocks.owner, licitacion_codigo: CODE, item_id: 'a', score: 90 },
      { cliente_id: mocks.owner, licitacion_codigo: CODE, item_id: 'a', score: 90 },
      { cliente_id: 'otra-empresa', licitacion_codigo: CODE, item_id: 'b', score: 100 },
      { cliente_id: mocks.owner, licitacion_codigo: CODE, item_id: 'c', score: 10 },
    ];
    expect((await query({})).data[0]).toMatchObject({ match_score: 25, items_matched: 1, items_count: 4 });
  });

  it('keeps product similarity separate when purchase item coverage is unavailable', async () => {
    mocks.rows.licitaciones_bi = [];
    mocks.rows.compras_agiles = [{ ...LIC, codigo: CA_CODE, compras_agiles_items: [{ id: 'a' }] }];
    mocks.rows.ca_matches = [{ cliente_id: mocks.owner, compra_agil_codigo: CA_CODE, score: 95, fecha_cierre: LIC.fecha_cierre }];
    expect((await query({})).data[0]).toMatchObject({ match_score: null, match_similarity: 95, items_matched: 0 });
  });

  it('does not read any company matches when ownership cannot be resolved', async () => {
    mocks.owner = null;
    mocks.rows.licitaciones_bi = [{ ...LIC, match_score: 100, match_encontrado: true }];
    expect((await query({})).data[0].match_score).toBeNull();
    expect(mocks.queries.some(q => ['lic_item_matches', 'ca_item_matches', 'ca_matches'].includes(q.table))).toBe(false);
  });

  it('surfaces match retrieval failures rather than displaying global scores', async () => {
    mocks.failures.lic_item_matches = { message: 'Unavailable' };
    await expect(query({})).rejects.toEqual({ message: 'Unavailable' });
  });
});


describe('complete inventory match reads', () => {
  it('paginates beyond the first 500 tender matches', async () => {
    mocks.rows.licitaciones_bi = [{ ...LIC, licitaciones_bi_items: [{ id: 'last' }] }];
    mocks.rows.lic_item_matches = Array.from({ length: 500 }, (_, index) => ({
      cliente_id: mocks.owner, licitacion_codigo: 'other', item_id: `item-${index}`, score: 90,
    }));
    mocks.rows.lic_item_matches.push({ cliente_id: mocks.owner, licitacion_codigo: CODE, item_id: 'last', score: 90 });
    expect((await query({})).data[0]).toMatchObject({ match_score: 100, items_matched: 1 });
    expect(mocks.queries.filter(q => q.table === 'lic_item_matches')).toHaveLength(2);
  });
});
