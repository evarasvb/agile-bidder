-- Onboarding con RUT verificado y WhatsApp para avisos importantes (pedido de
-- Evaristo tras revisar a la competencia): con el RUT se muestra lo que la
-- empresa ya vendió al Estado (datos reales de órdenes de compra, nada
-- inventado) y se precargan palabras clave e instituciones a seguir. El
-- WhatsApp se usa solo para lo que sí se avisa fuera de la plataforma:
-- adjudicación ganada y novedades de FirmaVB.

alter table public.clientes add column if not exists whatsapp text;
alter table public.cliente_notificaciones add column if not exists whatsapp_avisos boolean not null default true;

-- RUT tal como está en ordenes_compra ("12.345.678-9"); null si no tiene forma de RUT.
create or replace function public.rut_normalizar(p text)
returns text
language sql
immutable
as $$
  with l as (select upper(regexp_replace(coalesce(p, ''), '[^0-9kK]', '', 'g')) as s)
  select case when length(s) between 8 and 9 and left(s, length(s) - 1) ~ '^\d+$'
              then regexp_replace(left(s, length(s) - 1), '(\d)(?=(\d{3})+$)', '\1.', 'g') || '-' || right(s, 1)
              else null end
  from l;
$$;

-- Dígito verificador (módulo 11).
create or replace function public.rut_valido(p text)
returns boolean
language plpgsql
immutable
as $$
declare s text; cuerpo text; dv text; suma int := 0; mult int := 2; i int; calc int; dvc text;
begin
  s := upper(regexp_replace(coalesce(p, ''), '[^0-9kK]', '', 'g'));
  if length(s) < 8 or length(s) > 9 then return false; end if;
  cuerpo := left(s, length(s) - 1); dv := right(s, 1);
  if cuerpo !~ '^\d+$' then return false; end if;
  for i in reverse length(cuerpo)..1 loop
    suma := suma + substr(cuerpo, i, 1)::int * mult;
    mult := case when mult = 7 then 2 else mult + 1 end;
  end loop;
  calc := 11 - (suma % 11);
  dvc := case calc when 11 then '0' when 10 then 'K' else calc::text end;
  return dvc = dv;
end;
$$;

-- Historial real del RUT en Mercado Público: órdenes de compra, a quién le vendió,
-- rubros y productos. Solo para usuarios autenticados (su propio onboarding).
create or replace function public.onboarding_por_rut(p_rut text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with r as (select public.rut_normalizar(p_rut) as rut),
  oc as (
    select o.demandante, o.rut_demandante, o.proveedor, o.fecha_emision, coalesce(o.total, o.monto_total, 0) as monto
    from public.ordenes_compra o, r
    where r.rut is not null and o.rut_proveedor = r.rut
  ),
  res as (
    select count(*) as n, coalesce(sum(monto), 0)::bigint as monto,
           min(fecha_emision)::date as primera, max(fecha_emision)::date as ultima,
           (array_agg(proveedor order by fecha_emision desc nulls last))[1] as nombre
    from oc
  )
  select jsonb_build_object(
    'rut', (select rut from r),
    'valido', public.rut_valido(p_rut),
    'encontrado', (select n > 0 from res),
    'nombre', (select nombre from res),
    'ocs', (select n from res),
    'monto', (select monto from res),
    'primera', (select primera from res),
    'ultima', (select ultima from res),
    'instituciones', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select demandante as institucion, rut_demandante as rut_institucion, count(*)::int as n, sum(monto)::bigint as monto
        from oc where demandante is not null
        group by 1, 2 order by monto desc limit 8) x),
    'rubros', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select l.rubro_n1 as rubro, count(*)::int as n
        from public.oc_lineas l, r where r.rut is not null and l.rut_proveedor = r.rut and l.rubro_n1 is not null
        group by 1 order by n desc limit 6) x),
    'productos', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select l.producto, count(*)::int as n
        from public.oc_lineas l, r where r.rut is not null and l.rut_proveedor = r.rut and l.producto is not null
        group by 1 order by n desc limit 12) x)
  );
$$;
revoke all on function public.onboarding_por_rut(text) from public, anon;
grant execute on function public.onboarding_por_rut(text) to authenticated, service_role;
grant execute on function public.rut_normalizar(text), public.rut_valido(text) to authenticated, service_role;
