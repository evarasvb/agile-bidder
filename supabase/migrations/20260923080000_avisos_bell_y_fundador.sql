-- 1) Campanita de avisos: notificaciones_log necesita estado "leída" y que el
-- cliente pueda marcarla. La lectura ya existe (policy propia por clientes.id).
alter table public.notificaciones_log add column if not exists leida boolean not null default false;

drop policy if exists notif_log_update_own on public.notificaciones_log;
create policy notif_log_update_own on public.notificaciones_log
  for update
  using (cliente_id in (select id from public.clientes where user_id = (select auth.uid())))
  with check (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));

-- 2) Métricas del Fundador: agregados de gestión del negocio, solo para su correo
-- (security definer para poder contar sobre tablas con RLS por usuario).
create or replace function public.fundador_metricas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v jsonb;
begin
  v_email := (select auth.jwt() ->> 'email');
  if coalesce(v_email, '') <> 'evaras@firmavb.cl' then
    return jsonb_build_object('denegado', true);
  end if;

  select jsonb_build_object(
    'leads_total', (select count(*) from public.academia_leads),
    'leads_pendientes', (select count(*) from public.academia_leads where coalesce(atendido, false) = false),
    'compras_confirmadas', (select count(*) from public.academia_pagos where estado in ('aprobado', 'aprobado_sin_codigo')),
    'ingresos_confirmados', (select coalesce(sum(monto), 0) from public.academia_pagos where estado in ('aprobado', 'aprobado_sin_codigo')),
    'checkouts_pendientes', (select count(*) from public.academia_pagos where estado = 'pendiente'),
    'clientes_total', (select count(*) from public.clientes),
    'clientes_activos', (select count(*) from public.clientes where coalesce(activo, true) = true),
    'clientes_nuevos_30d', (select count(*) from public.clientes where created_at >= now() - interval '30 days'),
    'instituciones_seguidas', (select count(*) from public.cliente_instituciones_seguidas),
    'avisos_30d', (select count(*) from public.notificaciones_log where created_at >= now() - interval '30 days')
  ) into v;

  return v;
end;
$$;

grant execute on function public.fundador_metricas() to authenticated;
