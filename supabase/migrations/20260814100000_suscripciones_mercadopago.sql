-- Tabla de suscripciones (MercadoPago preapproval) para el Plan Pro.
create table if not exists public.suscripciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.clientes(id) on delete cascade,
  mp_preapproval_id text unique,
  plan text not null default 'pro',
  estado text,                    -- pending / authorized / paused / cancelled
  monto numeric,
  moneda text default 'CLP',
  proximo_cobro timestamptz,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_suscripciones_cliente on public.suscripciones(cliente_id);

alter table public.suscripciones enable row level security;

-- El cliente puede VER su propia suscripción. Las escrituras las hacen las edge
-- functions con service_role (que ignora RLS).
drop policy if exists "cliente ve su suscripcion" on public.suscripciones;
create policy "cliente ve su suscripcion"
  on public.suscripciones for select to authenticated
  using (cliente_id in (select id from public.clientes where user_id = (select auth.uid())));
