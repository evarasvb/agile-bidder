-- Clusters de búsqueda de oportunidades: hasta ahora las palabras clave del
-- cliente eran una sola bolsa plana (cliente_filtros_oportunidades.palabras_incluir),
-- mezclando rubros muy distintos en un cliente que vende varias líneas (ej:
-- oficina + aseo). Esta tabla separa las palabras por industria (la misma
-- clasificación fija que ya usa el onboarding: src/components/cliente-onboarding/
-- industrias.ts), y cada cluster se puede prender/apagar entero sin borrar sus
-- palabras. cliente_filtros_oportunidades sigue existiendo tal cual (modo
-- plano, para clientes que no han migrado a clusters) y palabras_excluir /
-- regiones_activas / monto_min / monto_max siguen siendo globales ahí.

create table if not exists public.cliente_cluster_palabras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  -- id de industrias.ts (medico, oficina, aseo, ...) o 'otro'/un nombre libre
  -- si el cliente agrega un rubro fuera de la lista fija.
  industria text not null,
  activo boolean not null default true,
  palabras text[] not null default '{}',
  palabras_ia text[] not null default '{}',
  palabras_ia_descartadas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, industria)
);

create index if not exists cliente_cluster_palabras_cliente_idx
  on public.cliente_cluster_palabras (cliente_id);

alter table public.cliente_cluster_palabras enable row level security;

create policy "Clientes pueden ver sus propios clusters"
  on public.cliente_cluster_palabras
  for select
  using (cliente_id in (select clientes.id from public.clientes where clientes.user_id = (select auth.uid())));

create policy "Clientes pueden insertar sus propios clusters"
  on public.cliente_cluster_palabras
  for insert
  with check (cliente_id in (select clientes.id from public.clientes where clientes.user_id = (select auth.uid())));

create policy "Clientes pueden actualizar sus propios clusters"
  on public.cliente_cluster_palabras
  for update
  using (cliente_id in (select clientes.id from public.clientes where clientes.user_id = (select auth.uid())));

create policy "Clientes pueden borrar sus propios clusters"
  on public.cliente_cluster_palabras
  for delete
  using (cliente_id in (select clientes.id from public.clientes where clientes.user_id = (select auth.uid())));

create policy "Service role puede hacer todo en clusters"
  on public.cliente_cluster_palabras
  for all
  using ((select auth.role()) = 'service_role');
