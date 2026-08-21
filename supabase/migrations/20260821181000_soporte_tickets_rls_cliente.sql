-- El cliente ve SOLO sus propios tickets (para la vista "Mis consultas").
drop policy if exists "cliente_ve_sus_tickets" on public.soporte_tickets;
create policy "cliente_ve_sus_tickets" on public.soporte_tickets
  for select using (user_id = auth.uid());

-- El admin ve/gestiona TODOS. Reconocemos al admin por rol (is_admin) o por el
-- correo del fundador, igual que AdminOnlyRoute en el frontend (evaras@firmavb.cl
-- aún no tiene fila en user_roles, así que solo el rol no bastaba).
drop policy if exists "admin_lee_tickets" on public.soporte_tickets;
create policy "admin_lee_tickets" on public.soporte_tickets
  for select using (
    public.is_admin() or lower(coalesce(auth.jwt() ->> 'email','')) = 'evaras@firmavb.cl'
  );

drop policy if exists "admin_gestiona_tickets" on public.soporte_tickets;
create policy "admin_gestiona_tickets" on public.soporte_tickets
  for update using (
    public.is_admin() or lower(coalesce(auth.jwt() ->> 'email','')) = 'evaras@firmavb.cl'
  ) with check (
    public.is_admin() or lower(coalesce(auth.jwt() ->> 'email','')) = 'evaras@firmavb.cl'
  );
