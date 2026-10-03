import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const proposal = readFileSync('supabase/proposals/inventario_initplan.sql', 'utf8');
const original = readFileSync('supabase/migrations/20261003010000_rls_permisos_operativo_cubo.sql', 'utf8');
const summary = readFileSync('supabase/migrations/20260904080000_inventario_resumen_y_paginacion.sql', 'utf8');
const unwrap = (sql: string) => sql.replace(/\(select ((?:public\.)?(?:cliente_owner_id|tiene_modulo_operativo)|auth\.uid)\(\)\)/g, '$1()');
const policies = (sql: string) => sql.split('\n').filter(line => line.startsWith('alter policy inv_'));

describe('inventory RLS proposal static invariants (not a database test)', () => {
  it('preserves all four ownership and module permission policies exactly', () => {
    expect(policies(proposal)).toHaveLength(4);
    expect(policies(unwrap(proposal))).toEqual(policies(original));
    for (const policy of policies(proposal)) {
      expect(policy).toContain('(select public.tiene_modulo_operativo())');
      expect(policy).toContain('(select cliente_owner_id())');
      expect(policy).toContain('(select auth.uid())');
    }
  });
  it('preserves the invoker summary function, aggregation and grants', () => {
    const before = summary.slice(summary.indexOf('create or replace function')).trim();
    const normalized = unwrap(proposal);
    const after = normalized.slice(normalized.indexOf('create or replace function')).replace(/\s*commit;\s*$/, '').trim();
    expect(after).toEqual(before);
    expect(proposal).not.toContain('security definer');
    expect(proposal).not.toContain('disable row level security');
    expect(proposal).not.toContain('create or replace function public.is_super_admin');
    expect(proposal).not.toContain('create or replace function public.tiene_modulo_operativo');
  });
});
