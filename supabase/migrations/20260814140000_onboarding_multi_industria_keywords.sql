-- Onboarding rediseñado: multi-industria + palabras clave, y búsqueda inmediata
-- de licitaciones por esas keywords (paso final "tus primeras oportunidades").

alter table public.clientes
  add column if not exists industrias text[] default '{}'::text[],
  add column if not exists palabras_clave_busqueda text[] default '{}'::text[];

-- Busca licitaciones abiertas que matcheen CUALQUIERA de las keywords del cliente
-- (industria + palabras clave). Prioriza coincidencias en el TÍTULO (más
-- relevantes que una coincidencia incidental en la descripción). SECURITY DEFINER
-- para lógica única; solo authenticated puede llamarla.
create or replace function public.buscar_licitaciones_keywords(terminos text[], limite int default 24)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with kw as (
    select distinct lower(btrim(t)) as t
    from unnest(coalesce(terminos, '{}'::text[])) as t
    where nullif(btrim(t), '') is not null
  ),
  base as (
    select l.codigo, l.nombre, l.institucion_nombre, l.unidad_compra_region,
           l.presupuesto_estimado, l.moneda, l.fecha_cierre,
           exists (select 1 from kw where l.nombre ilike '%' || kw.t || '%') as en_titulo
    from public.licitaciones_bi l
    where l.estado = 'Publicada'
      and l.codigo_estado = 5
      and l.fecha_cierre > now()
      and exists (
        select 1 from kw
        where l.nombre ilike '%' || kw.t || '%'
           or l.descripcion ilike '%' || kw.t || '%'
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'total_titulo', (select count(*) from base where en_titulo),
    'items', coalesce((
      select jsonb_agg(x)
      from (
        select codigo, nombre, institucion_nombre, unidad_compra_region,
               presupuesto_estimado, moneda, fecha_cierre
        from base
        order by en_titulo desc, fecha_cierre asc
        limit greatest(1, least(coalesce(limite, 24), 50))
      ) x
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.buscar_licitaciones_keywords(text[], int) from public;
grant execute on function public.buscar_licitaciones_keywords(text[], int) to authenticated;
