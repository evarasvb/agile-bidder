-- Convenios marco oficiales desde datos abiertos de ChileCompra.
-- Fuente: https://transparenciachc.blob.core.windows.net/planillas-cm/[año]-[mes].zip
-- (ver docs/datos-abiertos-convenio-marco.md). Trae, por cada OC de convenio,
-- el número de licitación del convenio, su ID y su nombre oficial. La API de
-- Mercado Público no entrega ese dato, así que hasta ahora se deducía del nombre
-- de los productos. Desde aquí: dato oficial cuando existe el archivo del mes
-- (se publica ~día 11 del mes siguiente) y deducción solo como respaldo.

create table if not exists public.cm_convenios (
  codigo text primary key,                 -- Nro licitación del convenio, ej. 2239-9-LR24
  id_cm text,                              -- ID interno de ChileCompra
  nombre text not null,                    -- Nombre oficial completo
  nombre_corto text not null,              -- Etiqueta corta para el reporte
  categoria text,                          -- Categoría del clasificador por texto (cm_convenio_de)
  ultimo_periodo text,                     -- Último mes (YYYY-MM) en que aparece con OCs
  actualizado_en timestamptz not null default now()
);

create table if not exists public.cm_oc_convenio (
  codigo_oc text primary key,
  convenio_codigo text not null references public.cm_convenios(codigo),
  periodo text not null
);
create index if not exists idx_cm_oc_convenio_periodo on public.cm_oc_convenio (periodo);

create table if not exists public.cm_cargas (
  periodo text primary key,                -- YYYY-MM
  estado text not null default 'pendiente',-- ok | no_publicado | error
  filas integer,
  ocs integer,
  ocs_actualizadas integer,
  detalle text,
  cargado_en timestamptz
);

alter table public.cm_convenios enable row level security;
alter table public.cm_oc_convenio enable row level security;
alter table public.cm_cargas enable row level security;
drop policy if exists cm_convenios_lectura on public.cm_convenios;
create policy cm_convenios_lectura on public.cm_convenios for select to authenticated using (true);
drop policy if exists cm_cargas_lectura on public.cm_cargas;
create policy cm_cargas_lectura on public.cm_cargas for select to authenticated using (true);
grant select on public.cm_convenios, public.cm_cargas to authenticated;
grant all on public.cm_convenios, public.cm_oc_convenio, public.cm_cargas to service_role;

alter table public.ordenes_compra add column if not exists convenio_codigo text;
create index if not exists idx_oc_convenio_codigo on public.ordenes_compra (convenio_codigo) where convenio_codigo is not null;

-- Etiqueta corta a partir del nombre oficial ("Convenio Marco para la adquisición de X (Magento)" -> "X").
create or replace function public.cm_nombre_corto(p_nombre text)
returns text language plpgsql immutable as $$
declare t text;
begin
  t := coalesce(p_nombre, '');
  t := regexp_replace(t, '\s*\((magento|[0-9]{4})\)\s*', ' ', 'gi');
  t := regexp_replace(t, '^\s*((convenio marco|cm|lic\.?)\s*)*((de|para)\s+)?((la|el|los|las)\s+)?((adquisici[oó]n|suministro|compra)\s+(de\s+)?((los|las|la|el)\s+)?)?', '', 'i');
  t := trim(regexp_replace(t, '\s+', ' ', 'g'));
  if t = '' then return coalesce(p_nombre, ''); end if;
  if t = upper(t) then
    -- Nombres en mayúsculas: pasar a formato título con conectores en minúscula.
    select string_agg(case when lower(w) in ('de','del','y','e','la','las','el','los','para','con','en','o','u') then lower(w)
                           when lower(w) = 'ti' then 'TI' else initcap(w) end, ' ' order by ord)
      into t from regexp_split_to_table(t, ' ') with ordinality as s(w, ord);
  end if;
  return upper(left(t, 1)) || substr(t, 2);
end $$;

-- Categoría del clasificador por texto que corresponde a cada convenio oficial
-- (para sumar las OC estimadas del mes en curso a la fila correcta). Los convenios
-- antiguos o ambiguos quedan sin categoría y no reciben estimadas.
create or replace function public.cm_categoria_convenio(p_codigo text, p_nombre text)
returns text language sql immutable as $$
  select case upper(p_codigo)
    when '2239-21-LR23' then 'Insumos médicos'
    when '2239-12-LR25' then 'Transporte de pasajeros'
    when '2239-16-LR23' then 'Pasajes aéreos'
    when '2239-9-LR24'  then 'Alimentos'
    when '2239-23-LP10' then null
    when '2239-1-LR26'  then null
    when '2239-2-LR21'  then null
    when '2239-13-LR23' then null
    when '2239-4-LR22'  then null
    when '2239-15-LR25' then null
    else nullif(public.cm_convenio_de(p_nombre), 'Sin clasificar') end;
$$;

