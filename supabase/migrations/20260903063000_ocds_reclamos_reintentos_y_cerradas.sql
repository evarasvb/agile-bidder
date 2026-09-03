-- Reintentos de dias de reclamos, reintento de procesos OCDS fallidos y relectura de
-- procesos cerrados que aun no tienen adjudicacion. (Las dos primeras partes ya estaban
-- aplicadas en prod como reclamos_mp_dias_intentos y ocds_pendientes_con_reintentos_y_reset_reclamos.)

alter table public.reclamos_mp_dias add column if not exists intentos integer not null default 0;

create or replace function public.reclamos_mp_marcar_dia(p_fecha date, p_tipo smallint, p_cargados integer, p_total integer, p_completo boolean)
returns void language sql security definer set search_path = public as $$
  insert into public.reclamos_mp_dias (fecha, tipo, cargados, total, completo, intentos, updated_at)
  values (p_fecha, p_tipo, p_cargados, p_total, p_completo, 1, now())
  on conflict (fecha, tipo) do update
    set cargados = greatest(excluded.cargados, public.reclamos_mp_dias.cargados),
        total = coalesce(excluded.total, public.reclamos_mp_dias.total),
        completo = excluded.completo or public.reclamos_mp_dias.completo,
        intentos = public.reclamos_mp_dias.intentos + 1,
        updated_at = now();
$$;

-- Dias pendientes: primero los que menos se han intentado; tras 6 intentos se dejan de pedir.
create or replace function public.reclamos_mp_dias_pendientes(p_max integer default 3)
returns table (fecha date, tipo smallint) language sql stable security definer set search_path = public as $$
  select d::date, t::smallint
  from generate_series(current_date - 1, current_date - 365, interval '-1 day') d
  cross join (values (1), (2)) t(t)
  left join public.reclamos_mp_dias r on r.fecha = d::date and r.tipo = t
  where coalesce(r.completo, false) = false and coalesce(r.intentos, 0) < 6
  order by coalesce(r.intentos, 0), d desc, t
  limit least(p_max, 40);
$$;

-- Codigos OCDS por leer: (1) filas provisorias de procesos que fallaron por red, (2) licitaciones
-- cerradas hace mas de 30 dias sin adjudicacion registrada, (3) procesos leidos como "Cerrada"
-- (en evaluacion) que se releen cada 7 dias hasta que aparezca la adjudicacion.
create or replace function public.ocds_codigos_pendientes(p_max integer default 100)
returns table (codigo text) language sql stable security definer set search_path = public as $$
  (select o.codigo from public.ocds_procesos o
     where o.award_leido_en is null and o.tender_leido_en is null and o.updated_at < now() - interval '5 minutes'
     order by o.updated_at limit least(p_max, 300))
  union all
  (select b.codigo from public.licitaciones_bi b
     left join public.ocds_procesos o on o.codigo = b.codigo
     where b.fecha_cierre < now() - interval '30 days'
       and b.fecha_publicacion >= now() - interval '150 days'
       and (o.codigo is null or (o.adjudicatarios is null and coalesce(o.award_leido_en, 'epoch') < now() - interval '7 days'))
     order by b.fecha_cierre desc limit least(p_max, 300))
  union all
  (select o.codigo from public.ocds_procesos o
     where o.estado_tender like '6-%'
       and (o.adjudicatarios is null or o.adjudicatarios = '[]'::jsonb)
       and o.award_leido_en < now() - interval '7 days'
       and coalesce(o.fecha_cierre, now()) < now() - interval '10 days'
     order by o.award_leido_en limit least(p_max, 300))
  limit least(p_max, 300);
$$;

-- Julio 2026: una prueba manual devolvio el puntero a 0 despues de haber leido hasta 600.
update public.ocds_meses set offset_leido = greatest(offset_leido, 600) where anio = 2026 and mes = 7 and not completo;
