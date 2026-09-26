-- Lista de clientes con su saldo/plan de créditos, para el panel de fundador.
create or replace function public.fundador_creditos_clientes(p_buscar text default null)
returns table(user_id uuid, email text, empresa text, plan text, saldo int, actualizado timestamptz)
language sql security definer set search_path to 'public', 'auth' as $$
  select cc.user_id, u.email::text, c.empresa_nombre, cc.plan, cc.saldo, cc.actualizado_en
  from public.creditos_cuenta cc
  left join public.clientes c on c.user_id = cc.user_id
  left join auth.users u on u.id = cc.user_id
  where coalesce((select auth.jwt() ->> 'email'), '') = 'evaras@firmavb.cl'
    and (p_buscar is null or p_buscar = ''
         or u.email ilike '%'||p_buscar||'%'
         or c.empresa_nombre ilike '%'||p_buscar||'%')
  order by cc.actualizado_en desc
  limit 100;
$$;
revoke all on function public.fundador_creditos_clientes(text) from public, anon;
grant execute on function public.fundador_creditos_clientes(text) to authenticated;
