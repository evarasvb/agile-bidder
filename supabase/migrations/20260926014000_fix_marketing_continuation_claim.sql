-- Corrige el continuador de campañas por lotes sin reactivar el cron.
-- La pieza pasa brevemente a `procesando`; solo un request service_role puede
-- reclamar una pieza `ejecutando`, por lo que dos corridas no se superponen.

alter table public.marketing_piezas
  add column if not exists contactos_ids uuid[];

create unique index if not exists marketing_ejecucion_pieza_contacto_key
  on public.marketing_ejecucion (pieza_id, contacto_id);

create or replace function public.marketing_reclamar_continuacion(
  p_pieza_id uuid
)
returns table (
  id uuid,
  campana_id uuid,
  contenido text,
  asunto text,
  tipo text,
  canal text,
  estado text,
  contactos_ids uuid[]
)
language sql
security invoker
set search_path = ''
as $$
  update public.marketing_piezas as mp
  set estado = 'procesando'
  where mp.id = p_pieza_id
    and mp.canal = 'email'
    and mp.estado = 'ejecutando'
    and (select auth.role()) = 'service_role'
  returning
    mp.id,
    mp.campana_id,
    mp.contenido,
    mp.asunto,
    mp.tipo,
    mp.canal,
    mp.estado,
    mp.contactos_ids;
$$;

revoke all on function public.marketing_reclamar_continuacion(uuid)
  from public, anon, authenticated;
grant execute on function public.marketing_reclamar_continuacion(uuid)
  to service_role;

create or replace function public.marketing_continuar_envios_pendientes()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt text;
  v_pieza record;
begin
  select decrypted_secret
  into v_jwt
  from vault.decrypted_secrets
  where name = 'service_role_jwt_legacy';

  if v_jwt is null then
    return;
  end if;

  for v_pieza in
    select id, contactos_ids
    from public.marketing_piezas
    where canal = 'email'
      and estado = 'ejecutando'
      and contactos_ids is not null
      and array_length(contactos_ids, 1) > 0
    order by creado_en
    limit 20
  loop
    perform net.http_post(
      url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/marketing-ejecutar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_jwt
      ),
      body := jsonb_build_object(
        'pieza_id', v_pieza.id,
        'contactos_ids', to_jsonb(v_pieza.contactos_ids)
      ),
      timeout_milliseconds := 120000
    );
  end loop;
end;
$$;

revoke all on function public.marketing_continuar_envios_pendientes()
  from public, anon, authenticated;
grant execute on function public.marketing_continuar_envios_pendientes()
  to service_role;

-- En instalaciones nuevas crea el trabajo; en producción conserva su ID.
-- Siempre queda PAUSADO hasta validar manualmente la Edge Function corregida.
do $$
declare
  v_job_id bigint;
  v_command text := 'select public.marketing_continuar_envios_pendientes();';
begin
  select jobid
  into v_job_id
  from cron.job
  where jobname = 'marketing-continuar-envios'
  limit 1;

  if v_job_id is null then
    select cron.schedule(
      'marketing-continuar-envios',
      '*/2 * * * *',
      v_command
    )
    into v_job_id;
  end if;

  perform cron.alter_job(
    job_id := v_job_id,
    schedule := '*/2 * * * *',
    command := v_command,
    active := false
  );
end
$$;
