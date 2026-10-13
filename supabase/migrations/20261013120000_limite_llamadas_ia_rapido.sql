-- Límite genérico de llamadas por usuario a funciones de IA sin costo medido
-- (matching-ai, ficha-tecnica-ia): hoy cualquier cuenta logueada podía
-- invocarlas en loop sin tope, generando costo de Gemini sin control.
-- Hallazgo de la auditoría de seguridad de IA (2026-10-13).

create table if not exists public.ia_uso_rapido (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  funcion text not null,
  creado_at timestamptz not null default now()
);

create index if not exists ia_uso_rapido_user_funcion_fecha_idx
  on public.ia_uso_rapido (user_id, funcion, creado_at desc);

alter table public.ia_uso_rapido enable row level security;

-- Solo el propio backend (service_role) escribe y lee; el cliente nunca
-- consulta esta tabla directo.
drop policy if exists ia_uso_rapido_service_role on public.ia_uso_rapido;
create policy ia_uso_rapido_service_role on public.ia_uso_rapido
  for all to service_role using (true) with check (true);

-- Housekeeping: nadie necesita filas de más de 2 días para una ventana de 1 hora.
create or replace function public.limpiar_ia_uso_rapido()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ia_uso_rapido where creado_at < now() - interval '2 days';
$$;

-- Cuenta las llamadas de ese usuario a esa función en la ventana y, si no
-- supera el límite, registra esta llamada y devuelve true (permitido).
-- Si ya lo superó, no registra nada y devuelve false.
create or replace function public.chequear_limite_ia(
  p_user_id uuid,
  p_funcion text,
  p_limite int,
  p_ventana_minutos int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usados int;
begin
  select count(*) into v_usados
  from public.ia_uso_rapido
  where user_id = p_user_id
    and funcion = p_funcion
    and creado_at > now() - make_interval(mins => p_ventana_minutos);

  if v_usados >= p_limite then
    return false;
  end if;

  insert into public.ia_uso_rapido (user_id, funcion) values (p_user_id, p_funcion);
  return true;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto al crear una función: sin
-- este revoke, cualquiera sin login podía llamarlas directo por REST
-- (detectado por el advisor de seguridad de Supabase tras aplicar esto).
revoke all on function public.chequear_limite_ia(uuid, text, int, int) from public, anon, authenticated;
revoke all on function public.limpiar_ia_uso_rapido() from public, anon, authenticated;
grant execute on function public.chequear_limite_ia(uuid, text, int, int) to service_role;
grant execute on function public.limpiar_ia_uso_rapido() to service_role;
