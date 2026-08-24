-- KPIs de mercado (licitaciones + compras ágiles + órdenes) agregados en el
-- servidor. Antes el ReporteMercado bajaba 130k+ licitaciones al navegador (tope
-- de 1000 → subconteo) y leía compras_agiles.monto (columna inexistente → error
-- tragado → compras=0). Esta RPC lo resuelve de raíz.
create or replace function public.bi_mercado_stats()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  with lic as (
    select presupuesto_estimado as monto,
           coalesce(unidad_compra_region, 'Sin región') as region,
           coalesce(tipo, 'Otro') as tipo,
           fecha_publicacion::date as fecha
    from public.licitaciones_bi
  ),
  ca as (
    select monto_estimado as monto,
           coalesce(region, 'Sin región') as region,
           fecha_publicacion::date as fecha
    from public.compras_agiles
  ),
  oc as (select coalesce(monto_total, total, 0) as monto from public.ordenes_compra)
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'totalLicitaciones', (select count(*) from lic),
      'totalCompras', (select count(*) from ca),
      'valorLicitaciones', (select coalesce(sum(monto),0) from lic),
      'valorCompras', (select coalesce(sum(monto),0) from ca),
      'valorOrdenes', (select coalesce(sum(monto),0) from oc),
      'totalOportunidades', (select count(*) from lic) + (select count(*) from ca),
      'valorTotal', (select coalesce(sum(monto),0) from lic) + (select coalesce(sum(monto),0) from ca)
    ),
    'porRegion', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.monto desc), '[]'::jsonb)
      from (
        select region, count(*)::int as count, coalesce(sum(monto),0) as monto
        from (select region, monto from lic union all select region, monto from ca) u
        group by region
      ) x
    ),
    'porTipo', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.count desc), '[]'::jsonb)
      from (
        select tipo, count(*)::int as count, coalesce(sum(monto),0) as monto
        from lic group by tipo
      ) x
    ),
    'tendenciaMensual', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.mes), '[]'::jsonb)
      from (
        select to_char(fecha, 'YYYY-MM') as mes, count(*)::int as count, coalesce(sum(monto),0) as monto
        from (
          select fecha, monto from lic where fecha is not null
          union all
          select fecha, monto from ca where fecha is not null
        ) u
        where fecha >= (current_date - interval '12 months')
        group by 1
      ) x
    )
  );
$function$;

grant execute on function public.bi_mercado_stats() to authenticated, anon;
