-- Módulo Convenio Marco (gestión de marca / control de distribuidores).
-- Permite al cliente registrar las marcas que representa, sus distribuidores
-- autorizados, y generar solicitudes de baja de ficha para proveedores que
-- venden la marca sin ser distribuidores autorizados.
--
-- Aislamiento por cliente idéntico a cliente_inventario:
--   cliente_id = cliente_owner_id()  (empresa dueña, para miembros invitados)
--   OR cliente_id = auth.uid()       (compatibilidad con filas antiguas)

-- 1) Marcas que el cliente representa/posee -----------------------------------
create table if not exists public.cm_marcas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  nombre text not null,
  palabras_clave text[] not null default '{}',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cm_marcas_cliente_idx on public.cm_marcas (cliente_id);

-- 2) Distribuidores autorizados por marca -------------------------------------
create table if not exists public.cm_distribuidores (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  marca_id uuid not null references public.cm_marcas (id) on delete cascade,
  proveedor_nombre text not null,
  proveedor_rut text,
  notas text,
  created_at timestamptz not null default now()
);
create index if not exists cm_distribuidores_cliente_idx on public.cm_distribuidores (cliente_id);
create index if not exists cm_distribuidores_marca_idx on public.cm_distribuidores (marca_id);

-- 3) Solicitudes de baja de ficha ---------------------------------------------
create table if not exists public.cm_solicitudes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  marca_id uuid references public.cm_marcas (id) on delete set null,
  marca_nombre text,
  proveedor_nombre text not null,
  proveedor_rut text,
  producto text,
  producto_key text,
  motivo text,
  estado text not null default 'borrador'
    check (estado in ('borrador', 'enviada', 'aceptada', 'rechazada')),
  texto text,
  fecha_envio timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cm_solicitudes_cliente_idx on public.cm_solicitudes (cliente_id);
create index if not exists cm_solicitudes_marca_idx on public.cm_solicitudes (marca_id);

-- RLS ------------------------------------------------------------------------
alter table public.cm_marcas enable row level security;
alter table public.cm_distribuidores enable row level security;
alter table public.cm_solicitudes enable row level security;

-- cm_marcas
drop policy if exists cm_marcas_select_owner on public.cm_marcas;
create policy cm_marcas_select_owner on public.cm_marcas for select
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_marcas_insert_owner on public.cm_marcas;
create policy cm_marcas_insert_owner on public.cm_marcas for insert
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_marcas_update_owner on public.cm_marcas;
create policy cm_marcas_update_owner on public.cm_marcas for update
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())))
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_marcas_delete_owner on public.cm_marcas;
create policy cm_marcas_delete_owner on public.cm_marcas for delete
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));

-- cm_distribuidores
drop policy if exists cm_distribuidores_select_owner on public.cm_distribuidores;
create policy cm_distribuidores_select_owner on public.cm_distribuidores for select
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_distribuidores_insert_owner on public.cm_distribuidores;
create policy cm_distribuidores_insert_owner on public.cm_distribuidores for insert
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_distribuidores_update_owner on public.cm_distribuidores;
create policy cm_distribuidores_update_owner on public.cm_distribuidores for update
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())))
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_distribuidores_delete_owner on public.cm_distribuidores;
create policy cm_distribuidores_delete_owner on public.cm_distribuidores for delete
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));

-- cm_solicitudes
drop policy if exists cm_solicitudes_select_owner on public.cm_solicitudes;
create policy cm_solicitudes_select_owner on public.cm_solicitudes for select
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_solicitudes_insert_owner on public.cm_solicitudes;
create policy cm_solicitudes_insert_owner on public.cm_solicitudes for insert
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_solicitudes_update_owner on public.cm_solicitudes;
create policy cm_solicitudes_update_owner on public.cm_solicitudes for update
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())))
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cm_solicitudes_delete_owner on public.cm_solicitudes;
create policy cm_solicitudes_delete_owner on public.cm_solicitudes for delete
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
