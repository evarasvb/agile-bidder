// Disposable PostgreSQL Wasm, partial fixture: no persistence, sockets or credentials.
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const [modulePath, output = 'pglite-rls-evidence.json'] = process.argv.slice(2);
if (!modulePath) throw new Error('Provide local PGlite index.js path');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const fixture = JSON.parse(execFileSync('python3', [fileURLToPath(new URL('./run_rls.py', import.meta.url)), '--emit-fixture'], {encoding:'utf8'}));
const db = new PGlite();
const uid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
async function session(n, query) {
  await db.exec(`begin; set local role ${n?'authenticated':'anon'}; set local request.jwt.claim.sub='${n?uid(n):''}';`);
  try { return (await db.query(query)).rows; }
  finally { await db.exec('rollback;'); }
}
async function phase() {
  const scenarios = {};
  for (const [name,n] of Object.entries(fixture.scenarios)) {
    const read = (await session(n, `select coalesce(json_agg(id order by id),'[]') as ids, ${n?'public.cliente_inventario_resumen()':'null'} as summary from cliente_inventario`))[0];
    const writes = {};
    const destinations = [uid(101),uid(108),...(n?[uid(n)]:[])];
    for (const dest of destinations) {
      const id = dest===uid(101)?1:dest===uid(108)?20008:30000+n;
      const transfer = n===8?uid(101):uid(108);
      const queries = {
        insert:`insert into cliente_inventario(id,cliente_id) values(99999,'${dest}') returning id`,
        update:`update cliente_inventario set stock_disponible=7 where id=${id} returning id`,
        delete:`delete from cliente_inventario where id=${id} returning id`,
        transfer:`update cliente_inventario set cliente_id='${transfer}' where id=${id} returning id`,
      };
      for (const [action,query] of Object.entries(queries)) {
        try { writes[`${dest}:${action}`] = (await session(n,query)).map(r=>Number(r.id)); }
        catch(error) { if (!String(error.message).includes('row-level security')) throw error; writes[`${dest}:${action}`]='RLS denied'; }
      }
      const allowed=!!(n && name!=='member_cobranza' && (dest===uid(n)||dest===uid(101)&&[1,2,4].includes(n)||dest===uid(108)&&n===8));
      assert.deepEqual(writes[`${dest}:insert`],allowed?[99999]:'RLS denied',`${name} insert ${dest}`);
      for(const action of ['update','delete']) assert.deepEqual(writes[`${dest}:${action}`],allowed?[id]:[],`${name} ${action} ${dest}`);
      assert.deepEqual(writes[`${dest}:transfer`],allowed?'RLS denied':[],`${name} transfer ${dest}`);
    }
    const expected = !n||name==='member_cobranza'?[]:([...([1,2,4].includes(n)?[...Array.from({length:16359},(_,i)=>i+1),20001]:[20000+n]),30000+n].sort((a,b)=>a-b));
    assert.deepEqual(read.ids.map(Number),expected,name);
    scenarios[name]={read,writes};
  }
  const columns='id,cliente_id,sku,nombre,descripcion,categoria,palabras_clave,precio_unitario,margen_minimo,stock_disponible,unidad_medida,marca,tiempo_entrega,imagen_url,created_at,updated_at';
  const tenant=`cliente_id='${uid(101)}'`;
  const search="(nombre_producto ilike '%Producto 10%' or sku ilike '%Producto 10%' or proveedor ilike '%Producto 10%')";
  const incomplete="(descripcion is null or descripcion='' or imagen_url is null or imagen_url='')";
  const queries={
    page_offset_0:`select ${columns} from cliente_inventario where ${tenant} order by created_at desc nulls last,id limit 100 offset 0`,
    page_offset_100:`select ${columns} from cliente_inventario where ${tenant} order by created_at desc nulls last,id limit 100 offset 100`,
    count_exact:`select count(*) from cliente_inventario where ${tenant}`,
    page_search:`select ${columns} from cliente_inventario where ${tenant} and ${search} order by nombre_producto asc nulls last,id limit 100 offset 0`,
    count_search:`select count(*) from cliente_inventario where ${tenant} and ${search}`,
    page_incomplete:`select ${columns} from cliente_inventario where ${tenant} and ${incomplete} order by created_at desc nulls last,id limit 100 offset 100`,
    count_incomplete:`select count(*) from cliente_inventario where ${tenant} and ${incomplete}`,
    page_search_incomplete:`select ${columns} from cliente_inventario where ${tenant} and ${search} and ${incomplete} order by nombre_producto asc nulls last,id limit 100 offset 0`,
    count_search_incomplete:`select count(*) from cliente_inventario where ${tenant} and ${search} and ${incomplete}`,
    summary:'select public.cliente_inventario_resumen()',
  };
  const queryResults={};
  for(const [key,query] of Object.entries(queries)) queryResults[key]=await session(1,query);
  const plans={};
  for(const [key,query] of Object.entries(queries)) {
    plans[key]=[];
    for(let repeat=1;repeat<=3;repeat++) {
      const explain=(await session(1,`explain(analyze,buffers,format json) ${query}`))[0]['QUERY PLAN'];
      const nodes=[];
      const walk=node=>{nodes.push(Object.fromEntries(['Node Type','Subplan Name','Actual Loops','Actual Rows','Actual Total Time'].filter(k=>k in node).map(k=>[k,node[k]])));(node.Plans||[]).forEach(walk);};
      walk(explain[0].Plan);
      plans[key].push({repeat,execution_ms:explain[0]['Execution Time'],planning_ms:explain[0]['Planning Time'],initplans:nodes.filter(n=>n['Subplan Name']?.startsWith('InitPlan')),nodes,explain});
    }
  }
  return {scenarios,queryResults,plans};
}
try {
  await db.exec(fixture.setup);
  const before=await phase();
  await db.exec(fixture.proposal);
  const after=await phase();
  assert.deepEqual(after.scenarios,before.scenarios,'Before/after authorization and results');
  assert.deepEqual(after.queryResults,before.queryResults,'Before/after page/filter/count');
  await db.exec(fixture.rollback);
  const restored=await phase();
  assert.deepEqual(restored.scenarios,before.scenarios,'Committed rollback authorization and results');
  assert.deepEqual(restored.queryResults,before.queryResults,'Committed rollback page/filter/count');
  writeFileSync(output,JSON.stringify({engine:'PGlite in-memory PostgreSQL Wasm',fixture:'Partial dependency schema; exact helper bodies, inventory RLS enabled, authenticated/anon NOBYPASSRLS; nine scenarios. Three warm measurements; not production workload.',equivalent:true,rollbackRestored:true,before,after,restored},null,2));
  console.log(`PASS: nine scenarios, read/write equivalence; ${output}`);
} finally { await db.close(); }
