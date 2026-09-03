-- Cupo de fuentes subidas por licitación según plan: gratis 2 archivos de hasta 5 MB, Pro 10 de 15 MB, Plus/ERP 50 de 20 MB.
create or replace function public.experto_documentos_cupo(p_user_id uuid, p_codigo text)
returns table(plan text, usados integer, maximo integer, max_mb integer)
language sql stable security definer set search_path to 'public', 'experto' as $$
  with p as (select coalesce((select u.plan from public.experto_uso_mes(p_user_id, 'libro') u limit 1), 'free') as plan)
  select p.plan,
         (select count(*)::int from experto.documentos d where d.user_id = p_user_id and upper(d.codigo) = upper(p_codigo)),
         case when p.plan = 'free' then 2 when p.plan in ('pro', 'experto_pro') then 10 else 50 end,
         case when p.plan = 'free' then 5 when p.plan in ('pro', 'experto_pro') then 15 else 20 end
  from p;
$$;
revoke all on function public.experto_documentos_cupo(uuid, text) from public, anon, authenticated;
grant execute on function public.experto_documentos_cupo(uuid, text) to service_role;
