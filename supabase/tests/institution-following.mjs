/** Run: node supabase/tests/institution-following.mjs <absolute path to @electric-sql/pglite/dist/index.js>
 * Engine installed separately (e.g. npm install --prefix <temp> @electric-sql/pglite@0.5.8).
 * Exercises real PL/pgSQL and RLS in an ephemeral database; never connects to Supabase.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const read = p => readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,'');
const migration = read('../migrations/20260930211414_instituciones_avisos_contexto.sql');
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002';
const C='00000000-0000-0000-0000-000000000003',M='00000000-0000-0000-0000-000000000004';
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log(`ok ${passed} - ${name}`)};
const query=async(sql,args=[])=> (await db.query(sql,args)).rows;
const login=async(id)=>{await db.exec('reset role');await query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};

await db.exec(read('./institution-following-fixture.sql'));
await db.exec(read('../migrations/20260824160000_cliente_owner_id.sql'));
await db.exec(read('../migrations/20260923060000_panel_proveedor.sql').split('-- 2) RPC')[0]);
await db.exec(read('../migrations/20260903040000_reclamos_mp_desglose.sql').split('-- Control de carga')[0]);
await db.exec(read('../migrations/20260909010000_medios_organismos.sql').split('create table if not exists public.medios_organismos_estado')[0]);
await db.exec(`grant usage on schema auth,public to authenticated,anon;
 grant select on all tables in schema public to authenticated;
 grant insert,update,delete on cliente_instituciones_seguidas to authenticated;
 grant update on notificaciones_log to authenticated;
 alter table notificaciones_log enable row level security;

 insert into clientes(id,user_id) values('${C}','${A}'),('${B}','${B}');
 insert into vendedores values('${M}','${A}',true,now());
 insert into instituciones(rut,codigo_entidad,nombre,pago_promedio_dias,conducta_pago,plazo_pago_texto,reclamos_total,pago_actualizado_el)
 values('1-9','101','Alpha',30,'bueno','30 dias',1,now()),('2-7','102','Beta',20,'bueno','20 dias',2,now()),('3-5','999','Same',null,null,null,null,null),('4-3','999','Same',null,null,null,null,null),('5-1','105',null,null,null,null,null,null);
 insert into cliente_instituciones_seguidas(cliente_id,rut_institucion,nombre_institucion)
 values('${C}','1-9','Alpha'),('${B}','2-7','Beta'),('${C}','3-5','Same'),('${C}','4-3','Same'),('${C}','999','Same'),('${C}','101','Alpha'),('${C}','5-1',null);
 insert into licitaciones_bi select n,'L'||n,'Tender '||n,'Adjudicada',now()-n*interval '1 day','1-9','101','Alpha',8,now() from generate_series(1,25) n;
 insert into licitaciones_bi values(99,'B1','Beta tender','Publicada',now(),'2-7','102','Beta',5,now());
 insert into compras_agiles values('CA1','Agil Alpha','Publicada',now(),'1-9'),('CA2','Agil Beta','Publicada',now(),'2-7');
 insert into reclamos_mp(id_reclamo,tipo,fecha,organismo_rut,reclamante) values('R1',1,current_date,'1-9','Proveedor'),('R2',2,current_date,'2-7','Proveedor B');
 insert into ordenes_compra values('OC1','Order small','Supplier','Emitida',10,now(),'https://example.test/1','101'),('OC2','Order large','Supplier','Emitida',100,now(),'https://example.test/2','101'),('OCB','Beta order','Other','Emitida',20,now(),null,'102'),('AMB','Ambiguous','Other','Emitida',20,now(),null,'999');
 insert into medios_menciones(organismo,organismo_norm,titulo,url,resumen) values('Alpha','alpha','Alpha news','https://example.test/news','<a>HTML</a>'),('Beta','beta','Beta news','https://example.test/beta',null),('Same','same','Ambiguous news','https://example.test/same',null);
 insert into notificaciones_log(cliente_id,tipo,datos) values
 ('${C}','medio_institucion','{"organismo":"Alpha","rut":"1-9","clave":"medio:1"}'),
 ('${B}','medio_institucion','{"organismo":"Alpha","clave":"medio:1"}'),
 ('${C}','medio_institucion','{"organismo":"Same","clave":"medio:3"}'),
 ('${C}','medio_institucion','{"organismo":"Missing","clave":"medio:1"}'),
 ('${C}','adjudicacion_institucion','{"rut":"1-9","licitacion_codigo":"L1"}'),
 ('${C}','adjudicacion_institucion','{"rut":"1-9","licitacion_codigo":"B1"}'),
 ('${B}','medio_institucion','{"organismo":"Beta","clave":"medio:2"}');
 insert into notificaciones_log(cliente_id,tipo,datos) values
 ('${C}','reclamo_institucion',jsonb_build_object('rut','1-9','clave','reclamos:1-9:'||current_date)),
 ('${C}','compras_institucion',jsonb_build_object('rut','1-9','clave','oc:1-9:'||current_date));
`);
await db.exec(read('../migrations/20260925025922_notificaciones_log_rls_equipo.sql'));
await db.exec(read('../migrations/20260925040500_notificaciones_log_update_solo_leida.sql'));
await db.exec(read('../migrations/20260929180000_reclamos_mp_cerrar_lectura_directa.sql'));
await db.exec(migration);
await test('backfill selects only exact unique identity within client',async()=>{
 const rows=await query("select id,datos from notificaciones_log order by id");
 assert.equal(rows[0].datos.evento_id,'1');assert.equal(rows[0].datos.rut_institucion,'1-9');
 for(const index of [1,2,3]) assert.equal(rows[index].datos.rut_institucion,undefined);
 assert.equal(rows[4].datos.evento_id,'L1');assert.equal(rows[5].datos.evento_id,undefined);
 assert.equal(rows[6].datos.evento_id,'2');assert.equal(rows[7].datos.evento_id,'R1');assert.equal(rows[8].datos.evento_id,'OC2');
});
await test('migration is repeatable and preserves repaired snapshots',async()=>{
 const before=await query('select datos from notificaciones_log order by id');await db.exec(migration);
 assert.deepEqual(await query('select datos from notificaciones_log order by id'),before);
});
await login(A);
await test('actual notification RLS isolates company A from B',async()=>{
 assert.ok((await query('select cliente_id from notificaciones_log')).every(x=>x.cliente_id===C));
 assert.ok((await query('select cliente_id from cliente_instituciones_seguidas')).every(x=>x.cliente_id===C));
});
await test('actual immutable-columns trigger prevents client metadata rewrite',async()=>{
 const before=await query('select id,datos from notificaciones_log order by id');
 await query("update notificaciones_log set datos='{}'::jsonb");
 assert.deepEqual(await query('select id,datos from notificaciones_log order by id'),before);
});
await test('authenticated cannot execute producer or identity helper',async()=>{
 await assert.rejects(query('select instituciones_seguidas_avisar()'),e=>e.code==='42501');
 await assert.rejects(query("select institucion_rut_seguro('1-9')"),e=>e.code==='42501');
});
await test('new metadata does not reopen direct complaints access',async()=>assert.rejects(query('select * from reclamos_mp'),e=>e.code==='42501'));
await login(B);
await test('company B sees own historical alert and not company A',async()=>{
 const rows=await query('select cliente_id from notificaciones_log');assert.equal(rows.length,2);assert.ok(rows.every(x=>x.cliente_id===B));
});
await login(M);
await test('active invited member keeps existing owner-company access',async()=>{
 const rows=await query('select cliente_id from notificaciones_log');assert.ok(rows.length>0);assert.ok(rows.every(x=>x.cliente_id===C));
});
await login('');
await test('missing uid sees neither follows nor notifications',async()=>{
 assert.equal((await query('select * from notificaciones_log')).length,0);
 assert.equal((await query('select * from cliente_instituciones_seguidas')).length,0);
});
await db.exec('reset role;set role anon');
await test('anonymous cannot execute producer or identity helper',async()=>{
 await assert.rejects(query('select instituciones_seguidas_avisar()'),e=>e.code==='42501');
 await assert.rejects(query("select institucion_nombre_seguro('Alpha','1-9')"),e=>e.code==='42501');
});
await db.exec('reset role');
await test('backfill reenables the preexisting column-protection trigger',async()=>{
 assert.equal((await query("select tgenabled from pg_trigger where tgname='trg_notificaciones_log_bloquear_columnas'"))[0].tgenabled,'O');
});
await test('failed backfill rolls back temporary trigger disable atomically',async()=>{
 const broken=migration.slice(migration.indexOf('do $backfill$')).replace(
  'disable trigger trg_notificaciones_log_bloquear_columnas;',
  "disable trigger trg_notificaciones_log_bloquear_columnas; raise exception 'forced rollback';");
 await assert.rejects(db.exec(broken),/forced rollback/);
 assert.equal((await query("select tgenabled from pg_trigger where tgname='trg_notificaciones_log_bloquear_columnas'"))[0].tgenabled,'O');
});
await test('producer preserves identity/event and picks largest order consistently',async()=>{
 await db.exec('truncate notificaciones_log');await db.exec('set role service_role');await query('select instituciones_seguidas_avisar()');await db.exec('reset role');
 const rows=await query('select tipo,datos from notificaciones_log');assert.ok(rows.length>0);
 for(const row of rows){assert.ok(row.datos.rut_institucion);assert.ok(row.datos.evento_tipo);assert.ok(row.datos.evento_id);}
 assert.equal(rows.find(r=>r.tipo==='compras_institucion'&&r.datos.rut==='1-9').datos.evento_id,'OC2');
 assert.ok(!rows.some(r=>['3-5','4-3','999'].includes(r.datos.rut_institucion)));
 const again=(await query('select instituciones_seguidas_avisar() n'))[0].n;assert.equal(again,0);
});
await test('homonyms, null names and shared codes stay unresolved',async()=>{
 for(const [name,rut] of [['Same','3-5'],['Same','4-3'],[null,'5-1']])
   assert.equal((await query('select institucion_nombre_seguro($1,$2) safe',[name,rut]))[0].safe,false);
 assert.equal((await query("select institucion_rut_seguro('999') rut"))[0].rut,null);
 assert.equal((await query("select institucion_rut_seguro('101') rut"))[0].rut,'1-9');
});
await test('ambiguous identifier shaped like a RUT must not fall back to itself',async()=>{
 await db.exec("insert into instituciones(rut,codigo_entidad,nombre) values('8-6','1-9','Other')");
 assert.equal((await query("select institucion_rut_seguro('1-9') rut"))[0].rut,null);
});
await db.close();console.log(`PASS ${passed} database cases`);
