-- Evita mandar una campaña de correo completa de una sola vez (riesgo de
-- caer en listas negras): marketing-ejecutar ahora manda como máximo
-- MAX_EMAILS_PER_RUN correos por corrida, con una pausa entre cada uno. Lo
-- que sobra queda pendiente en la pieza (sigue 'ejecutando') y este cron la
-- retoma sola cada 2 minutos hasta terminar.

-- Guarda la audiencia objetivo en la propia pieza al reclamarla, para que el
-- cron sepa a quién le falta sin depender de que el navegador la reenvíe.
alter table public.marketing_piezas add column if not exists contactos_ids uuid[];

-- Si el cron y una corrida manual se llegan a superponer, esto evita filas
-- duplicadas para el mismo contacto (persistExecutions usa upsert con
-- ignoreDuplicates sobre esta clave).
alter table public.marketing_ejecucion
  add constraint marketing_ejecucion_pieza_contacto_key unique (pieza_id, contacto_id);

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
  select decrypted_secret into v_jwt from vault.decrypted_secrets where name = 'service_role_jwt_legacy';
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
    limit 20
  loop
    perform net.http_post(
      url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/marketing-ejecutar',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_jwt),
      body := jsonb_build_object('pieza_id', v_pieza.id, 'contactos_ids', to_jsonb(v_pieza.contactos_ids)),
      timeout_milliseconds := 120000
    );
  end loop;
end;
$$;

revoke all on function public.marketing_continuar_envios_pendientes() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'marketing-continuar-envios';
select cron.schedule('marketing-continuar-envios', '*/2 * * * *', $$
  select public.marketing_continuar_envios_pendientes();
$$);
