/** Local-only execution of the real Deno handler. No live SDK, credentials or network. */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { vi } from 'vitest';
import * as businessContext from '../../../supabase/functions/evaristo-soporte/businessContext';
import * as bridge from '../../../supabase/functions/_shared/expertSupportBridge';
import * as safety from '../../../supabase/functions/_shared/evaristoSafety';

type Row = Record<string, unknown>;
type Operation = 'select' | 'insert' | 'update';
type Result = { data: Row | Row[] | null; error: { message: string } | null; count?: number };
type Filter = { column: string; operator: string; value: unknown };
export type Query = { table: string; operation: Operation; filters: Filter[]; payload?: Row | Row[]; columns?: string };
export type HarnessOptions = {
  conversations?: Row[];
  messages?: Row[];
  context?: Row;
  modelKey?: boolean;
  serviceKey?: boolean;
  authenticated?: boolean;
  fail?: { table: string; operation: Operation };
  fetchResults?: Array<Response | Error>;
};

function valueAt(row: Row, column: string): unknown {
  if (!column.includes('->>')) return row[column];
  const [parent, key] = column.split('->>');
  const value = row[parent];
  return value && typeof value === 'object' ? (value as Row)[key] : undefined;
}

function matches(row: Row, filter: Filter): boolean {
  const value = valueAt(row, filter.column);
  if (filter.operator === 'eq') return value === filter.value;
  if (filter.operator === 'is') return value == null && filter.value == null;
  if (filter.operator === 'not-is') return value != null;
  if (filter.operator === 'in') return (filter.value as unknown[]).includes(value);
  if (filter.operator === 'gte') return String(value ?? '') >= String(filter.value);
  throw new Error(`Unsupported mock filter: ${filter.operator}`);
}

