-- Bitácora de seguimiento de cobranza (CRM): cada gestión sobre una factura por
-- cobrar (llamada, correo, WhatsApp, visita, nota), con fecha y próximo contacto.
-- Aislamiento por cliente idéntico a facturas_por_cobrar. Se borra en cascada si
-- se elimina la factura.
create table if not exists public.cobranza_seguimiento (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas_por_cobrar (id) on delete cascade,
  cliente_id uuid not null,
  fecha date not null default current_date,
  canal text not null default 'nota'
    check (canal in ('llamada', 'correo', 'whatsapp', 'visita', 'nota', 'otro')),
  nota text not null,
  proximo date,
  created_at timestamptz not null default now()
);
create index if not exists cobranza_seguimiento_factura_idx on public.cobranza_seguimiento (factura_id);
create index if not exists cobranza_seguimiento_cliente_idx on public.cobranza_seguimiento (cliente_id);

alter table public.cobranza_seguimiento enable row level security;

drop policy if exists cs_select_owner on public.cobranza_seguimiento;
create policy cs_select_owner on public.cobranza_seguimiento for select
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cs_insert_owner on public.cobranza_seguimiento;
create policy cs_insert_owner on public.cobranza_seguimiento for insert
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cs_update_owner on public.cobranza_seguimiento;
create policy cs_update_owner on public.cobranza_seguimiento for update
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())))
  with check ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
drop policy if exists cs_delete_owner on public.cobranza_seguimiento;
create policy cs_delete_owner on public.cobranza_seguimiento for delete
  using ((cliente_id = (select cliente_owner_id())) or (cliente_id = (select auth.uid())));
