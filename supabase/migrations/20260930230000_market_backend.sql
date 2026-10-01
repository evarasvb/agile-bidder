-- Backend del Market de proveedores del Estado (mk_*), versionado en el repo.
-- Estos objetos ya existían en producción (creados en una sesión anterior sin
-- migración); esta migración los deja en el control de versiones para que un
-- entorno nuevo provisionado desde el repo también los tenga. Es idempotente:
-- en prod es un no-op (tablas/índices ya existen; funciones se re-crean iguales).
-- Depende de objetos previos: clientes, cliente_inventario, notifications,
-- ordenes_compra, ordenes_compra_items, public.rut_norm(text), public.cliente_owner_id().

create extension if not exists pg_trgm;

-- ── Tablas ───────────────────────────────────────────────────────
create table if not exists public.mk_directorio (
  rut_norm text not null,
  rut text,
  proveedor text,
  producto_norm text not null,
  producto text,
  codigo_producto text,
  n_oc integer,
  cantidad_total numeric,
  precio_min numeric,
  precio_mediana numeric,
  precio_max numeric,
  n_organismos integer,
  ultima_venta timestamptz,
  primary key (rut_norm, producto_norm)
);

create table if not exists public.mk_perfiles (
  cliente_id uuid primary key references public.clientes (id) on delete cascade,
  rut_norm text,
  visible boolean not null default true,
  nombre_publico text,
  descripcion text,
  regiones_despacho text[],
  acepta_solicitudes boolean not null default true,
  whatsapp_publico text,
  email_publico text,
  sitio_web text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.mk_solicitudes (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.clientes (id) on delete cascade,
  proveedor_id uuid references public.clientes (id) on delete set null,
  proveedor_rut_norm text,
  proveedor_nombre text,
  producto text not null,
  cantidad numeric,
  unidad text,
  region_entrega text,
  fecha_requerida date,
  oportunidad_codigo text,
  mensaje text,
  estado text not null default 'enviada'
    check (estado in ('enviada', 'vista', 'cotizada', 'aceptada', 'rechazada', 'cerrada', 'invitacion_pendiente')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.mk_cotizaciones (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.mk_solicitudes (id) on delete cascade,
  autor_id uuid not null references public.clientes (id) on delete cascade,
  precio_unitario numeric,
  plazo_entrega_dias integer,
  validez_dias integer default 15,
  mensaje text,
  created_at timestamptz default now()
);

-- ── Índices ──────────────────────────────────────────────────────
create index if not exists idx_mkdir_codigo on public.mk_directorio (codigo_producto);
create index if not exists idx_mkdir_prod_trgm on public.mk_directorio using gin (producto_norm gin_trgm_ops);
create index if not exists idx_mkperf_rut on public.mk_perfiles (rut_norm);
create index if not exists idx_mksol_prov on public.mk_solicitudes (proveedor_id, created_at desc);
create index if not exists idx_mksol_solic on public.mk_solicitudes (solicitante_id, created_at desc);
create index if not exists idx_mkcot_sol on public.mk_cotizaciones (solicitud_id);

-- ── Grants de tabla (el acceso real lo restringe RLS) ────────────
grant select, insert, update, delete on
  public.mk_directorio, public.mk_perfiles, public.mk_solicitudes, public.mk_cotizaciones
  to anon, authenticated, service_role;

-- ── RLS + políticas ──────────────────────────────────────────────
alter table public.mk_directorio enable row level security;
alter table public.mk_perfiles enable row level security;
alter table public.mk_solicitudes enable row level security;
alter table public.mk_cotizaciones enable row level security;

drop policy if exists mkdir_select_all on public.mk_directorio;
create policy mkdir_select_all on public.mk_directorio for select to anon, authenticated using (true);

drop policy if exists mkperf_select on public.mk_perfiles;
create policy mkperf_select on public.mk_perfiles for select to anon, authenticated
  using (visible or (cliente_id = (select public.cliente_owner_id())));
drop policy if exists mkperf_ins on public.mk_perfiles;
create policy mkperf_ins on public.mk_perfiles for insert to authenticated
  with check (cliente_id = (select public.cliente_owner_id()));
drop policy if exists mkperf_upd on public.mk_perfiles;
create policy mkperf_upd on public.mk_perfiles for update to authenticated
  using (cliente_id = (select public.cliente_owner_id()))
  with check (cliente_id = (select public.cliente_owner_id()));
drop policy if exists mkperf_del on public.mk_perfiles;
create policy mkperf_del on public.mk_perfiles for delete to authenticated
  using (cliente_id = (select public.cliente_owner_id()));

drop policy if exists mksol_select on public.mk_solicitudes;
create policy mksol_select on public.mk_solicitudes for select to authenticated
  using ((solicitante_id = (select public.cliente_owner_id())) or (proveedor_id = (select public.cliente_owner_id())));
drop policy if exists mksol_ins on public.mk_solicitudes;
create policy mksol_ins on public.mk_solicitudes for insert to authenticated
  with check (solicitante_id = (select public.cliente_owner_id()));
drop policy if exists mksol_upd on public.mk_solicitudes;
create policy mksol_upd on public.mk_solicitudes for update to authenticated
  using ((solicitante_id = (select public.cliente_owner_id())) or (proveedor_id = (select public.cliente_owner_id())))
  with check ((solicitante_id = (select public.cliente_owner_id())) or (proveedor_id = (select public.cliente_owner_id())));

drop policy if exists mkcot_select on public.mk_cotizaciones;
create policy mkcot_select on public.mk_cotizaciones for select to authenticated
  using (exists (
    select 1 from public.mk_solicitudes s
    where s.id = mk_cotizaciones.solicitud_id
      and ((s.solicitante_id = (select public.cliente_owner_id())) or (s.proveedor_id = (select public.cliente_owner_id())))));
drop policy if exists mkcot_ins on public.mk_cotizaciones;
create policy mkcot_ins on public.mk_cotizaciones for insert to authenticated
  with check ((autor_id = (select public.cliente_owner_id())) and exists (
    select 1 from public.mk_solicitudes s
    where s.id = mk_cotizaciones.solicitud_id
      and ((s.solicitante_id = (select public.cliente_owner_id())) or (s.proveedor_id = (select public.cliente_owner_id())))));

-- ── Funciones de trigger (avisos + enlazar invitaciones) ─────────
CREATE OR REPLACE FUNCTION public.mk_avisar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid; txt text;
begin
  if tg_table_name = 'mk_solicitudes' then
    if new.proveedor_id is null or (tg_op = 'UPDATE' and old.proveedor_id is not distinct from new.proveedor_id) then return new; end if;
    select user_id into uid from clientes where id = new.proveedor_id;
    txt := '🤝 Marketplace: '||coalesce((select empresa_nombre from clientes where id = new.solicitante_id),'Un proveedor')||
           ' te pide cotizar "'||left(new.producto,80)||'"'||coalesce(' (x'||trim(to_char(new.cantidad,'FM999G999G999'))||')','')||
           coalesce(' para '||new.oportunidad_codigo,'')||'.';
  else
    select c.user_id into uid from mk_solicitudes s join clientes c on c.id = s.solicitante_id where s.id = new.solicitud_id;
    txt := '💬 Marketplace: te cotizaron'||coalesce(' a $'||trim(to_char(new.precio_unitario,'FM999G999G999'))||' c/u','')||
           coalesce(', entrega en '||new.plazo_entrega_dias||' días','')||'.';
  end if;
  if uid is not null then insert into notifications (user_id, message) values (uid, txt); end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.mk_enlazar_solicitudes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.rut is not null then
    update mk_solicitudes set proveedor_id = new.id, estado = 'enviada', updated_at = now()
    where proveedor_id is null and proveedor_rut_norm = public.rut_norm(new.rut) and solicitante_id <> new.id;
  end if;
  return new;
end $function$;

drop trigger if exists trg_mk_sol_aviso on public.mk_solicitudes;
create trigger trg_mk_sol_aviso after insert or update of proveedor_id on public.mk_solicitudes
  for each row execute function public.mk_avisar();
drop trigger if exists trg_mk_cot_aviso on public.mk_cotizaciones;
create trigger trg_mk_cot_aviso after insert on public.mk_cotizaciones
  for each row execute function public.mk_avisar();
drop trigger if exists trg_mk_enlazar on public.clientes;
create trigger trg_mk_enlazar after insert or update of rut on public.clientes
  for each row execute function public.mk_enlazar_solicitudes();

-- ── RPC ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mk_buscar(p_q text, p_limit integer DEFAULT 30)
 RETURNS TABLE(rut text, proveedor text, es_firmavb boolean, acepta_solicitudes boolean, cliente_id uuid, productos jsonb, n_oc integer, n_organismos integer, precio_mediana numeric, ultima_venta timestamp with time zone, relevancia real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
declare t text := lower(unaccent(trim(coalesce(p_q,'')))); w text[]; pat text;
begin
  select array_agg(x) into w from unnest(regexp_split_to_array(t, '\s+')) x where length(x) >= 3;
  if w is null then return; end if;
  return query
  with hits as (
    select d.*, word_similarity(t, d.producto_norm) ws
    from mk_directorio d
    where (select bool_and(d.producto_norm ilike '%'||left(x, greatest(4, length(x)-2))||'%') from unnest(w) x)
  ),
  pub as (
    select h.rut_norm, max(h.rut) rut, max(h.proveedor) proveedor,
           (select jsonb_agg(jsonb_build_object('producto', z.producto, 'n_oc', z.n_oc, 'precio_mediana', round(z.precio_mediana), 'ultima', z.ultima_venta::date))
              from (select * from hits h2 where h2.rut_norm = h.rut_norm order by h2.ws desc, h2.n_oc desc limit 4) z) productos,
           sum(h.n_oc)::int n_oc, max(h.n_organismos)::int n_org,
           percentile_cont(0.5) within group (order by h.precio_mediana) pm, max(h.ultima_venta) ult, max(h.ws) ws
    from hits h group by h.rut_norm
  ),
  inv as (
    select public.rut_norm(c.rut) rut_norm, c.rut, coalesce(p.nombre_publico, c.empresa_nombre) proveedor, c.id cid, p.acepta_solicitudes acepta,
           jsonb_agg(jsonb_build_object('producto', coalesce(ci.nombre_producto, ci.nombre), 'precio', ci.precio_unitario, 'stock', ci.stock_disponible, 'catalogo', true)) productos
    from cliente_inventario ci
    join clientes c on c.id = ci.cliente_id
    join mk_perfiles p on p.cliente_id = c.id and p.visible
    where (select bool_and(lower(unaccent(coalesce(ci.nombre_producto, ci.nombre,''))) ilike '%'||left(x, greatest(4, length(x)-2))||'%') from unnest(w) x)
    group by 1,2,3,4,5
  ),
  fv as (select public.rut_norm(c.rut) rn, c.id, coalesce(p.acepta_solicitudes, false) acepta
         from clientes c left join mk_perfiles p on p.cliente_id = c.id where c.rut is not null)
  select coalesce(pub.rut, inv.rut), coalesce(inv.proveedor, pub.proveedor),
         (fv.id is not null or inv.cid is not null), coalesce(inv.acepta, fv.acepta, false), coalesce(inv.cid, fv.id),
         coalesce(inv.productos, '[]'::jsonb) || coalesce(pub.productos, '[]'::jsonb),
         coalesce(pub.n_oc, 0), coalesce(pub.n_org, 0), round(pub.pm::numeric), pub.ult,
         (coalesce(pub.ws, 0.5) + case when inv.cid is not null or fv.id is not null then 2 else 0 end
          + ln(1 + coalesce(pub.n_oc, 0)) / 4 + coalesce(pub.n_org, 0) / 50.0)::real
  from pub full join inv on inv.rut_norm = pub.rut_norm
  left join fv on fv.rn = coalesce(pub.rut_norm, inv.rut_norm)
  order by 11 desc
  limit least(greatest(p_limit, 1), 60);
end $function$;

CREATE OR REPLACE FUNCTION public.mk_solicitar(p_rut_proveedor text, p_producto text, p_cantidad numeric DEFAULT NULL::numeric, p_unidad text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_fecha date DEFAULT NULL::date, p_oportunidad text DEFAULT NULL::text, p_mensaje text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo uuid := public.cliente_owner_id(); prov uuid; nom text; sid uuid;
begin
  if yo is null then raise exception 'Debes iniciar sesión como cliente FirmaVB'; end if;
  if coalesce(trim(p_producto),'') = '' then raise exception 'Falta el producto'; end if;
  select c.id, c.empresa_nombre into prov, nom from clientes c where public.rut_norm(c.rut) = public.rut_norm(p_rut_proveedor) limit 1;
  if prov = yo then raise exception 'No puedes cotizarte a ti mismo'; end if;
  if nom is null then select proveedor into nom from mk_directorio where rut_norm = public.rut_norm(p_rut_proveedor) limit 1; end if;
  insert into mk_solicitudes (solicitante_id, proveedor_id, proveedor_rut_norm, proveedor_nombre, producto, cantidad, unidad, region_entrega,
                              fecha_requerida, oportunidad_codigo, mensaje, estado)
  values (yo, prov, public.rut_norm(p_rut_proveedor), nom, left(p_producto, 500), p_cantidad, p_unidad, p_region, p_fecha,
          p_oportunidad, left(p_mensaje, 2000), case when prov is null then 'invitacion_pendiente' else 'enviada' end)
  returning id into sid;
  return sid;
end $function$;

CREATE OR REPLACE FUNCTION public.mk_cotizar(p_solicitud uuid, p_precio numeric, p_plazo integer, p_mensaje text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo uuid := public.cliente_owner_id(); cid uuid;
begin
  if not exists (select 1 from mk_solicitudes where id = p_solicitud and proveedor_id = yo) then raise exception 'Solicitud no encontrada'; end if;
  insert into mk_cotizaciones (solicitud_id, autor_id, precio_unitario, plazo_entrega_dias, mensaje) values (p_solicitud, yo, p_precio, p_plazo, left(p_mensaje,2000)) returning id into cid;
  update mk_solicitudes set estado = 'cotizada', updated_at = now() where id = p_solicitud;
  return cid;
end $function$;

CREATE OR REPLACE FUNCTION public.mk_mis_solicitudes()
 RETURNS TABLE(id uuid, rol text, contraparte text, producto text, cantidad numeric, oportunidad_codigo text, estado text, created_at timestamp with time zone, cotizaciones jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, case when s.solicitante_id = public.cliente_owner_id() then 'enviada' else 'recibida' end,
         case when s.solicitante_id = public.cliente_owner_id() then s.proveedor_nombre else (select empresa_nombre from clientes where id = s.solicitante_id) end,
         s.producto, s.cantidad, s.oportunidad_codigo, s.estado, s.created_at,
         coalesce((select jsonb_agg(to_jsonb(k) - 'solicitud_id' order by k.created_at) from mk_cotizaciones k where k.solicitud_id = s.id), '[]')
  from mk_solicitudes s
  where public.cliente_owner_id() in (s.solicitante_id, s.proveedor_id)
  order by s.created_at desc limit 200;
$function$;

CREATE OR REPLACE FUNCTION public.mk_refrescar_directorio(p_desde timestamp with time zone DEFAULT (now() - '2 years'::interval), p_hasta timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '600s'
AS $function$
declare n integer;
begin
  insert into public.mk_directorio as d (rut_norm, rut, proveedor, producto_norm, producto, codigo_producto, n_oc, cantidad_total,
     precio_min, precio_mediana, precio_max, n_organismos, ultima_venta)
  select public.rut_norm(o.rut_proveedor), max(o.rut_proveedor), max(coalesce(o.proveedor, o.proveedor_nombre)),
         left(i.producto_norm, 300), max(i.producto), max(nullif(i.codigo_producto,'0')),
         count(distinct o.numero_oc), sum(i.cantidad),
         min(i.precio_unitario) filter (where i.precio_unitario > 0),
         percentile_cont(0.5) within group (order by i.precio_unitario) filter (where i.precio_unitario > 0),
         max(i.precio_unitario),
         count(distinct o.rut_demandante), max(o.fecha_emision)
  from public.ordenes_compra_items i
  join public.ordenes_compra o on o.numero_oc = i.numero_oc
  where o.fecha_emision >= p_desde and o.fecha_emision < p_hasta
    and o.rut_proveedor is not null and coalesce(i.producto_norm,'') <> ''
  group by 1, 4
  on conflict (rut_norm, producto_norm) do update set
    n_oc = excluded.n_oc, cantidad_total = excluded.cantidad_total, precio_min = excluded.precio_min,
    precio_mediana = excluded.precio_mediana, precio_max = excluded.precio_max,
    n_organismos = excluded.n_organismos, ultima_venta = greatest(d.ultima_venta, excluded.ultima_venta),
    proveedor = coalesce(excluded.proveedor, d.proveedor), codigo_producto = coalesce(excluded.codigo_producto, d.codigo_producto);
  get diagnostics n = row_count;
  return n;
end $function$;

-- ── Grants de ejecución ──────────────────────────────────────────
grant execute on function public.mk_buscar(text, integer) to anon, authenticated, service_role;
grant execute on function public.mk_mis_solicitudes() to anon, authenticated, service_role;
revoke execute on function public.mk_solicitar(text, text, numeric, text, text, date, text, text) from public, anon;
grant execute on function public.mk_solicitar(text, text, numeric, text, text, date, text, text) to authenticated, service_role;
revoke execute on function public.mk_cotizar(uuid, numeric, integer, text) from public, anon;
grant execute on function public.mk_cotizar(uuid, numeric, integer, text) to authenticated, service_role;
revoke execute on function public.mk_refrescar_directorio(timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
grant execute on function public.mk_refrescar_directorio(timestamp with time zone, timestamp with time zone) to service_role;
