-- Tope de costo para el Experto antes de viralizarlo.
-- El limite mensual por huella (localStorage) se reinicia en incognito, asi que no protege
-- contra loops ni contra una avalancha anonima. Se agregan dos capas que el cliente no controla:
--   1) por IP: N preguntas por hora (frena loops)
--   2) global anonimo: N preguntas en 24h rodantes (techo de costo en Gemini)
-- Los valores viven en la Edge Function (env EXPERTO_MAX_IP_HORA / EXPERTO_MAX_ANON_24H).

alter table experto.consultas add column if not exists ip text;

create index if not exists consultas_ip_creado_idx
  on experto.consultas (ip, creado_en desc) where ip is not null;
create index if not exists consultas_anon_creado_idx
  on experto.consultas (creado_en desc) where user_id is null;

-- registrar_uso ahora guarda la IP. Se recrea porque CREATE OR REPLACE no admite cambiar la
-- lista de parametros. Solo la llama experto-consultar (fire-and-forget, dentro de try/catch).
drop function if exists public.experto_registrar_uso(uuid, text, text, text, text, jsonb, text, integer);

create or replace function public.experto_registrar_uso(
  p_user_id uuid, p_huella text, p_modo text, p_pregunta text, p_respuesta text,
  p_fuentes jsonb, p_licitacion text, p_ms integer, p_ip text default null)
returns void
language sql security definer
set search_path to 'public', 'experto'
as $$
  insert into experto.consultas (user_id, huella, modo, pregunta, respuesta, fuentes, licitacion, ms, ip)
  values (p_user_id, p_huella, p_modo, p_pregunta, p_respuesta, p_fuentes, p_licitacion, p_ms, p_ip);
$$;

-- Una sola ida y vuelta para las dos cuotas.
create or replace function public.experto_cuota(p_ip text)
returns table(ip_hora integer, anon_24h integer)
language sql stable security definer
set search_path to 'public', 'experto'
as $$
  select
    (select count(*)::int from experto.consultas c
      where p_ip is not null and c.ip = p_ip and c.creado_en >= now() - interval '1 hour'),
    (select count(*)::int from experto.consultas c
      where c.user_id is null and c.creado_en >= now() - interval '24 hours');
$$;

revoke execute on function public.experto_cuota(text) from public, anon, authenticated;
revoke execute on function public.experto_registrar_uso(uuid, text, text, text, text, jsonb, text, integer, text) from public, anon, authenticated;
grant execute on function public.experto_cuota(text) to service_role;
grant execute on function public.experto_registrar_uso(uuid, text, text, text, text, jsonb, text, integer, text) to service_role;