-- Si una categoría deducida corresponde a un solo convenio vigente, usar su nombre oficial
-- para que las OC estimadas (mes en curso) se sumen a la misma fila del reporte.
create or replace function public.cm_convenio_etiqueta(p_categoria text)
returns text language sql stable set search_path to 'public' as $$
  with vig as (
    select nombre_corto from public.cm_convenios
    where categoria = p_categoria and ultimo_periodo is not null
      and ultimo_periodo >= (select max(ultimo_periodo) from public.cm_convenios)
  )
  select case when (select count(*) from vig) = 1 then (select nombre_corto from vig) else p_categoria end;
$$;

-- Trigger: dato oficial si la OC está en cm_oc_convenio; si no, deducción por texto.
create or replace function public.oc_asignar_convenio()
returns trigger language plpgsql as $$
declare v_cod text; v_nom text;
begin
  if new.codigo like '%-CM%' then
    select o.convenio_codigo, c.nombre_corto into v_cod, v_nom
      from public.cm_oc_convenio o join public.cm_convenios c on c.codigo = o.convenio_codigo
     where o.codigo_oc = new.codigo;
    if v_cod is not null then
      new.convenio_codigo := v_cod; new.convenio := v_nom;
    elsif new.convenio_codigo is null then
      new.convenio := public.cm_convenio_etiqueta(public.cm_convenio_de(public.cm_texto_oc(new.raw_json, new.nombre, new.codigo)));
    end if;
  end if;
  return new;
end $$;

create or replace function public.cm_reclasificar_pendientes(p_dias integer default 90)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  update public.ordenes_compra oc
     set convenio = public.cm_convenio_etiqueta(public.cm_convenio_de(public.cm_texto_oc(oc.raw_json, oc.nombre, oc.codigo)))
   where oc.codigo like '%-CM%' and oc.convenio_codigo is null
     and coalesce(oc.convenio, 'Sin clasificar') = 'Sin clasificar'
     and oc.fecha_emision >= now() - make_interval(days => greatest(1, p_dias));
  get diagnostics n = row_count;
  return n;
end $$;

