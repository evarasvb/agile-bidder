-- Corre todos los días a las 15:00 UTC y publica el siguiente post pendiente
-- de viral_agent_calendario. El secret de autenticación de la Edge Function
-- vive en viral_agent_config (key = 'cron_shared_secret'), nunca hardcodeado
-- acá, para que este archivo no filtre nada sensible al quedar en git.
select cron.schedule(
  'publicar-libro-redes-diario',
  '0 15 * * *',
  $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/publicar-libro-redes',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-viral-agent-secret', (select value from public.viral_agent_config where key = 'cron_shared_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
