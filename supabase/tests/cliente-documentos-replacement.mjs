/** Synthetic PostgreSQL regression, no Supabase/Storage connection.
 * Run: node supabase/tests/cliente-documentos-replacement.mjs <PGlite dist/index.js>
 * Trigger bodies mirror the catalog inspected on 2026-10-08.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
let passed = 0;
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const test = async (name, run) => { await run(); console.log(`ok ${++passed} - ${name}`); };
try {
  await db.exec(`
    create table carpeta_tipos(codigo text primary key, vigencia_dias integer);
    insert into carpeta_tipos values('carpeta_tributaria', 30);
    create table cliente_documentos(
      id integer primary key, cliente_id text not null, tipo text not null,
      archivo_url text not null, created_at timestamptz not null, updated_at timestamptz,
      avisado boolean not null default false, tipo_codigo text, storage_path text,
      fecha_emision date, fecha_vencimiento date, usado_en text[], texto_extraido text
    );
    create function carpeta_set_vencimiento() returns trigger language plpgsql as $$
    begin
      if new.tipo is null then new.tipo := case when new.tipo_codigo = 'ficha_tecnica' then 'ficha_tecnica' else 'certificado' end; end if;
      if new.archivo_url is null then new.archivo_url := coalesce(new.storage_path, ''); end if;
      if new.fecha_vencimiento is null and new.tipo_codigo is not null then
        select coalesce(new.fecha_emision, current_date) + t.vigencia_dias into new.fecha_vencimiento
        from carpeta_tipos t where t.codigo = new.tipo_codigo and t.vigencia_dias is not null;
      end if;
      new.updated_at := now();
      return new;
    end $$;
    create function carpeta_reset_aviso() returns trigger language plpgsql as $$
    begin
      if new.fecha_vencimiento is distinct from old.fecha_vencimiento then new.avisado := false; end if;
      return new;
    end $$;
    create trigger trg_carpeta_venc before insert or update on cliente_documentos
      for each row execute function carpeta_set_vencimiento();
    create trigger trg_carpeta_reset_aviso before update on cliente_documentos
      for each row execute function carpeta_reset_aviso();
    create function documentos_por_avisar()
      returns table(id integer, subido_en timestamptz) language sql as $$
      select id, created_at from cliente_documentos where avisado = false order by created_at
    $$;
  `);
  const add = async (id, metadata = {}) => {
    await query("insert into cliente_documentos(id,cliente_id,tipo,archivo_url,created_at,usado_en) values($1,'synthetic-owner','carpeta_tributaria','synthetic/old.pdf','2026-01-01', '{}')", [id]);
    // Deliberately populated synthetic evidence, then marked previously notified.
    for (const [column, value] of Object.entries(metadata)) {
      assert.ok(['tipo_codigo','storage_path','fecha_emision','fecha_vencimiento','usado_en','texto_extraido'].includes(column));
      await query(`update cliente_documentos set ${column}=$1 where id=$2`, [value, id]);
    }
    await query('update cliente_documentos set avisado=true where id=$1', [id]);
  };
  const replace = id => query(`
    update cliente_documentos set archivo_url='synthetic/new.pdf', avisado=false,
      created_at='2026-10-08T12:34:56Z'
    where id=$1 and cliente_id='synthetic-owner' and archivo_url='synthetic/old.pdf'
      and tipo_codigo is null and texto_extraido is null
      and fecha_emision is null and fecha_vencimiento is null
      and usado_en='{}'::text[] and storage_path is null
    returning id, created_at, updated_at, avisado, fecha_emision, fecha_vencimiento
  `, [id]);

  await test('replacement of simple row renews pending upload date and never invents expiry', async () => {
    await add(1);
    const [row] = await replace(1);
    assert.equal(row.id, 1);
    assert.equal(row.created_at.toISOString(), '2026-10-08T12:34:56.000Z');
    assert.equal(row.avisado, false);
    assert.ok(row.updated_at instanceof Date);
    assert.equal(row.fecha_emision, null);
    assert.equal(row.fecha_vencimiento, null);
    const [pending] = await query('select * from documentos_por_avisar()');
    assert.equal(pending.id, 1);
    assert.equal(pending.subido_en.toISOString(), row.created_at.toISOString());
  });

  const evidence = [
    { texto_extraido: 'Old synthetic OCR' },
    { fecha_emision: '2026-01-01' },
    { fecha_vencimiento: '2026-12-31' },
    { tipo_codigo: 'carpeta_tributaria' },
    { usado_en: ['historical-synthetic-use'] },
    { storage_path: 'synthetic/different-old.pdf' },
  ];
  for (let i = 0; i < evidence.length; i++) {
    await test(`guard preserves populated evidence ${Object.keys(evidence[i])[0]}`, async () => {
      const id = i + 2;
      await add(id, evidence[i]);
      const before = await query('select * from cliente_documentos where id=$1', [id]);
      assert.equal((await replace(id)).length, 0);
      assert.deepEqual(await query('select * from cliente_documentos where id=$1', [id]), before);
    });
  }
  await test('history/OCR added after read prevents the final update without changing evidence', async () => {
    await add(10);
    await query("update cliente_documentos set usado_en=array['new-historical-use'], texto_extraido='Concurrent synthetic OCR' where id=10");
    const before = await query('select * from cliente_documentos where id=10');
    assert.equal((await replace(10)).length, 0);
    assert.deepEqual(await query('select * from cliente_documentos where id=10'), before);
  });
  await test('updated_at changes for a notification-only write and is not an upload date', async () => {
    const [{ created_at }] = await query('select created_at from cliente_documentos where id=1');
    await query('update cliente_documentos set avisado=true where id=1');
    const [row] = await query('select created_at,updated_at from cliente_documentos where id=1');
    assert.equal(row.created_at.toISOString(), created_at.toISOString());
    assert.notEqual(row.updated_at.toISOString(), row.created_at.toISOString());
  });
  console.log(`PASS ${passed} PostgreSQL replacement cases; synthetic rows only`);
} finally {
  await db.close();
}
