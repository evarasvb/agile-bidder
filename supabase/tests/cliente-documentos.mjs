/** Run: node supabase/tests/cliente-documentos.mjs <absolute @electric-sql/pglite/dist/index.js>
 * PGlite 0.5.8 is installed separately in /tmp; no network or Supabase connection.
 * Fixture reproduces the observed CHECK and owner policies, not all production triggers.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const filename = readdirSync(new URL('../migrations/', import.meta.url))
  .find(name => name.endsWith('_fix_cliente_documentos_empresa_tipo_check.sql') || name.endsWith('_cliente_documentos_tipos_empresa.sql'));
assert.ok(filename, 'versioned migration exists');
const migration = read(`../migrations/${filename}`);
const rollback = read('../rollbacks/cliente_documentos_tipos_empresa.sql');
const oldTypes = ['ficha_tecnica', 'certificado', 'catalogo', 'otro'];
const newTypes = ['carpeta_tributaria', 'vigencia_poderes', 'cedula_representante', 'escritura_constitucion', 'registro_proveedores'];
const A = '00000000-0000-0000-0000-000000000001';
const B = '00000000-0000-0000-0000-000000000002';
const C = '00000000-0000-0000-0000-000000000003';
const D = '00000000-0000-0000-0000-000000000004';
let passed = 0;
const test = async (name, run) => { await run(); console.log(`ok ${++passed} - ${name}`); };
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const login = async (id, role = 'authenticated') => {
  await db.exec('reset role');
  await query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec(`set role ${role}`);
};
const insert = (tipo, cliente = C) => query(
  "insert into cliente_documentos(cliente_id,tipo,tipo_codigo,nombre,archivo_url) values($1,$2,null,'synthetic.pdf','synthetic-only') returning id,tipo",
  [cliente, tipo]
);
const securitySnapshot = async () => ({
  tables: await query("select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.oid in ('public.cliente_documentos'::regclass,'storage.objects'::regclass) order by 1,2"),
  policies: await query("select * from pg_policies where (schemaname='public' and tablename='cliente_documentos') or (schemaname='storage' and tablename='objects') order by schemaname,tablename,policyname"),
  columns: await query("select attname,atttypid,attnotnull from pg_attribute where attrelid='public.cliente_documentos'::regclass and attnum>0 order by attnum"),
  buckets: await query('select * from storage.buckets order by id'),
});

try {
  await db.exec(read('./cliente-documentos-fixture.sql'));
  await db.exec(read('../migrations/20260903110000_documentos_empresa_plus.sql'));
  await query('insert into clientes(id,user_id) values($1,$2),($3,$4)', [C, A, D, B]);
  for (const tipo of oldTypes) await insert(tipo);
  const before = await securitySnapshot();
  const oldRows = await query('select id,tipo,nombre,archivo_url from cliente_documentos order by id');

  await test('reproduces all five pre-fix CHECK failures', async () => {
    for (const tipo of newTypes) await assert.rejects(insert(tipo), error => error.code === '23514' && error.constraint === 'cliente_documentos_tipo_check');
  });
  await db.exec(migration);
  await test('keeps RLS, policies, ACLs, columns and private bucket unchanged', async () => {
    assert.deepEqual(await securitySnapshot(), before);
    assert.deepEqual(await query('select id,tipo,nombre,archivo_url from cliente_documentos order by id'), oldRows);
    assert.equal((await query("select convalidated from pg_constraint where conrelid='cliente_documentos'::regclass and conname='cliente_documentos_tipo_check'"))[0].convalidated, true);
  });
  await test('accepts all nine types with nullable tipo_codigo', async () => {
    for (const tipo of [...oldTypes, ...newTypes]) assert.equal((await insert(tipo))[0].tipo, tipo);
  });
  await test('rejects unknown, empty, case and whitespace variants on INSERT and UPDATE', async () => {
    for (const tipo of ['', 'pdf', 'factura', 'Carpeta_tributaria', 'carpeta_tributaria ', ' carpeta_tributaria', 'registro_proveedor']) {
      await assert.rejects(insert(tipo), error => error.code === '23514');
      await assert.rejects(query('update cliente_documentos set tipo=$1', [tipo]), error => error.code === '23514');
    }
  });
  await test('migration repeats without changing data or security', async () => {
    const rows = await query('select * from cliente_documentos order by id');
    await db.exec(migration);
    assert.deepEqual(await query('select * from cliente_documentos order by id'), rows);
    assert.deepEqual(await securitySnapshot(), before);
  });

  await login(A);
  await test('owner can INSERT, SELECT, UPDATE and DELETE own new types', async () => {
    const [row] = await insert('carpeta_tributaria');
    assert.equal((await query("update cliente_documentos set tipo='vigencia_poderes' where id=$1 returning tipo", [row.id]))[0].tipo, 'vigencia_poderes');
    assert.equal((await query('select id from cliente_documentos where id=$1', [row.id])).length, 1);
    assert.equal((await query('delete from cliente_documentos where id=$1 returning id', [row.id])).length, 1);
  });
  await test('owner cannot INSERT another company or reassign ownership', async () => {
    await assert.rejects(insert('cedula_representante', D), error => error.code === '42501');
    await assert.rejects(query('update cliente_documentos set cliente_id=$1 where cliente_id=$2', [D, C]), error => error.code === '42501');
  });
  await login(B);
  await test('second owner cannot SELECT, UPDATE or DELETE first company', async () => {
    assert.equal((await query('select id from cliente_documentos where cliente_id=$1', [C])).length, 0);
    assert.equal((await query("update cliente_documentos set nombre='changed' where cliente_id=$1 returning id", [C])).length, 0);
    assert.equal((await query('delete from cliente_documentos where cliente_id=$1 returning id', [C])).length, 0);
  });
  await login('', 'anon');
  await test('anonymous has no document access', async () => {
    assert.equal((await query('select id from cliente_documentos')).length, 0);
    await assert.rejects(insert('registro_proveedores'), error => error.code === '42501');
  });
  await login(A);
  await test('Storage owner isolation and private bucket persist', async () => {
    await query("insert into storage.objects(bucket_id,name) values('documentos-empresa',$1)", [`${A}/synthetic.pdf`]);
    await assert.rejects(query("insert into storage.objects(bucket_id,name) values('documentos-empresa',$1)", [`${B}/synthetic.pdf`]), error => error.code === '42501');
    await login(B);
    assert.equal((await query("select id from storage.objects where bucket_id='documentos-empresa'")).length, 0);
    assert.equal((await query("delete from storage.objects where bucket_id='documentos-empresa' returning id")).length, 0);
    await db.exec('reset role');
    assert.equal((await query("select public from storage.buckets where id='documentos-empresa'"))[0].public, false);
  });
  await test('rollback refuses new-type rows atomically and preserves all data/security', async () => {
    const rows = await query('select * from cliente_documentos order by id');
    const check = await query("select pg_get_constraintdef(oid) def from pg_constraint where conrelid='cliente_documentos'::regclass and conname='cliente_documentos_tipo_check'");
    await assert.rejects(db.exec(rollback), error => error.code === '23514');
    await db.exec('rollback');
    assert.deepEqual(await query('select * from cliente_documentos order by id'), rows);
    assert.deepEqual(await query("select pg_get_constraintdef(oid) def from pg_constraint where conrelid='cliente_documentos'::regclass and conname='cliente_documentos_tipo_check'"), check);
    assert.deepEqual(await securitySnapshot(), before);
  });
  await test('rollback succeeds without new-type rows; legacy data and security remain', async () => {
    // Synthetic database only; no real client records are connected or changed.
    await query('delete from cliente_documentos where tipo = any($1::text[])', [newTypes]);
    const rows = await query('select * from cliente_documentos order by id');
    await db.exec(rollback);
    assert.deepEqual(await query('select * from cliente_documentos order by id'), rows);
    assert.deepEqual(await securitySnapshot(), before);
    for (const tipo of oldTypes) await insert(tipo);
    for (const tipo of newTypes) await assert.rejects(insert(tipo), error => error.code === '23514');
  });
  console.log(`PASS ${passed} PostgreSQL cases; no Supabase or Storage API calls`);
} finally {
  await db.close();
}
