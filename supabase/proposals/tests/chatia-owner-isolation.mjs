import {PGlite} from './node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${a}'),('${b}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id int primary key,bucket_id text,name text); alter table storage.objects enable row level security; create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$; grant usage on schema storage to authenticated,anon; grant select,insert,update,delete on storage.objects to authenticated,anon;`);
await db.exec(`CREATE POLICY "Public can view product images" ON storage.objects FOR SELECT TO public USING ((bucket_id = 'product-images'::text)) ;
CREATE POLICY "Users can delete own product images" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'product-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) ;
CREATE POLICY "Users can update own product images" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'product-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) ;
CREATE POLICY "Users can upload product images" ON storage.objects FOR INSERT TO authenticated  WITH CHECK (((bucket_id = 'product-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "documentos_empresa_delete" ON storage.objects FOR DELETE TO public USING (((bucket_id = 'documentos-empresa'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) ;
CREATE POLICY "documentos_empresa_insert" ON storage.objects FOR INSERT TO public  WITH CHECK (((bucket_id = 'documentos-empresa'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "documentos_empresa_select" ON storage.objects FOR SELECT TO public USING (((bucket_id = 'documentos-empresa'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) ;`);
const policiesBefore=(await db.query("select policyname,qual,with_check from pg_policies where schemaname='storage' order by policyname")).rows;
const proposal=readFileSync(new URL('../chatia-owner-isolation.review.sql',import.meta.url),'utf8');
await db.exec("insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('bases-licitacion','bases-licitacion',true,52428800,ARRAY['application/pdf'])");
await assert.rejects(()=>db.exec(proposal),/bucket configuration differs/);
await db.exec("rollback;delete from storage.buckets where id='bases-licitacion'");
await db.exec(proposal);
const policiesAfter=(await db.query("select policyname,qual,with_check from pg_policies where schemaname='storage' and policyname not like 'ChatIA%' order by policyname")).rows;
assert.deepEqual(policiesAfter,policiesBefore,'existing other-bucket policies preserved');
async function as(user,query){await db.exec(`begin;set local role ${user?'authenticated':'anon'};set local request.jwt.claim.sub='${user||''}';`);try{return (await db.query(query)).rows;}finally{await db.exec('rollback');}}
await db.exec(`insert into storage.objects values(1,'bases-licitacion','${a}/lic/a.pdf'),(2,'bases-licitacion','${b}/lic/b.pdf');insert into documentos_licitacion(id,licitacion_id,user_id,filename,storage_path) values('${a}','lic','${a}','a.pdf','${a}/lic/a.pdf'),('${b}','lic','${b}','b.pdf','${b}/lic/b.pdf');insert into chat_licitacion(id,licitacion_id,user_id) values('${a}','lic','${a}'),('${b}','lic','${b}');`);
const checks=['preexisting public bucket rejected','existing other-bucket policies preserved'];
async function deny(user,q,label){await assert.rejects(()=>as(user,q));checks.push(label);}
for(const user of [a,b]){
 assert.deepEqual((await as(user,'select name from storage.objects')).map(x=>x.name),[`${user}/lic/${user===a?'a':'b'}.pdf`]);checks.push('storage read own only');
 assert.equal((await as(user,`delete from storage.objects where name like '${user===a?b:a}/%' returning id`)).length,0);checks.push('cross owner delete denied');
 assert.equal((await as(user,`insert into storage.objects values(3,'bases-licitacion','${user}/lic/new.pdf') returning id`)).length,1);checks.push('own upload allowed');
 await deny(user,`insert into storage.objects values(3,'bases-licitacion','${user===a?b:a}/lic/new.pdf')`,'cross owner upload denied');
 assert.equal((await as(user,`update storage.objects set name='${user===a?b:a}/lic/stolen.pdf' returning id`)).length,0);checks.push('rename transfer denied');
 for(const table of ['documentos_licitacion','chat_licitacion']){
  assert.deepEqual((await as(user,`select user_id from ${table}`)).map(x=>x.user_id),[user]);checks.push(`${table} own only`);
  await deny(user,`update ${table} set user_id='${user===a?b:a}' where user_id='${user}'`,`${table} transfer denied`);
  assert.equal((await as(user,`delete from ${table} where user_id='${user===a?b:a}' returning id`)).length,0);checks.push(`${table} cross delete denied`);
 }
}
await deny(a, `insert into documentos_licitacion(licitacion_id,user_id,filename,storage_path) values('lic','${a}','cross.pdf','${b}/lic/cross.pdf')`, 'document owner storage path enforced');
assert.equal((await as(null,'select id from storage.objects')).length,0);checks.push('anonymous storage denied');
await deny(null,'select id from documentos_licitacion','anonymous documents denied');
await deny(null,'select id from chat_licitacion','anonymous chat denied');
const evidence={pass:true,checks:checks.length,details:checks,localPGliteOnly:true,realPostgrestJwt:false,productionMutation:false,proposalRequiresCatalogReviewAndApproval:true};
writeFileSync(process.argv[2] || '/tmp/chatia-owner-isolation.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));await db.close();
