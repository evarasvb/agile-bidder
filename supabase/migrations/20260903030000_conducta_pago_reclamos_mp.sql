-- Conducta de pago real de las instituciones, tomada de la ficha pública de Mercado Público
-- ("Reclamos recibidos por incumplir plazo de pago", últimos 12 meses, + plazo de pago declarado).
-- La ficha de licitación es pública; la de compra ágil y la del comprador exigen sesión.

-- 1. Histórico: una foto por institución y día, para ver tendencia.
create table if not exists public.institucion_pago_snapshot (
  id bigserial primary key,
  rut text not null,
  fecha date not null default current_date,
  reclamos_12m integer,
  plazo_pago text,
  fuente_licitacion text,
  created_at timestamptz not null default now(),
  unique (rut, fecha)
);
create index if not exists institucion_pago_snapshot_rut_fecha_idx on public.institucion_pago_snapshot (rut, fecha desc);
alter table public.institucion_pago_snapshot enable row level security;
drop policy if exists "lectura autenticados" on public.institucion_pago_snapshot;
create policy "lectura autenticados" on public.institucion_pago_snapshot for select to authenticated using (true);

-- 2. Columnas nuevas en instituciones (las de conducta_pago / reclamos_total ya existían).
alter table public.instituciones
  add column if not exists plazo_pago_texto text,
  add column if not exists pago_fuente text;
comment on column public.instituciones.reclamos_total is 'Reclamos por incumplir plazo de pago en los últimos 12 meses, según ficha pública de Mercado Público.';
comment on column public.instituciones.pago_actualizado_el is 'Última vez que se leyó la ficha de Mercado Público para esta institución.';
comment on column public.instituciones.pago_fuente is 'Código de la licitación cuya ficha se leyó.';

-- 3. Cola de trabajo: instituciones con licitación reciente, las más desactualizadas primero.
create or replace function public.instituciones_pendientes_pago(p_limit integer default 30, p_dias integer default 7)
returns table (rut text, nombre text, codigos text[])
language sql stable security definer set search_path to 'public' as $$
  select i.rut, i.nombre,
         (select array_agg(b.codigo order by b.fecha_publicacion desc)
            from (select codigo, fecha_publicacion from public.licitaciones_bi b
                   where b.institucion_rut = i.rut order by b.fecha_publicacion desc limit 2) b) as codigos
  from public.instituciones i
  where exists (select 1 from public.licitaciones_bi b where b.institucion_rut = i.rut
                  and b.fecha_publicacion >= now() - interval '18 months')
    and (i.pago_actualizado_el is null or i.pago_actualizado_el < now() - make_interval(days => p_dias))
  order by i.pago_actualizado_el nulls first, i.oc_monto_total desc nulls last
  limit least(p_limit, 200);
$$;
revoke execute on function public.instituciones_pendientes_pago(integer, integer) from public, anon, authenticated;
grant execute on function public.instituciones_pendientes_pago(integer, integer) to service_role;

-- 4. Registro de una lectura.
create or replace function public.registrar_conducta_pago(p_rut text, p_reclamos integer, p_plazo text, p_codigo text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.institucion_pago_snapshot (rut, fecha, reclamos_12m, plazo_pago, fuente_licitacion)
  values (p_rut, current_date, p_reclamos, p_plazo, p_codigo)
  on conflict (rut, fecha) do update
    set reclamos_12m = excluded.reclamos_12m, plazo_pago = excluded.plazo_pago, fuente_licitacion = excluded.fuente_licitacion;

  update public.instituciones set
    reclamos_total = p_reclamos,
    reclamos_ultima_fecha = case when p_reclamos > 0 then now() else reclamos_ultima_fecha end,
    plazo_pago_texto = coalesce(p_plazo, plazo_pago_texto),
    pago_fuente = p_codigo,
    pago_actualizado_el = now(),
    updated_at = now()
  where rut = p_rut;
end $$;
revoke execute on function public.registrar_conducta_pago(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.registrar_conducta_pago(text, integer, text, text) to service_role;

-- 5. Marcar como intentada aunque la ficha no se pudiera leer (para no reintentar en bucle).
create or replace function public.marcar_intento_pago(p_rut text)
returns void language sql security definer set search_path to 'public' as $$
  update public.instituciones set pago_actualizado_el = now() where rut = p_rut;
$$;
revoke execute on function public.marcar_intento_pago(text) from public, anon, authenticated;
grant execute on function public.marcar_intento_pago(text) to service_role;

-- 6. El Experto recibe además el plazo de pago declarado, la fecha del dato y la tendencia.
drop function if exists public.experto_organismo(text);
create or replace function public.experto_organismo(nombre_o_rut text)
returns table (institucion text, rut text, region text, conducta_pago text, pago_promedio_dias integer,
               reclamos integer, reclamos_hace_90d integer, plazo_pago text, dato_pago_al date,
               oc_total integer, oc_monto_total numeric, oc_12m integer, monto_12m numeric,
               top_proveedores jsonb, licitaciones_abiertas integer)
language sql stable security definer set search_path to 'public' as $$
  with i as (
    select * from public.instituciones
    where rut = nombre_o_rut or nombre ilike '%'||nombre_o_rut||'%'
    order by oc_monto_total desc nulls last limit 1),
  oc as (
    select o.* from public.ordenes_compra o, i
    where o.rut_demandante = i.rut
      and coalesce(o.fecha_envio_oc, o.fecha_emision) >= now() - interval '12 months'),
  top as (
    select jsonb_agg(jsonb_build_object('proveedor', proveedor, 'rut', rut_proveedor, 'ordenes', n, 'monto', m) order by m desc) j
    from (select coalesce(proveedor, proveedor_nombre) proveedor, rut_proveedor, count(*) n, sum(coalesce(total, monto_total)) m
          from oc group by 1,2 order by m desc limit 8) t)
  select i.nombre, i.rut, i.region, i.conducta_pago, i.pago_promedio_dias, i.reclamos_total,
         (select s.reclamos_12m from public.institucion_pago_snapshot s
            where s.rut = i.rut and s.fecha <= current_date - 90 order by s.fecha desc limit 1),
         i.plazo_pago_texto, i.pago_actualizado_el::date,
         i.oc_total, i.oc_monto_total,
         (select count(*) from oc)::int, (select sum(coalesce(total, monto_total)) from oc),
         (select j from top),
         (select count(*) from public.licitaciones_bi l where l.institucion_rut = i.rut and l.fecha_cierre > now())::int
  from i;
$$;
grant execute on function public.experto_organismo(text) to service_role;
