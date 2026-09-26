-- Panel del proveedor: a partir del RUT del cliente logueado, deduce qué vende
-- (productos de sus órdenes de compra), sus mejores instituciones compradoras,
-- palabras clave sugeridas y permite "seguir" instituciones para monitorearlas.

-- 1) Tabla de instituciones seguidas por el cliente (para avisos/monitoreo).
create table if not exists public.cliente_instituciones_seguidas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  rut_institucion text not null,
  nombre_institucion text,
  created_at timestamptz not null default now(),
  unique (cliente_id, rut_institucion)
);
create index if not exists idx_cis_cliente on public.cliente_instituciones_seguidas (cliente_id);

alter table public.cliente_instituciones_seguidas enable row level security;

drop policy if exists cis_select_owner on public.cliente_instituciones_seguidas;
drop policy if exists cis_insert_owner on public.cliente_instituciones_seguidas;
drop policy if exists cis_update_owner on public.cliente_instituciones_seguidas;
drop policy if exists cis_delete_owner on public.cliente_instituciones_seguidas;

create policy cis_select_owner on public.cliente_instituciones_seguidas
  for select using (cliente_id = (select public.cliente_owner_id()) or cliente_id = (select auth.uid()));
create policy cis_insert_owner on public.cliente_instituciones_seguidas
  for insert with check (cliente_id = (select public.cliente_owner_id()) or cliente_id = (select auth.uid()));
create policy cis_update_owner on public.cliente_instituciones_seguidas
  for update using (cliente_id = (select public.cliente_owner_id()) or cliente_id = (select auth.uid()));
create policy cis_delete_owner on public.cliente_instituciones_seguidas
  for delete using (cliente_id = (select public.cliente_owner_id()) or cliente_id = (select auth.uid()));

-- 2) RPC principal del panel. Security definer: resuelve la empresa dueña del
-- usuario, obtiene su RUT y agrega SOLO las OC donde ese RUT es proveedor.
create or replace function public.cliente_panel_proveedor(
  p_max_comp int default 8,
  p_max_prod int default 12
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cli uuid;
  v_rut text;
  v_result jsonb;
begin
  v_cli := coalesce(public.cliente_owner_id(), auth.uid());
  if v_cli is null then
    return jsonb_build_object('error', 'sin_cliente');
  end if;

  select nullif(btrim(rut), '') into v_rut from public.clientes where id = v_cli;
  if v_rut is null then
    return jsonb_build_object('sin_rut', true);
  end if;

  with mis_oc as (
    select o.numero_oc,
           coalesce(nullif(btrim(o.organismo_comprador), ''), nullif(btrim(o.demandante), '')) as institucion,
           o.rut_demandante,
           coalesce(o.total, o.monto_total, 0) as monto,
           o.fecha_emision
    from public.ordenes_compra o
    where o.rut_proveedor = v_rut
  ),
  resumen as (
    select count(*) as n_oc,
           coalesce(sum(monto), 0) as monto_total,
           count(distinct rut_demandante) as n_compradores,
           max(fecha_emision) as ultima
    from mis_oc
  ),
  compradores as (
    select coalesce(institucion, 'Sin nombre') as institucion,
           rut_demandante,
           count(*) as n_oc,
           coalesce(sum(monto), 0) as monto,
           max(fecha_emision) as ultima
    from mis_oc
    where rut_demandante is not null
    group by 1, 2
    order by monto desc
    limit greatest(p_max_comp, 1)
  ),
  productos as (
    select coalesce(nullif(btrim(i.producto), ''), '—') as producto,
           count(*) as veces,
           coalesce(sum(i.valor_total), 0) as monto
    from mis_oc m
    join public.ordenes_compra_items i on i.numero_oc = m.numero_oc
    group by 1
    order by veces desc, monto desc
    limit greatest(p_max_prod, 1)
  ),
  palabras as (
    select w.palabra, count(*) as freq
    from mis_oc m
    join public.ordenes_compra_items i on i.numero_oc = m.numero_oc
    cross join lateral regexp_split_to_table(lower(coalesce(nullif(btrim(i.producto_norm), ''), i.producto, '')), '[^a-z0-9áéíóúñ]+') as w(palabra)
    where length(w.palabra) > 3
      and w.palabra !~ '^[0-9]+$'
      and w.palabra not in ('para','con','sin','por','del','los','las','una','unos','unas','este','esta','esta','marca','modelo','color','tipo','cada','segun','codigo','unidad','producto','servicio','otros','varios','general','articulo','articulos','segun')
    group by w.palabra
    order by freq desc
    limit 12
  )
  select jsonb_build_object(
    'rut', v_rut,
    'resumen', (select to_jsonb(r) from resumen r),
    'compradores', coalesce((
      select jsonb_agg(to_jsonb(c) || jsonb_build_object(
        'seguida', exists(
          select 1 from public.cliente_instituciones_seguidas s
          where s.cliente_id = v_cli and s.rut_institucion = c.rut_demandante
        )
      )) from compradores c
    ), '[]'::jsonb),
    'productos', coalesce((select jsonb_agg(to_jsonb(p)) from productos p), '[]'::jsonb),
    'keywords', coalesce((
      select jsonb_agg(pl.palabra order by pl.freq desc)
      from palabras pl
      where not exists (
        select 1 from public.cliente_filtros_oportunidades f, unnest(coalesce(f.palabras_incluir, '{}')) as pi(w)
        where f.cliente_id = v_cli and lower(pi.w) = pl.palabra
      )
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.cliente_panel_proveedor(int, int) to authenticated;
