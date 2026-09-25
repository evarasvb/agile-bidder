-- Cobranza de facturas: el cliente registra sus facturas por cobrar (a
-- instituciones del Estado o a clientes privados) y sigue el estado de cada
-- gestión de cobro. Don Evaristo Abogado genera las cartas/requerimientos.
-- Aislamiento por cliente idéntico a cliente_inventario.
create table if not exists public.facturas_por_cobrar (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  deudor_tipo text not null default 'estado' check (deudor_tipo in ('estado', 'privado')),
  deudor_nombre text not null,
  deudor_rut text,
  oc_codigo text,
  numero_factura text,
  monto numeric not null default 0,
  fecha_emision date,
  fecha_recepcion date,
  fecha_vencimiento date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'recordada', 'requerida', 'pagada', 'judicial', 'incobrable')),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists facturas_por_cobrar_cliente_idx on public.facturas_por_cobrar (cliente_id);

alter table public.facturas_por_cobrar enable row level security;

drop policy if exists fpc_select_owner on public.facturas_por_cobrar;
create policy fpc_select_owner on public.facturas_por_cobrar for select
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists fpc_insert_owner on public.facturas_por_cobrar;
create policy fpc_insert_owner on public.facturas_por_cobrar for insert
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists fpc_update_owner on public.facturas_por_cobrar;
create policy fpc_update_owner on public.facturas_por_cobrar for update
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())))
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists fpc_delete_owner on public.facturas_por_cobrar;
create policy fpc_delete_owner on public.facturas_por_cobrar for delete
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
