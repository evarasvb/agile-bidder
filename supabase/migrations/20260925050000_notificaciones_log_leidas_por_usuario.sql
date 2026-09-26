-- Hallazgo P2 de Codex: `notificaciones_log.leida` es UNA sola columna por
-- fila, compartida por toda la empresa (cliente_id). Esta PR extendió la
-- campanita a los miembros del equipo (antes solo la veía el dueño) — así
-- que ahora, cuando un miembro hace "Marcar leídas", esa misma fila queda
-- leída para el dueño y para todos los demás miembros también, sin que
-- hayan visto nada. Se agrega una tabla de "recibos de lectura" por usuario:
-- el estado leído/no-leído pasa a ser POR PERSONA, no por notificación.
create table if not exists public.notificaciones_log_leidas (
  notificacion_id uuid not null references public.notificaciones_log(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  leida_en timestamptz not null default now(),
  primary key (notificacion_id, user_id)
);

alter table public.notificaciones_log_leidas enable row level security;

drop policy if exists "notif_leidas_select_own" on public.notificaciones_log_leidas;
create policy "notif_leidas_select_own" on public.notificaciones_log_leidas
  for select using (user_id = auth.uid());

drop policy if exists "notif_leidas_insert_own" on public.notificaciones_log_leidas;
create policy "notif_leidas_insert_own" on public.notificaciones_log_leidas
  for insert with check (user_id = auth.uid());

drop policy if exists "notif_leidas_delete_own" on public.notificaciones_log_leidas;
create policy "notif_leidas_delete_own" on public.notificaciones_log_leidas
  for delete using (user_id = auth.uid());

-- Realtime: para que "marqué leído en otra pestaña/dispositivo" siga
-- sincronizando en vivo, igual que ya hace notificaciones_log.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones_log_leidas'
     )
  then
    alter publication supabase_realtime add table public.notificaciones_log_leidas;
  end if;
end $$;
