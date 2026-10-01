-- Minimal source fixtures matching the repository's existing schema. No production connection.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema extensions;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $$
 select nullif(current_setting('request.jwt.claim.role',true),'')
$$;
create table clientes(id uuid primary key,user_id uuid,created_at timestamptz default now());
create table vendedores(user_id uuid,invitado_por uuid,activo boolean,updated_at timestamptz);
create table instituciones(rut text primary key,codigo_entidad text,nombre text,region text,comuna text,
 pago_promedio_dias numeric,conducta_pago text,plazo_pago_texto text,reclamos_total integer,pago_actualizado_el timestamptz);
create table licitaciones_bi(id bigint primary key,codigo text,nombre text,estado text,fecha_publicacion timestamptz,
 institucion_rut text,institucion_codigo text,institucion_nombre text,codigo_estado integer,updated_at timestamptz default now());
create table licitaciones_adjudicaciones(licitacion_id bigint,proveedor_nombre text,monto_adjudicado numeric);
create table compras_agiles(codigo text,nombre text,estado text,fecha_publicacion timestamptz,organismo_rut text);
create table ordenes_compra(codigo text,nombre text,proveedor text,estado text,total numeric,fecha_emision timestamptz,
 link_oficial text,rut_demandante text);
create table notificaciones_log(id bigint generated always as identity primary key,cliente_id uuid,tipo text,
 licitacion_id text,email_enviado boolean,datos jsonb,created_at timestamptz default now(),leida boolean default false);
-- Approximate unaccent only for this ASCII synthetic fixture. Production uses the existing helper.
create function public.medios_norm(p text) returns text language sql immutable as $$
 select regexp_replace(lower(coalesce(p,'')),'[^a-z0-9]+',' ','g')
$$;
