-- Paso 2 de recordatorios automáticos de cobranza: interruptor por cliente + cron diario.
-- El cron (cobranza-recordatorios) deja BORRADORES de recordatorio en el Gmail del dueño
-- para las facturas con atraso; no envía solo (se revisan antes). Apagado por defecto.
-- Ya aplicado en prod vía MCP (columna + edge function + cron).

alter table public.clientes add column if not exists recordatorios_cobranza_activo boolean not null default false;
comment on column public.clientes.recordatorios_cobranza_activo is
  'CRM Cobranza: si true, el cron diario cobranza-recordatorios deja borradores de recordatorio en el Gmail del dueño. Apagado por defecto.';

-- Cron diario (12:12 UTC = 09:12 Chile) → edge function cobranza-recordatorios.
do $$ begin perform cron.unschedule('cobranza-recordatorios-diario'); exception when others then null; end $$;
select cron.schedule('cobranza-recordatorios-diario', '12 12 * * *', $cron$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/cobranza-recordatorios',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$cron$);
