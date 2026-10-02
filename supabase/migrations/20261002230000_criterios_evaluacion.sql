-- Pedido de Evaristo: poder ver qué criterios de evaluación se repiten más
-- entre licitaciones, para enfocar las postulaciones. Hoy el "Libro de
-- licitación" (experto-matriz, plan Pro) ya extrae los criterios con IA por
-- cada licitación individual, pero quedan como texto JSON suelto dentro de
-- experto.consultas.respuesta (modo='matriz') — no hay forma de agregarlos
-- entre procesos. Se agrega una tabla estructurada (colaborativa, como
-- mk_directorio: es inteligencia de mercado sobre cómo evalúa el Estado, no
-- un dato privado de una empresa) + un backfill de lo que ya existe +
-- extracción automática cada vez que se genera una matriz nueva.

create table if not exists public.criterios_evaluacion_extraidos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  criterio text not null,
  criterio_normalizado text not null,
  ponderacion_pct numeric,
  puntaje_max numeric,
  user_id uuid,
  extraido_en timestamptz not null default now(),
  unique (codigo, criterio_normalizado)
);

create index if not exists idx_criterios_eval_normalizado on public.criterios_evaluacion_extraidos (criterio_normalizado);

grant select on public.criterios_evaluacion_extraidos to anon, authenticated, service_role;
grant insert, update on public.criterios_evaluacion_extraidos to authenticated, service_role;
alter table public.criterios_evaluacion_extraidos enable row level security;
create policy cee_select on public.criterios_evaluacion_extraidos for select to anon, authenticated using (true);
create policy cee_ins on public.criterios_evaluacion_extraidos for insert to authenticated with check (true);
create policy cee_upd on public.criterios_evaluacion_extraidos for update to authenticated using (true) with check (true);

-- Extrae y guarda los criterios de la matriz más reciente de UNA licitación
-- (se llama justo después de generarla, en experto-matriz). SECURITY DEFINER
-- porque experto.consultas no es legible por authenticated directamente.
create or replace function public.criterios_evaluacion_extraer_uno(p_codigo text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_respuesta text;
  v_user_id uuid;
  v_json jsonb;
  v_item jsonb;
  v_n integer := 0;
begin
  select c.respuesta, c.user_id into v_respuesta, v_user_id
  from experto.consultas c
  where upper(c.licitacion) = upper(p_codigo) and c.modo = 'matriz'
  order by c.creado_en desc
  limit 1;

  if v_respuesta is null then return 0; end if;

  begin
    v_json := v_respuesta::jsonb;
  exception when others then
    return 0;
  end;

  if jsonb_typeof(v_json->'evaluacion') <> 'array' then return 0; end if;

  for v_item in select * from jsonb_array_elements(v_json->'evaluacion')
  loop
    if coalesce(trim(v_item->>'criterio'), '') = '' then continue; end if;
    insert into public.criterios_evaluacion_extraidos
      (codigo, criterio, criterio_normalizado, ponderacion_pct, puntaje_max, user_id)
    values (
      upper(p_codigo),
      trim(v_item->>'criterio'),
      lower(trim(v_item->>'criterio')),
      nullif(v_item->>'ponderacion_num', '')::numeric,
      nullif(v_item->>'puntaje_max_num', '')::numeric,
      v_user_id
    )
    on conflict (codigo, criterio_normalizado) do update set
      criterio = excluded.criterio,
      ponderacion_pct = excluded.ponderacion_pct,
      puntaje_max = excluded.puntaje_max,
      extraido_en = now();
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$function$;

grant execute on function public.criterios_evaluacion_extraer_uno(text) to authenticated, service_role;

-- Backfill: recorre todas las matrices ya generadas (una vez, para poblar lo
-- que ya existe). Reusa la función de arriba por cada código distinto.
create or replace function public.criterios_evaluacion_backfill()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_codigo text; v_total integer := 0;
begin
  for v_codigo in
    select distinct licitacion from experto.consultas
    where modo = 'matriz' and licitacion is not null and trim(licitacion) <> ''
  loop
    v_total := v_total + public.criterios_evaluacion_extraer_uno(v_codigo);
  end loop;
  return v_total;
end;
$function$;

grant execute on function public.criterios_evaluacion_backfill() to service_role;

-- Qué criterios se repiten más entre licitaciones (para "revisar cuáles son
-- los factores que más se repiten", tal como lo pidió Evaristo).
create or replace function public.criterios_mas_frecuentes(p_limite integer default 25)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x.n_procesos desc, x.ponderacion_prom desc nulls last), '[]'::jsonb)
  from (
    select
      (array_agg(criterio order by extraido_en desc))[1] as criterio_ejemplo,
      count(distinct codigo) as n_procesos,
      round(avg(ponderacion_pct), 1) as ponderacion_prom
    from public.criterios_evaluacion_extraidos
    group by criterio_normalizado
    order by count(distinct codigo) desc
    limit greatest(p_limite, 1)
  ) x;
$function$;

grant execute on function public.criterios_mas_frecuentes(integer) to anon, authenticated, service_role;
