-- Compras ágiles: horas correctas de Chile y sondeo de respaldo cuando el listado falla.
--
-- 1) HORAS. La API de ChileCompra entrega hora de pared chilena; en el listado,
--    fecha_cierre_primer_llamado viene con una "Z" falsa ("2026-09-09T09:30:00Z" = 09:30 de
--    Chile). El robot la tomaba como UTC (cierre 3 h antes: las compras salían de "activas"
--    antes de tiempo) y el resto de fechas con -04:00 fijo (1 h corrida desde el horario de
--    verano del 06-09-2026). Los robots ya convierten con America/Santiago; aquí se corrigen
--    las filas guardadas a partir del JSON original.
-- 2) SONDEO. Los códigos son correlativos por unidad de compra (1704-3084, 1704-3086...).
--    La función edge sondear-compras-agiles prueba el código siguiente al último conocido de
--    cada unidad con actividad reciente, usando el endpoint de detalle (rápido) cuando el
--    listado responde 504. Aquí va la RPC de unidades y el cron.

-- Hora de pared chilena (texto de la API, con o sin Z falsa) -> timestamptz real.
create or replace function public.ca_hora_chile(p text)
returns timestamptz language sql immutable as $$
  select case when p is null or p = '' then null
         else (regexp_replace(replace(p,'T',' '), '(\.\d+)?(Z|[+\-]\d\d:?\d\d)$', ''))::timestamp at time zone 'America/Santiago' end;
$$;

update public.compras_agiles c
   set fecha_publicacion = coalesce(public.ca_hora_chile(c.datos_json->'fechas'->>'fecha_publicacion'), c.fecha_publicacion),
       fecha_cierre = coalesce(public.ca_hora_chile(coalesce(c.datos_json->'fechas'->>'fecha_cierre', c.datos_json->'fechas'->>'fecha_cierre_primer_llamado')), c.fecha_cierre),
       fecha_cierre_segundo_llamado = coalesce(public.ca_hora_chile(coalesce(c.datos_json->'detalle'->'convocatoria'->>'fecha_cierre_segundo_llamado', c.datos_json->'fechas'->>'fecha_cierre_segundo_llamado')), c.fecha_cierre_segundo_llamado),
       updated_at = now()
 where c.datos_json ? 'fechas'
   and c.created_at > now() - interval '45 days';

-- Filas que solo tienen el detalle (rescatadas a mano o por sondeo).
update public.compras_agiles c
   set fecha_publicacion = coalesce(public.ca_hora_chile(c.datos_json->'detalle'->'fechas'->>'fecha_publicacion'), c.fecha_publicacion),
       fecha_cierre = coalesce(public.ca_hora_chile(coalesce(c.datos_json->'detalle'->'fechas'->>'fecha_cierre', c.datos_json->'detalle'->'convocatoria'->>'fecha_cierre_primer_llamado')), c.fecha_cierre),
       fecha_cierre_segundo_llamado = coalesce(public.ca_hora_chile(c.datos_json->'detalle'->'convocatoria'->>'fecha_cierre_segundo_llamado'), c.fecha_cierre_segundo_llamado),
       nombre = case when c.nombre = '(pendiente de detalle)' then coalesce(c.datos_json->'detalle'->>'nombre', c.nombre) else c.nombre end,
       nombre_organismo = coalesce(c.nombre_organismo, c.datos_json->'detalle'->'institucion'->>'organismo_comprador'),
       organismo_rut = coalesce(c.organismo_rut, c.datos_json->'detalle'->'institucion'->>'rut'),
       region = coalesce(c.region, c.datos_json->'detalle'->'institucion'->>'nombre_region'),
       updated_at = now()
 where not (c.datos_json ? 'fechas') and c.datos_json ? 'detalle'
   and c.created_at > now() - interval '45 days';

-- Unidades de compra con actividad reciente y su último correlativo, para el sondeo.
create or replace function public.compras_agiles_unidades_activas(p_limit integer default 150, p_offset integer default 0)
returns table(prefijo text, ultimo_seq integer, sufijo text, ultima_publicacion timestamptz)
language sql stable security definer set search_path to 'public' as $$
  with c as (
    select split_part(codigo,'-',1) prefijo, split_part(codigo,'-',2)::int seq, split_part(codigo,'-',3) sufijo, fecha_publicacion
      from public.compras_agiles
     where codigo ~ '^\d+-\d+-COT\d\d$' and fecha_publicacion > now() - interval '7 days'
  ), ult as (
    select prefijo, max(sufijo) sufijo, max(fecha_publicacion) ultima_publicacion from c group by prefijo
  )
  select u.prefijo, max(c.seq) ultimo_seq, u.sufijo, u.ultima_publicacion
    from ult u join c on c.prefijo = u.prefijo and c.sufijo = u.sufijo
   group by u.prefijo, u.sufijo, u.ultima_publicacion
   order by u.ultima_publicacion desc, u.prefijo
   limit greatest(1, least(p_limit, 400)) offset greatest(0, p_offset);
$$;

insert into public.ingesta_ca_estado (clave, pagina_actual) values ('sondeo', 0) on conflict (clave) do nothing;

-- Cron: cada 10 min. La función se omite sola si el listado trajo filas hace menos de 20 min.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sondear-compras-agiles') then
    perform cron.unschedule('sondear-compras-agiles');
  end if;
  perform cron.schedule('sondear-compras-agiles', '2,12,22,32,42,52 * * * *', $cmd$
    select net.http_post(
      url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/sondear-compras-agiles',
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='service_role_jwt_legacy')),
      body := '{"limite_unidades":150}'::jsonb,
      timeout_milliseconds := 125000);
  $cmd$);
end $$;
