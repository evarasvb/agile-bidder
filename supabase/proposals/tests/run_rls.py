#!/usr/bin/env python3
"""LOCAL ONLY partial schema fixture. Exact repository auth helper bodies.
Requires a disposable Postgres superuser and PGHOST absolute Unix socket directory.
No remote connections; creates firmavb_rls_test, refuses an existing database.
"""
import argparse, json, os, pathlib, re, subprocess
p=argparse.ArgumentParser(); p.add_argument('--psql'); p.add_argument('--emit-fixture', action='store_true'); p.add_argument('--output', default='rls-evidence.json'); args=p.parse_args()
if not args.emit_fixture and not os.environ.get('PGHOST','').startswith('/'):
    raise SystemExit('PGHOST must be an absolute local Unix socket directory')
root=pathlib.Path(__file__).resolve().parents[2]
def sql(text, db='firmavb_rls_test'):
    r=subprocess.run([args.psql,'-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],input=text,text=True,capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
def migration(name): return (root/'migrations'/name).read_text()
def function(name, filename):
    text=migration(filename)
    match=re.search(r'create or replace function public\.'+name+r'\(\).*?(?:\$function\$|\$\$);',text,re.I|re.S)
    if not match: raise ValueError(name)
    return match.group()
def uid(n): return f'00000000-0000-0000-0000-{n:012d}'
if not args.emit_fixture:
    # Dedicated cluster only: refuse unexpected databases and preexisting app roles.
    existing=json.loads(sql("select json_agg(datname) from pg_database where not datistemplate;",'postgres'))
    if set(existing)!= {'postgres'}: raise SystemExit('Requires a fresh dedicated cluster containing only postgres')
    if sql("select count(*) from pg_roles where rolname in ('authenticated','anon');",'postgres')!='0':
        raise SystemExit('Refusing cluster with existing application roles')
    sql('create database firmavb_rls_test;', 'postgres')
setup="""
create role authenticated nologin nosuperuser nobypassrls;
create role anon nologin nosuperuser nobypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table users_extended(id uuid primary key, role text);
create table user_roles(user_id uuid, role text);
create table clientes(id uuid primary key,user_id uuid,created_at timestamptz default now());
create table vendedores(user_id uuid,invitado_por uuid,activo boolean,permisos jsonb,updated_at timestamptz);
create table cliente_inventario(id bigint primary key,cliente_id uuid,created_at timestamptz default now(),categoria text,stock_disponible numeric,precio_unitario numeric,descripcion text,imagen_url text);
create index idx_cliente_inventario_cliente_created on cliente_inventario(cliente_id,created_at desc);
alter table cliente_inventario enable row level security;
grant usage on schema public,auth to authenticated,anon;
grant select,insert,update,delete on cliente_inventario to authenticated,anon;
"""
setup+=function('is_super_admin','20261002130000_equipo_rls_fundador.sql')
setup+=function('is_current_user_admin','20260115000002_fix_user_roles_rls.sql')
setup+=function('cliente_owner_id','20260824160000_cliente_owner_id.sql')
setup+=function('tiene_modulo_operativo','20261003010000_rls_permisos_operativo_cubo.sql')
for action in ['select','insert','update','delete']:
    pred='((cliente_id=public.cliente_owner_id() or cliente_id=auth.uid()) and public.tiene_modulo_operativo())'
    clauses=('using '+pred if action!='insert' else '')+(' with check '+pred if action in ['insert','update'] else '')
    setup+=f'create policy inv_{action}_owner on cliente_inventario for {action} {clauses};'
setup+=migration('20260904080000_inventario_resumen_y_paginacion.sql')
for n in range(1,9):
    setup+=f"insert into clientes values('{uid(100+n)}','{uid(n)}',now());"
for n,permissions in [(2,'["inventario"]'),(3,'["cobranza"]'),(4,'null')]:
    value = 'NULL' if permissions == 'null' else f"'{permissions}'::jsonb"
    setup+=f"insert into vendedores values('{uid(n)}','{uid(1)}',true,{value},now());"
for n,role in [(5,'admin'),(6,'super_admin')]:
    setup+=f"insert into user_roles values('{uid(n)}','{role}');"
setup+=f"insert into users_extended values('{uid(7)}','super_admin');"
setup+=f"insert into cliente_inventario select n,'{uid(101)}',now(),'A',1,2,'desc','image' from generate_series(1,16359) n;"
for n in range(1,9):
    setup+=f"insert into cliente_inventario values({20000+n},'{uid(100+n)}',now(),'own',1,2,'desc','image'),({30000+n},'{uid(n)}',now(),'legacy',1,2,'desc','image');"
setup+='analyze cliente_inventario;'
scenarios={'owner':1,'member_operational':2,'member_cobranza':3,'member_null':4,'admin':5,'superadmin_role':6,'superadmin_extended':7,'other_owner':8,'anon':None}
if args.emit_fixture:
    print(json.dumps({'setup':setup,'proposal':(root/'proposals'/'inventario_initplan.sql').read_text(),'scenarios':scenarios}))
    raise SystemExit(0)
sql(setup)
def session(n):
    role='authenticated' if n else 'anon'
    return f"begin;set local role {role};set local request.jwt.claim.sub='{uid(n) if n else ''}';"
def snapshot(n):
    out=sql(session(n)+"select json_build_object('ids',(select coalesce(json_agg(id order by id),'[]') from cliente_inventario),'summary',"+('public.cliente_inventario_resumen()' if n else 'null')+");rollback;")
    return json.loads(out)
def mutations(n):
    destinations=[uid(101),uid(108)]+([uid(n)] if n else [])
    transfer_target=uid(101) if n==8 else uid(108)
    results={}
    for dest in destinations:
        for action in ['insert','update','delete','transfer']:
            rowid=1 if dest==uid(101) else (20008 if dest==uid(108) else 30000+n)
            cmd={'insert':f"insert into cliente_inventario(id,cliente_id) values(99999,'{dest}') returning id;",'update':f'update cliente_inventario set stock_disponible=7 where id={rowid} returning id;', 'delete':f'delete from cliente_inventario where id={rowid} returning id;', 'transfer':f"update cliente_inventario set cliente_id='{transfer_target}' where id={rowid} returning id;"}[action]
            try: results[f'{dest}:{action}']=sql(session(n)+cmd+'rollback;')
            except RuntimeError as e:
                if 'row-level security' not in str(e): raise
                results[f'{dest}:{action}']='RLS denied'
    return results
queries={
    'page_offset_0':f"select id from cliente_inventario where cliente_id='{uid(101)}' order by created_at desc,id limit 100 offset 0",
    'page_offset_100':f"select id from cliente_inventario where cliente_id='{uid(101)}' order by created_at desc,id limit 100 offset 100",
    'count_exact':f"select count(*) from cliente_inventario where cliente_id='{uid(101)}'",
    'summary':'select public.cliente_inventario_resumen()',
}
def plan_summary(plan):
    nodes=[]
    def walk(node):
        nodes.append({k:node[k] for k in ['Node Type','Subplan Name','Actual Loops','Actual Rows','Actual Total Time'] if k in node})
        for child in node.get('Plans',[]): walk(child)
    walk(plan[0]['Plan'])
    return {'execution_ms':plan[0]['Execution Time'],'planning_ms':plan[0]['Planning Time'],
            'initplans':[node for node in nodes if node.get('Subplan Name','').startswith('InitPlan')],
            'nodes':nodes}
def plans():
    measures={}
    for key,query in queries.items():
        measures[key]=[]
        for repeat in range(3):
            plan=json.loads(sql(session(1)+'explain(analyze,buffers,format json) '+query+';rollback;'))
            measures[key].append({'repeat':repeat+1,'summary':plan_summary(plan),'explain':plan})
    return measures
def phase(): return {'scenarios':{name:{'read':snapshot(n),'writes':mutations(n)} for name,n in scenarios.items()},'plans':plans()}
before=phase()
sql((root/'proposals'/'inventario_initplan.sql').read_text())
after=phase()
assert before['scenarios']==after['scenarios'],'Authorization/result equivalence failed'
for name,n in scenarios.items():
    ids=after['scenarios'][name]['read']['ids']
    if name in ['member_cobranza','anon']: assert ids==[],name
    else:
        tenant=101 if n in [1,2,4] else 100+n
        expected=(list(range(1,16360))+[20001] if tenant==101 else [20000+n])+[30000+n]
        assert ids==sorted(expected),name
    writes=after['scenarios'][name]['writes']
    for dest in [uid(101),uid(108)]+([uid(n)] if n else []):
        allowed=bool(n and name!='member_cobranza' and (dest==uid(n) or dest==uid(101) and n in [1,2,4] or dest==uid(108) and n==8))
        assert writes[f'{dest}:insert']==('99999' if allowed else 'RLS denied'),(name,dest,'insert')
        rowid=1 if dest==uid(101) else (20008 if dest==uid(108) else 30000+n)
        for action in ['update','delete']:
            assert writes[f'{dest}:{action}']==(str(rowid) if allowed else ''),(name,dest,action)
    if n and name!='member_cobranza':
        assert writes[f'{uid(n)}:transfer']=='RLS denied', (name,'own legacy transfer')
    elif n:
        assert writes[f'{uid(n)}:transfer']=='', (name,'invisible legacy transfer')
    if n != 8:
        assert writes[f'{uid(108)}:insert']=='RLS denied',name
        assert writes[f'{uid(108)}:update']=='',name
        assert writes[f'{uid(108)}:delete']=='',name
    if n in [1,2,4]: assert writes[f'{uid(101)}:transfer']=='RLS denied',name
report={'fixture':'Partial schema; exact repository helper bodies; dependency tables owned by fixture superuser, only inventory RLS exercised. No production or remote DB touched.','measurement':'Three sequential warm-fixture measurements per query in one isolated database; no production workload reproduction or helper invocation counters. InitPlan and node loops recorded.', 'equivalent':True,'before':before,'after':after}
pathlib.Path(args.output).write_text(json.dumps(report,indent=2))
print('PASS: nine scenarios, reads and writes equivalent; evidence '+args.output)
