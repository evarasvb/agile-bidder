-- El interés por mora ya no aplica una sola tasa a todo el período: la parte con la
-- tasa vigente en cada mes calendario dentro del rango [fecha_vencimiento, fecha_pago/hoy).
-- Si algún mes del rango no tiene tasa cargada, "completo" queda en false y el llamador
-- (abogado-consultar) no debe presentar el cálculo como definitivo.
drop function if exists public.calcular_interes_mora(numeric, date, date);

create or replace function public.calcular_interes_mora(
  p_monto numeric,
  p_fecha_vencimiento date,
  p_fecha_pago date default null
) returns table(
  dias_atraso integer,
  interes numeric,
  total numeric,
  completo boolean,
  detalle jsonb
) language sql stable security definer set search_path = 'public' as $$
  with parametros as (
    select p_monto as monto, p_fecha_vencimiento as desde, coalesce(p_fecha_pago, current_date) as hasta
  ), meses as (
    select generate_series(date_trunc('month', p.desde)::date, date_trunc('month', p.hasta)::date, interval '1 month')::date as mes_inicio
    from parametros p
  ), ventanas as (
    select m.mes_inicio,
      greatest(m.mes_inicio, p.desde) as ini,
      least((m.mes_inicio + interval '1 month')::date, p.hasta) as fin
    from meses m, parametros p
  ), ventanas_validas as (
    select mes_inicio, (fin - ini)::int as dias from ventanas where fin > ini
  ), con_tasa as (
    select
      v.mes_inicio, v.dias,
      t.tasa_anual, t.mes as mes_tasa, t.fuente_url
    from ventanas_validas v
    left join lateral (
      select tc.tasa_anual, tc.mes, tc.fuente_url
      from public.interes_mora_cmf tc, parametros p
      where tc.monto_desde <= p.monto and (tc.monto_hasta is null or p.monto <= tc.monto_hasta)
        and tc.mes <= v.mes_inicio
      order by tc.mes desc limit 1
    ) t on true
  )
  select
    (select (hasta - desde)::int from parametros) as dias_atraso,
    round(sum(coalesce(p_monto * (tasa_anual / 100.0) * dias / 360.0, 0)), 0) as interes,
    round(p_monto + sum(coalesce(p_monto * (tasa_anual / 100.0) * dias / 360.0, 0)), 0) as total,
    bool_and(tasa_anual is not null) as completo,
    coalesce(jsonb_agg(jsonb_build_object(
      'mes', mes_inicio, 'dias', dias, 'tasa_anual', tasa_anual, 'mes_tasa', mes_tasa,
      'interes', round(p_monto * (tasa_anual / 100.0) * dias / 360.0, 0), 'fuente_url', fuente_url
    ) order by mes_inicio), '[]'::jsonb) as detalle
  from con_tasa;
$$;
comment on function public.calcular_interes_mora is 'Calcula el interés por mora (Ley 18.010, tasa de interés corriente no reajustable 90 días o más) partiendo el período en tramos por mes calendario y aplicando la tasa vigente de cada tramo (la CMF publica una tasa nueva cada mes). "completo"=false si algún mes del período no tiene tasa cargada en interes_mora_cmf: en ese caso el cálculo no debe presentarse como definitivo. "detalle" trae el desglose mes a mes.';
