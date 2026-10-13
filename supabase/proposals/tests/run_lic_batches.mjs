import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
const db = new PGlite({ extensions: { pg_trgm } });
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const a = uid(101), b = uid(102);
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create extension pg_trgm; create schema extensions;
create function extensions.fixture_distance(text,text) returns float8 language sql immutable as 'select 0::float8';
create operator extensions.<=> (leftarg=text,rightarg=text,function=extensions.fixture_distance);
create table clientes(id uuid primary key);
create table licitaciones_bi(id uuid primary key,codigo text,estado text,fecha_cierre timestamptz);
create table licitaciones_bi_items(id uuid primary key,licitacion_id uuid,nombre_producto text,descripcion text,
  cantidad numeric,nombre_norm text,codigo_producto text,embedding text);
create table cliente_inventario(id uuid primary key,cliente_id uuid,nombre_producto text,sku text,precio_unitario numeric,
  nombre_norm text,busqueda_match text,codigo_producto text,embedding text);
create table lic_item_matches(id uuid default gen_random_uuid(),licitacion_codigo text,item_id uuid,cliente_id uuid,
  nombre_solicitado text,cantidad numeric,inventario_id uuid,nombre_producto text,sku text,precio_unitario numeric,
  score numeric,fecha_cierre timestamptz,updated_at timestamptz default now(),unique(item_id,cliente_id));
-- Deterministic scorer: production match_sim_v3 / pgvector performance is NOT tested here.
create function public.match_sim_v3(text,text,text,text,text,text,text) returns real language plpgsql as $$
begin
 if current_setting('fixture.fail',true)='on' then raise exception 'synthetic scoring failure'; end if;
 return case when $1=$5 then 1::real else 0::real end;
end $$;
insert into clientes values('${a}'),('${b}');
insert into licitaciones_bi values('${uid(1)}','SYNTHETIC','Publicada',now()+interval '1 day');
insert into cliente_inventario values
 ('${uid(201)}','${a}','Toner HP','A',100,'toner hp','toner hp','X',null),
 ('${uid(202)}','${b}','Toner HP','B',200,'toner hp','toner hp','X',null);
`);
for (let i=1;i<=7;i++) await db.query(`insert into licitaciones_bi_items values($1,$2,'Toner','Toner HP',1,'toner hp','X',null)`,[uid(300+i),uid(1)]);
await db.exec(readFileSync(new URL('../lic_match_batches.sql',import.meta.url),'utf8'));
const scalar = async sql => (await db.query(sql)).rows[0];
const tick = async () => (await scalar('select firmavb_internal.procesar_lic_match_queue(2) as result')).result;
const tests=[];
let r=await tick(); assert.equal(r.processed,2); assert.equal(r.complete,false);tests.push('bounded batch');
assert.equal((await scalar(`select cursor_item from firmavb_internal.lic_match_queue where cliente_id='${a}'`)).cursor_item,uid(302));
r=await tick();assert.equal(r.processed,2);
assert.equal((await scalar(`select cursor_item from firmavb_internal.lic_match_queue where cliente_id='${b}'`)).cursor_item,uid(302));tests.push('fair progress');
await db.exec(`insert into lic_item_matches(licitacion_codigo,item_id,cliente_id,inventario_id,score)
 values('SYNTHETIC','${uid(303)}','${a}','${uid(201)}',77);set fixture.fail='on';`);
r=await tick();assert.equal(r.status,'retry');
assert.equal((await scalar(`select cursor_item from firmavb_internal.lic_match_queue where cliente_id='${a}'`)).cursor_item,uid(302));
assert.equal((await scalar(`select score::int as score from lic_item_matches where cliente_id='${a}' and item_id='${uid(303)}'`)).score,77);tests.push('failure rollback and retained cursor');
await db.exec(`set fixture.fail='off';update firmavb_internal.lic_match_queue set next_run_at=now() where cliente_id='${a}';`);
let runs=0;
while ((r=await tick()).status!=='idle') { assert.ok(r.processed<=2);assert.ok(++runs<20); }
assert.equal((await scalar('select count(*)::int as n from lic_item_matches')).n,14);
assert.equal((await scalar(`select count(*)::int as n from lic_item_matches where
 (cliente_id='${a}' and inventario_id<>'${uid(201)}') or (cliente_id='${b}' and inventario_id<>'${uid(202)}')`)).n,0);
tests.push('resumption and company isolation');
await db.exec('update firmavb_internal.lic_match_queue set next_run_at=now()');
r=await tick();assert.equal(r.processed,2);tests.push('new cycle');
await db.exec(`delete from cliente_inventario where cliente_id='${b}';update firmavb_internal.lic_match_queue set next_run_at=now();`);
for(let i=0;i<12;i++){r=await tick();if(r.status==='idle')break;}
assert.equal((await scalar(`select count(*)::int as n from lic_item_matches where cliente_id='${b}'`)).n,0);
assert.equal((await scalar(`select count(*)::int as n from lic_item_matches where cliente_id='${a}'`)).n,7);tests.push('removed inventory cleanup');
await db.exec(`update licitaciones_bi set estado='Revocada';update firmavb_internal.lic_match_queue set next_run_at=now();`);
for(let i=0;i<4;i++) await tick();
assert.equal((await scalar('select count(*)::int as n from lic_item_matches')).n,0);tests.push('revoked opportunity cleanup');
await assert.rejects(db.query('select firmavb_internal.procesar_lic_match_queue(0)'));
await assert.rejects(db.query('select firmavb_internal.procesar_lic_match_queue(501)'));tests.push('batch bounds');
assert.equal((await scalar(`select has_function_privilege('anon','firmavb_internal.procesar_lic_match_queue(integer)','execute') as allowed`)).allowed,false);
assert.equal((await scalar(`select has_table_privilege('authenticated','firmavb_internal.lic_match_queue','select') as allowed`)).allowed,false);tests.push('no end-user access');
console.log(JSON.stringify({passed:tests.length,tests,limitations:['Synthetic scorer and distance operator','No production timing, pgvector engine, or pg_cron concurrency validation']},null,2));
await db.close();