export function createSupportHarness(options: HarnessOptions = {}) {
  const rows: Record<string, Row[]> = {
    evaristo_conversaciones: structuredClone(options.conversations ?? []),
    evaristo_mensajes: structuredClone(options.messages ?? []),
    evaristo_acciones: [],
  };
  const queries: Query[] = [];
  let nextId = 1;
  class QueryBuilder implements PromiseLike<Result> {
    query: Query;
    singleRow = false;
    maximum: number | undefined;
    sorting: { column: string; ascending: boolean } | undefined;
    countOnly = false;
    constructor(table: string) { this.query = { table, operation: 'select', filters: [] }; }
    select(columns: string, config?: { head?: boolean }) { this.query.columns = columns; this.countOnly = !!config?.head; return this; }
    insert(payload: Row | Row[]) { this.query.operation = 'insert'; this.query.payload = payload; return this; }
    update(payload: Row) { this.query.operation = 'update'; this.query.payload = payload; return this; }
    eq(column: string, value: unknown) { this.query.filters.push({ column, operator: 'eq', value }); return this; }
    is(column: string, value: unknown) { this.query.filters.push({ column, operator: 'is', value }); return this; }
    in(column: string, value: unknown[]) { this.query.filters.push({ column, operator: 'in', value }); return this; }
    not(column: string, operator: string, value: unknown) { this.query.filters.push({ column, operator: `not-${operator}`, value }); return this; }
    gte(column: string, value: unknown) { this.query.filters.push({ column, operator: 'gte', value }); return this; }
    order(column: string, config: { ascending: boolean }) { this.sorting = { column, ...config }; return this; }
    limit(maximum: number) { this.maximum = maximum; return this; }
    maybeSingle() { this.singleRow = true; return this; }
    single() { this.singleRow = true; return this; }
    execute(): Result {
      queries.push(structuredClone(this.query));
      const { table, operation, payload, filters } = this.query;
      if (!rows[table]) throw new Error(`Unexpected table ${table}`);
      if (options.fail?.table === table && options.fail.operation === operation) {
        return { data: null, error: { message: 'Synthetic storage failure; no live database used' } };
      }
      let selected = rows[table].filter(row => filters.every(filter => matches(row, filter)));
      if (operation === 'insert') {
        selected = (Array.isArray(payload) ? payload : [payload ?? {}]).map(row => ({ id: `saved-${nextId++}`, ...structuredClone(row) }));
        rows[table].push(...selected);
      } else if (operation === 'update') {
        for (const row of selected) Object.assign(row, structuredClone(payload));
      }
      if (this.sorting) {
        const { column, ascending } = this.sorting;
        selected = [...selected].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
      }
      if (this.maximum != null) selected = selected.slice(0, this.maximum);
      return { data: this.countOnly ? null : structuredClone(this.singleRow ? selected[0] ?? null : selected), error: null, count: selected.length };
    }
    then<TResult1 = Result, TResult2 = never>(onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
    }
  }
  const rpc = vi.fn(async (name: string, _args: Row) => {
    if (name === 'evaristo_contexto') return { data: options.context ?? {}, error: null };
    if (name === 'evaristo_acciones_recientes') return { data: [], error: null };
    throw new Error(`Unexpected RPC ${name}`);
  });
  const sdk = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner-1', email: 'owner@example.test' } } })) },
    from: (table: string) => new QueryBuilder(table),
    rpc,
  };
  const fetchResults = [...(options.fetchResults ?? [])];
  const fetchMock = vi.fn(async (_input: string, _init?: RequestInit): Promise<Response> => {
    const response = fetchResults.shift();
    if (response instanceof Error) throw response;
    if (!response) throw new Error('Unexpected fetch; network disabled in handler tests');
    return response;
  });
  const env: Record<string, string | undefined> = {
    SUPABASE_URL: 'https://mock-supabase.invalid', SUPABASE_ANON_KEY: 'synthetic-anon',
    GEMINI_API_KEY: options.modelKey === false ? undefined : 'synthetic-model',
    SUPABASE_SERVICE_ROLE_KEY: options.serviceKey ? 'synthetic-service' : undefined,
  };
  let source = readFileSync(new URL('../../../supabase/functions/evaristo-soporte/index.ts', import.meta.url), 'utf8');
  const parsed = ts.createSourceFile('handler.ts', source, ts.ScriptTarget.Latest, true);
  for (const statement of [...parsed.statements].reverse()) {
    if (ts.isImportDeclaration(statement)) source = source.slice(0, statement.getStart(parsed)) + source.slice(statement.end);
  }
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  let handler: ((request: Request) => Promise<Response>) | undefined;
  runInNewContext(compiled, {
    ...safety, ...bridge, ...businessContext,
    handleExpertRequest: async (request: Request, opts: { persistConversation: boolean }) => {
      if (opts.persistConversation !== false) throw new Error('Support must not save a duplicate Expert turn');
      return fetchMock(request.url, { method: request.method, headers: Object.fromEntries(request.headers), body: await request.text(), signal: request.signal });
    },
    serve: (callback: typeof handler) => { handler = callback; },
    createClient: vi.fn(() => sdk),
    Deno: { env: { get: (name: string) => env[name] } },
    fetch: fetchMock, Response, Request, Headers, crypto: { randomUUID }, atob,
    console: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
  }, { filename: 'evaristo-soporte.mocked.js', timeout: 1000 });
  if (!handler) throw new Error('Real handler did not register through serve');
  const run = async (body: Row) => {
    const token = `synthetic.${Buffer.from(JSON.stringify({ role: 'authenticated' })).toString('base64url')}.synthetic`;
    const response = await handler!(new Request('https://local-test.invalid/evaristo-soporte', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(options.authenticated === false ? {} : { Authorization: `Bearer ${token}` }), 'x-forwarded-for': '198.51.100.99, 203.0.113.1' }, body: JSON.stringify(body),
    }));
    return { response, body: await response.json() as Row };
  };
  return { run, rows, queries, rpc, fetch: fetchMock };
}

export const modelResponse = (content: string, finishReason = 'stop', toolCalls?: unknown[]) => new Response(JSON.stringify({
  choices: [{ finish_reason: finishReason, message: { content, ...(toolCalls ? { tool_calls: toolCalls } : {}) } }],
}), { headers: { 'Content-Type': 'application/json' } });
