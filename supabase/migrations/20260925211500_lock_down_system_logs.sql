-- Impide que visitantes anónimos lean o escriban registros operacionales.
alter table public.system_logs enable row level security;

drop policy if exists "Users can view system_logs" on public.system_logs;
drop policy if exists "Users can insert system_logs" on public.system_logs;
drop policy if exists "Admin users can read system logs" on public.system_logs;
drop policy if exists "Service role can insert system logs" on public.system_logs;
drop policy if exists "Authenticated users can insert system logs" on public.system_logs;

revoke all privileges on table public.system_logs from public, anon;
grant select, insert on table public.system_logs to authenticated;

create policy "Admin users can read system logs"
on public.system_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.user_id = (select auth.uid())
      and user_roles.role = 'admin'::public.app_role
  )
);

create policy "Authenticated users can insert system logs"
on public.system_logs
for insert
to authenticated
with check ((select auth.uid()) is not null);