-- Carga de un mes: convenios + relación OC->convenio + actualización de ordenes_compra.
-- p_convenios: [{codigo, id_cm, nombre}], p_ocs: [{oc, cm}]. Solo service_role.
create or replace function public.cm_cargar_convenios(p_periodo text, p_convenios jsonb, p_ocs jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n_conv integer := 0; n_ocs integer := 0; n_upd integer := 0; n integer; r record;
begin
  if p_periodo !~ '^\d{4}-\d{2}$' then raise exception 'periodo inválido: %', p_periodo; end if;

  insert into public.cm_convenios (codigo, id_cm, nombre, nombre_corto, categoria, ultimo_periodo)
  select x.codigo, nullif(x.id_cm, ''), x.nombre, public.cm_nombre_corto(x.nombre), public.cm_categoria_convenio(x.codigo, x.nombre), p_periodo
    from jsonb_to_recordset(coalesce(p_convenios, '[]'::jsonb)) as x(codigo text, id_cm text, nombre text)
   where x.codigo is not null and x.codigo <> '' and x.codigo <> 'NA' and coalesce(x.nombre, '') <> ''
   order by x.codigo -- orden fijo: evita deadlocks entre cargas de meses en paralelo
  on conflict (codigo) do update
     set id_cm = coalesce(excluded.id_cm, public.cm_convenios.id_cm),
         nombre = excluded.nombre,
         nombre_corto = public.cm_nombre_corto(excluded.nombre),
         categoria = excluded.categoria,
         ultimo_periodo = greatest(coalesce(public.cm_convenios.ultimo_periodo, ''), excluded.ultimo_periodo),
         actualizado_en = now();
  get diagnostics n_conv = row_count;

  insert into public.cm_oc_convenio (codigo_oc, convenio_codigo, periodo)
  select x.oc, x.cm, p_periodo
    from jsonb_to_recordset(coalesce(p_ocs, '[]'::jsonb)) as x(oc text, cm text)
    join public.cm_convenios c on c.codigo = x.cm
   where x.oc is not null and x.oc <> ''
   order by x.oc
  on conflict (codigo_oc) do update set convenio_codigo = excluded.convenio_codigo, periodo = excluded.periodo;
  get diagnostics n_ocs = row_count;

  -- Fila a fila por el índice único de codigo: con un join el planificador puede
  -- elegir un recorrido completo de ordenes_compra (1,3 M filas) y superar los 8 s.
  for r in
    select x.oc, x.cm, c.nombre_corto
      from jsonb_to_recordset(coalesce(p_ocs, '[]'::jsonb)) as x(oc text, cm text)
      join public.cm_convenios c on c.codigo = x.cm
     order by x.oc
  loop
    update public.ordenes_compra o set convenio_codigo = r.cm, convenio = r.nombre_corto
     where o.codigo = r.oc and (o.convenio_codigo is distinct from r.cm or o.convenio is distinct from r.nombre_corto);
    get diagnostics n = row_count; n_upd := n_upd + n;
  end loop;

  return jsonb_build_object('convenios', n_conv, 'ocs', n_ocs, 'actualizadas', n_upd);
end $$;
revoke all on function public.cm_cargar_convenios(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.cm_cargar_convenios(text, jsonb, jsonb) to service_role;

-- Re-etiquetar OC ya cargadas cuando cambia el nombre corto o aparece un convenio oficial.
create or replace function public.cm_sincronizar_ocs(p_periodo text default null)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n integer;
begin
  update public.ordenes_compra o
     set convenio_codigo = r.convenio_codigo, convenio = c.nombre_corto
    from public.cm_oc_convenio r join public.cm_convenios c on c.codigo = r.convenio_codigo
   where o.codigo = r.codigo_oc and (p_periodo is null or r.periodo = p_periodo)
     and (o.convenio_codigo is distinct from r.convenio_codigo or o.convenio is distinct from c.nombre_corto);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cm_sincronizar_ocs(text) from public, anon, authenticated;
grant execute on function public.cm_sincronizar_ocs(text) to service_role;

create or replace function public.cm_refrescar_por_convenio()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  refresh materialized view concurrently public.mv_cm_por_convenio;
end $$;
revoke all on function public.cm_refrescar_por_convenio() from public, anon, authenticated;
grant execute on function public.cm_refrescar_por_convenio() to service_role;

-- Vista mensual: ahora distingue oficial (codigo) de estimado (codigo null).
drop materialized view if exists public.mv_cm_por_convenio;
create materialized view public.mv_cm_por_convenio as
select extract(year from fecha_emision)::int as anio,
       date_trunc('month', fecha_emision)::date as mes,
       convenio,
       convenio_codigo as codigo,
       count(*)::int as ocs,
       sum(coalesce(total, 0))::numeric as monto_total,
       count(distinct coalesce(rut_proveedor, proveedor))::int as proveedores,
       count(distinct coalesce(rut_demandante, demandante))::int as organismos
from public.ordenes_compra
where convenio is not null and fecha_emision is not null and codigo like '%-CM%'
group by 1, 2, 3, 4;
-- "nulls not distinct" para que el refresh concurrente acepte el índice (solo columnas).
create unique index ux_mv_cm_por_convenio on public.mv_cm_por_convenio (anio, mes, convenio, codigo) nulls not distinct;
grant select on public.mv_cm_por_convenio to authenticated, service_role;

drop function if exists public.cm_por_convenio(integer);
create or replace function public.cm_por_convenio(p_anio integer default extract(year from now())::int)
returns table (convenio text, codigo text, ocs bigint, estimadas bigint, monto_total numeric, proveedores integer, organismos integer, participacion numeric)
language sql stable security definer set search_path to 'public' as $$
  with base as (
    select convenio, max(codigo) codigo, sum(ocs) ocs, sum(ocs) filter (where codigo is null) estimadas, sum(monto_total) monto_total
    from public.mv_cm_por_convenio where anio = p_anio group by 1
  ),
  distintos as (
    select convenio, count(distinct coalesce(rut_proveedor, proveedor))::int proveedores, count(distinct coalesce(rut_demandante, demandante))::int organismos
    from public.ordenes_compra where convenio is not null and codigo like '%-CM%'
      and fecha_emision >= make_date(p_anio, 1, 1) and fecha_emision < make_date(p_anio + 1, 1, 1)
    group by 1
  ),
  tot as (select sum(monto_total) t from base)
  select b.convenio, b.codigo, b.ocs, coalesce(b.estimadas, 0), b.monto_total, d.proveedores, d.organismos,
         case when tot.t > 0 then round(100 * b.monto_total / tot.t, 1) else 0 end
  from base b left join distintos d using (convenio) cross join tot
  order by b.monto_total desc;
$$;
grant execute on function public.cm_por_convenio(integer) to authenticated, service_role;

create or replace function public.cm_convenio_meses(p_convenio text, p_anio integer default extract(year from now())::int)
returns table (mes date, ocs integer, monto_total numeric)
language sql stable security definer set search_path to 'public' as $$
  select mes, sum(ocs)::int, sum(monto_total) from public.mv_cm_por_convenio
  where convenio = p_convenio and anio = p_anio group by mes order by mes;
$$;

-- Cron diario: carga el mes anterior cuando ChileCompra lo publica (idempotente).
do $$
declare v bigint;
begin
  select jobid into v from cron.job where jobname = 'cargar-cm-convenios';
  if v is not null then perform cron.unschedule(v); end if;
  perform cron.schedule('cargar-cm-convenios', '40 6 * * *', $cmd$
    select net.http_post(
      url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/cm-cargar-convenios',
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_jwt_legacy')),
      body := '{}'::jsonb,
      timeout_milliseconds := 150000);
  $cmd$);
end $$;
