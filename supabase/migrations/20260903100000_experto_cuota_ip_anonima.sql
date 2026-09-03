-- Tope del comodín anónimo por IP (además de la huella por navegador).
drop function if exists public.experto_cuota(text);
create or replace function public.experto_cuota(p_ip text)
returns table (ip_hora integer, anon_24h integer, ip_anon_24h integer)
language sql stable security definer set search_path = public, experto as $$
  select
    (select count(*)::int from experto.consultas c
      where p_ip is not null and c.ip = p_ip and c.creado_en >= now() - interval '1 hour'),
    (select count(*)::int from experto.consultas c
      where c.user_id is null and c.creado_en >= now() - interval '24 hours'),
    (select count(*)::int from experto.consultas c
      where p_ip is not null and c.ip = p_ip and c.user_id is null and c.creado_en >= now() - interval '24 hours');
$$;
revoke all on function public.experto_cuota(text) from public, anon, authenticated;
grant execute on function public.experto_cuota(text) to service_role;
