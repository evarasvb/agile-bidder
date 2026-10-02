-- Plan de postulación dentro del Libro de licitación (pedido de Evaristo:
-- "sigue con el plan de postulación en el Libro"). Cada libro guarda un plan
-- de pasos con fecha límite, responsable y hecho/pendiente. Las fechas se
-- calculan en el cliente a partir de las fechas reales de Mercado Público
-- (fin de preguntas, respuestas, cierre, apertura, adjudicación) siguiendo el
-- método de Evaristo (foro por área, nunca postular el último día, garantía,
-- acta de adjudicación). Aquí solo se guarda y se recuerda por la campanita:
-- nunca por correo (regla: el cliente mira su plataforma).

create table if not exists experto.libro_plan (
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  pasos jsonb not null default '[]'::jsonb,
  actualizado_en timestamptz not null default now(),
  primary key (user_id, codigo)
);
alter table experto.libro_plan enable row level security;

-- Guardar el plan completo del libro (el cliente manda el arreglo entero: es chico).
create or replace function public.experto_libro_plan_guardar(p_codigo text, p_pasos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'experto'
as $$
begin
  if auth.uid() is null then raise exception 'no autenticado'; end if;
  if p_codigo is null or btrim(p_codigo) = '' then raise exception 'código requerido'; end if;
  if p_pasos is null or jsonb_typeof(p_pasos) <> 'array' or jsonb_array_length(p_pasos) > 80 then raise exception 'plan inválido'; end if;
  insert into experto.libro_plan (user_id, codigo, pasos, actualizado_en)
  values (auth.uid(), upper(btrim(p_codigo)), p_pasos, now())
  on conflict (user_id, codigo) do update set pasos = excluded.pasos, actualizado_en = now();
  return jsonb_build_object('ok', true, 'actualizado_en', now());
end;
$$;
revoke all on function public.experto_libro_plan_guardar(text, jsonb) from public, anon;
grant execute on function public.experto_libro_plan_guardar(text, jsonb) to authenticated;

-- El libro trae ahora también el plan de postulación guardado.
create or replace function public.experto_libro(p_codigo text)
returns jsonb language sql stable security definer set search_path to 'public', 'experto' as $function$
  with f as (
    select coalesce(
      public.experto_ficha_licitacion(upper(p_codigo)),
      (select jsonb_build_object('codigo', ca.codigo, 'nombre', ca.nombre, 'institucion', ca.nombre_organismo, 'tipo', 'Compra Ágil',
                                 'presupuesto', ca.monto_estimado, 'moneda', ca.moneda, 'estado', ca.estado, 'region', ca.region,
                                 'fecha_publicacion', ca.fecha_publicacion, 'fecha_cierre', ca.fecha_cierre, 'descripcion', ca.descripcion,
                                 'url', coalesce(ca.url_ficha, 'https://www.mercadopublico.cl/CompraAgil/Modules/CA/DetallesCompraAgil.aspx?codigo=' || ca.codigo),
                                 'rut_institucion', ca.organismo_rut,
                                 'organismo', (select to_jsonb(o) from public.experto_organismo(coalesce(ca.organismo_rut, ca.nombre_organismo)) o limit 1),
                                 'items', (select coalesce(jsonb_agg(jsonb_build_object('producto', i.nombre_producto, 'cantidad', i.cantidad, 'unidad', i.unidad, 'descripcion', i.descripcion_producto)), '[]'::jsonb)
                                           from public.compras_agiles_items i where i.compra_agil_id = ca.id))
       from public.compras_agiles ca where upper(ca.codigo) = upper(p_codigo) limit 1)
    ) ficha)
  select jsonb_build_object(
    'codigo', upper(p_codigo),
    'ficha', (select ficha from f),
    'bases', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'archivo', b.archivo, 'paginas', b.paginas, 'creado_en', b.creado_en, 'resumen', b.resumen) order by b.creado_en desc), '[]'::jsonb)
              from public.bases_licitacion b where upper(b.codigo) = upper(p_codigo) and coalesce(b.caracteres, 0) > 200),
    'documentos', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'tipo', d.tipo, 'caracteres', d.caracteres, 'creado_en', d.creado_en) order by d.creado_en desc), '[]'::jsonb)
                   from experto.documentos d where d.user_id = auth.uid() and upper(d.codigo) = upper(p_codigo)),
    'top_adjudicatarios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from f, lateral public.experto_top_adjudicatarios(f.ficha->'organismo'->>'rut', 12, 6) t where f.ficha->'organismo'->>'rut' is not null),
    'chat', (select coalesce(jsonb_agg(jsonb_build_object('pregunta', c.pregunta, 'respuesta', c.respuesta, 'creado_en', c.creado_en) order by c.creado_en), '[]'::jsonb)
             from (select * from experto.consultas where user_id = auth.uid() and upper(licitacion) = upper(p_codigo) and modo = 'chat' order by creado_en desc limit 30) c),
    'informe', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'informe' order by c.creado_en desc limit 1),
    'estudio', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'estudio' order by c.creado_en desc limit 1),
    'bajo_agua', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'bajo_agua' order by c.creado_en desc limit 1),
    'bajo_agua_cuota', (select to_jsonb(q) from public.experto_bajo_agua_cuota(auth.uid()) q limit 1),
    'mapa', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'mapa' order by c.creado_en desc limit 1),
    'matriz', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'matriz' order by c.creado_en desc limit 1),
    'anexos', (select jsonb_build_object('texto', a.contenido, 'faltantes', a.faltantes, 'creado_en', a.creado_en) from public.experto_anexos a where a.user_id = auth.uid() and upper(a.codigo) = upper(p_codigo) order by a.creado_en desc limit 1),
    'plan_postulacion', (select jsonb_build_object('pasos', pl.pasos, 'actualizado_en', pl.actualizado_en) from experto.libro_plan pl where pl.user_id = auth.uid() and pl.codigo = upper(p_codigo)),
    'plan', public.experto_mi_plan()
  );
