-- Directorio de compradores públicos (Fase 1, panel Fundador).
-- Vista materializada precalculada desde las órdenes de compra: quién compra,
-- cuánto, desde cuándo y hasta cuándo. La agregación en vivo sobre 1,26M filas
-- es demasiado lenta, por eso se materializa y se refresca a diario por cron.

drop materialized view if exists public.mv_compradores_publicos;
create materialized view public.mv_compradores_publicos as
select o.rut_demandante as rut,
       max(nullif(btrim(o.organismo_comprador), '')) as institucion,
       count(*)::bigint as n_oc,
       coalesce(sum(coalesce(o.total, o.monto_total, 0)), 0)::numeric as monto_total,
       min(o.fecha_emision) as primera_compra,
       max(o.fecha_emision) as ultima_compra
from public.ordenes_compra o
where o.rut_demandante is not null
group by o.rut_demandante;

create unique index if not exists mv_compradores_publicos_rut on public.mv_compradores_publicos (rut);
create index if not exists mv_compradores_publicos_monto on public.mv_compradores_publicos (monto_total desc);

-- RPC del directorio: solo para el fundador (correo), con búsqueda por nombre y
-- región/sector traídos del catálogo de instituciones cuando existan.
create or replace function public.fundador_directorio_compradores(
  p_buscar text default null,
  p_limite int default 500
) returns table (
  institucion text,
  rut text,
  region text,
  sector text,
  n_oc bigint,
  monto_total numeric,
  ultima_compra timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then
    return;
  end if;
  return query
  select coalesce(m.institucion, '(sin nombre)') as institucion,
         m.rut,
         i.region,
         i.sector,
         m.n_oc,
         m.monto_total,
         m.ultima_compra
  from public.mv_compradores_publicos m
  left join public.instituciones i on i.rut = m.rut
  where (p_buscar is null or p_buscar = ''
         or m.institucion ilike '%' || p_buscar || '%'
         or m.rut ilike '%' || p_buscar || '%')
  order by m.monto_total desc nulls last
  limit greatest(coalesce(p_limite, 500), 1);
end;
$$;

grant execute on function public.fundador_directorio_compradores(text, int) to authenticated;

-- Refresco diario (06:30 UTC) para mantener el directorio al día.
select cron.unschedule(jobid) from cron.job where jobname = 'refresh-mv-compradores-publicos';
select cron.schedule('refresh-mv-compradores-publicos', '30 6 * * *',
  $$refresh materialized view concurrently public.mv_compradores_publicos$$);
