-- Correcciones manuales del match por cliente.
-- El match de compras ágiles se calcula en el cliente (useProductMatching) contra
-- cliente_inventario. Antes no se podía corregir cuando el algoritmo elegía mal.
-- Esta tabla persiste, por cliente y por ítem de una compra, la corrección:
--   descartado  = el ítem no es relevante para mí (se oculta de la propuesta)
--   confirmado  = el match sugerido es correcto (lo fijo)
--   reasignado  = yo elijo con qué producto de mi inventario hace match
create table if not exists public.match_overrides (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null default auth.uid(),
  proceso_tipo  text not null default 'compra_agil',
  codigo        text not null,
  item_ref      text not null,
  item_nombre   text,
  accion        text not null check (accion in ('descartado','confirmado','reasignado')),
  inventario_id uuid,          -- cliente_inventario.id cuando accion='reasignado'
  score_manual  numeric,       -- ajuste manual opcional del %
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cliente_id, proceso_tipo, codigo, item_ref)
);

alter table public.match_overrides enable row level security;

drop policy if exists "match_overrides_own" on public.match_overrides;
create policy "match_overrides_own" on public.match_overrides
  for all
  using (cliente_id = auth.uid())
  with check (cliente_id = auth.uid());

create index if not exists match_overrides_cliente_codigo_idx
  on public.match_overrides (cliente_id, codigo);

grant select, insert, update, delete on public.match_overrides to authenticated;