$function$;

-- Recordatorio en la campanita (nunca correo): pasos pendientes que vencen hoy o mañana (hora de Chile).
create or replace function public.experto_plan_avisar()
returns integer
language plpgsql
security definer
set search_path to 'public', 'experto'
as $$
declare n integer; v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  insert into public.notificaciones_log (cliente_id, tipo, licitacion_id, email_enviado, datos)
  select x.cliente_id, 'plan_postulacion', x.codigo, false,
         jsonb_build_object('clave', x.clave, 'titulo', x.titulo, 'detalle', x.detalle,
                            'licitacion_id', x.codigo, 'licitacion_codigo', x.codigo, 'tipo_oportunidad', x.tipo_oportunidad,
                            'paso_id', x.paso_id, 'fecha', x.fecha)
  from (
    select c.id as cliente_id, pl.codigo, p->>'id' as paso_id, p->>'fecha' as fecha,
           'plan:' || pl.codigo || ':' || (p->>'id') || ':' || (p->>'fecha') as clave,
           case when (p->>'fecha')::date = v_hoy then 'Vence hoy: ' else 'Vence mañana: ' end || (p->>'titulo') as titulo,
           concat_ws(' · ', pl.codigo, nullif(btrim(p->>'responsable'), ''), left(coalesce(l.nombre, ca.nombre), 90)) as detalle,
           case when ca.codigo is not null then 'compra_agil' else 'licitacion' end as tipo_oportunidad
    from experto.libro_plan pl
    cross join lateral (select c.id from public.clientes c where c.user_id = pl.user_id order by c.created_at limit 1) c
    cross join lateral jsonb_array_elements(pl.pasos) p
    left join lateral (select b.nombre from public.licitaciones_bi b where b.codigo = pl.codigo order by b.updated_at desc limit 1) l on true
    left join lateral (select a.codigo, a.nombre from public.compras_agiles a where upper(a.codigo) = pl.codigo limit 1) ca on true
    where coalesce((p->>'hecho')::boolean, false) = false
      and coalesce(p->>'fecha', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (p->>'fecha')::date between v_hoy and v_hoy + 1
      and coalesce(btrim(p->>'titulo'), '') <> ''
  ) x
  where not exists (select 1 from public.notificaciones_log nl where nl.cliente_id = x.cliente_id and nl.datos->>'clave' = x.clave);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.experto_plan_avisar() from public, anon, authenticated;
grant execute on function public.experto_plan_avisar() to service_role;

-- Todos los días a las 11:05 UTC (07:05 u 08:05 en Chile según horario de verano).
select cron.unschedule(jobid) from cron.job where jobname = 'avisos-plan-postulacion';
select cron.schedule('avisos-plan-postulacion', '5 11 * * *', $$ select public.experto_plan_avisar(); $$);
