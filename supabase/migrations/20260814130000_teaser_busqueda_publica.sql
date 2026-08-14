-- Teaser público del buscador del landing: anon puede buscar oportunidades pero
-- solo recibe un puñado (para "enganchar"), sin poder scrapear toda la tabla.
-- licitaciones_bi solo la leen usuarios autenticados (RLS); este RPC es
-- SECURITY DEFINER y devuelve campos seguros + un total para el upsell.

create index if not exists idx_licbi_teaser_abiertas
  on public.licitaciones_bi (fecha_cierre)
  where estado = 'Publicada' and codigo_estado = 5;

create index if not exists idx_licbi_nombre_trgm
  on public.licitaciones_bi using gin (nombre gin_trgm_ops);

create or replace function public.buscar_teaser_licitaciones(termino text, limite int default 6)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select codigo, nombre, institucion_nombre, unidad_compra_region,
           presupuesto_estimado, moneda, fecha_cierre
    from public.licitaciones_bi
    where estado = 'Publicada'
      and codigo_estado = 5
      and fecha_cierre > now()
      and nullif(btrim(termino), '') is not null
      and (nombre ilike '%' || btrim(termino) || '%'
           or descripcion ilike '%' || btrim(termino) || '%')
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((
      select jsonb_agg(t)
      from (
        select * from base
        order by fecha_cierre asc
        limit greatest(1, least(coalesce(limite, 6), 12))
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.buscar_teaser_licitaciones(text, int) from public;
grant execute on function public.buscar_teaser_licitaciones(text, int) to anon, authenticated;
