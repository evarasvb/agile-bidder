-- Resumen del onboarding: cuántas oportunidades abiertas calzan con el perfil
-- (licitaciones + compras ágiles) y "áreas de mejora": palabras candidatas del
-- rubro que aún no incluye y cuántas oportunidades abiertas le sumarían.
create or replace function public.onboarding_resumen(p_incluidas text[], p_candidatas text[])
returns jsonb
language sql stable security definer set search_path = public
as $function$
  with inc as (
    select distinct lower(btrim(t)) t from unnest(coalesce(p_incluidas,'{}'::text[])) t
    where nullif(btrim(t),'') is not null
  ),
  lic as (
    select nombre, coalesce(descripcion,'') descripcion from public.licitaciones_bi
    where estado = 'Publicada' and codigo_estado = 5 and fecha_cierre > now()
  ),
  ca as (
    select nombre, coalesce(descripcion,'') descripcion from public.compras_agiles
    where (estado ilike 'publicada' or estado ilike 'activa') and fecha_cierre > now()
  ),
  cand as (
    select distinct lower(btrim(t)) t from unnest(coalesce(p_candidatas,'{}'::text[])) t
    where nullif(btrim(t),'') is not null and lower(btrim(t)) not in (select t from inc)
  ),
  mejoras as (
    select c.t as keyword,
      (select count(*) from lic l where l.nombre ilike '%'||c.t||'%' or l.descripcion ilike '%'||c.t||'%')
      + (select count(*) from ca a where a.nombre ilike '%'||c.t||'%' or a.descripcion ilike '%'||c.t||'%') as oportunidades
    from cand c
  )
  select jsonb_build_object(
    'lic_total', (select count(*) from lic l where exists (select 1 from inc where l.nombre ilike '%'||inc.t||'%' or l.descripcion ilike '%'||inc.t||'%')),
    'ca_total',  (select count(*) from ca a  where exists (select 1 from inc where a.nombre ilike '%'||inc.t||'%' or a.descripcion ilike '%'||inc.t||'%')),
    'mejoras', coalesce((
      select jsonb_agg(x) from (
        select keyword, oportunidades from mejoras where oportunidades > 0 order by oportunidades desc limit 6
      ) x
    ), '[]'::jsonb)
  );
$function$;

grant execute on function public.onboarding_resumen(text[], text[]) to anon, authenticated;
