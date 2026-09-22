-- Tasa de interés corriente (Ley 18.010, operaciones no reajustables, 90 días o más)
-- publicada mensualmente por la CMF, tramificada por monto (convertido a CLP con la UF
-- vigente al cargar el mes). Usada por Don Evaristo Abogado para calcular intereses por
-- mora en pagos atrasados de Mercado Público. Se actualiza a mano cada mes desde cmfchile.cl.
create table if not exists public.interes_mora_cmf (
  mes date not null,
  monto_desde numeric not null,
  monto_hasta numeric,
  tasa_anual numeric not null,
  fuente_url text,
  creado_en timestamptz not null default now(),
  primary key (mes, monto_desde)
);
comment on table public.interes_mora_cmf is 'Tramos de tasa de interés corriente (Ley 18.010, operaciones no reajustables, 90 días o más) publicados mensualmente por la CMF. Montos en CLP, convertidos con la UF vigente al cargar el mes. Actualizar cada mes desde cmfchile.cl (Estadísticas > Tasas de Interés > Certificado Mensual).';

alter table public.interes_mora_cmf enable row level security;
create policy "lectura autenticados" on public.interes_mora_cmf for select to authenticated using (true);

create or replace function public.calcular_interes_mora(
  p_monto numeric,
  p_fecha_vencimiento date,
  p_fecha_pago date default null
) returns table(
  dias_atraso integer,
  tasa_anual numeric,
  mes_tasa date,
  interes numeric,
  total numeric,
  fuente_url text
) language sql stable security definer set search_path = 'public' as $$
  with parametros as (
    select p_monto as monto, p_fecha_vencimiento as desde, coalesce(p_fecha_pago, current_date) as hasta
  ), tramo as (
    select t.mes, t.tasa_anual, t.fuente_url
    from public.interes_mora_cmf t, parametros p
    where t.monto_desde <= p.monto and (t.monto_hasta is null or p.monto <= t.monto_hasta)
      and t.mes <= date_trunc('month', p.hasta)::date
    order by t.mes desc
    limit 1
  )
  select
    greatest(0, (p.hasta - p.desde))::int as dias_atraso,
    tramo.tasa_anual,
    tramo.mes,
    round(p.monto * (tramo.tasa_anual/100.0) * greatest(0, (p.hasta - p.desde)) / 360.0, 0) as interes,
    round(p.monto + p.monto * (tramo.tasa_anual/100.0) * greatest(0, (p.hasta - p.desde)) / 360.0, 0) as total,
    tramo.fuente_url
  from parametros p left join tramo on true;
$$;
comment on function public.calcular_interes_mora is 'Calcula el interés por mora (Ley 18.010, tasa de interés corriente no reajustable 90 días o más) sobre un monto adeudado, entre la fecha en que debía pagarse y la fecha de pago (o hoy si sigue impago). Devuelve null en tasa_anual/interes si no hay tramo cargado para ese mes/monto.';
