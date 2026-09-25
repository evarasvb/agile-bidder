-- Veredicto de IA por oportunidad ("¿me conviene?"): recomendación generada
-- bajo demanda (botón), cacheada por cliente + oportunidad para no repetir el
-- llamado a Gemini en cada visita. Cliente_id es siempre el dueño resuelto por
-- cliente_owner_id() (así un vendedor/miembro de equipo ve y comparte el
-- mismo veredicto que la empresa dueña, no uno propio por usuario).
create table if not exists public.oportunidad_veredictos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  tipo text not null check (tipo in ('licitacion', 'compra_agil')),
  codigo text not null,
  recomendacion text not null check (recomendacion in ('ofertar', 'revisar', 'descartar')),
  razon text not null,
  puntos_favor text[] not null default '{}',
  puntos_contra text[] not null default '{}',
  generado_en timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (cliente_id, tipo, codigo)
);

create index if not exists idx_oportunidad_veredictos_cliente on public.oportunidad_veredictos(cliente_id);

alter table public.oportunidad_veredictos enable row level security;

create policy "veredictos_select_propio" on public.oportunidad_veredictos
  for select using (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

create policy "veredictos_insert_propio" on public.oportunidad_veredictos
  for insert with check (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

create policy "veredictos_update_propio" on public.oportunidad_veredictos
  for update using (cliente_id = public.cliente_owner_id() or cliente_id = auth.uid());

revoke all on public.oportunidad_veredictos from public, anon;
grant select, insert, update on public.oportunidad_veredictos to authenticated;
