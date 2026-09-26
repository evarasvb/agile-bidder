-- Pagos de cursos de la Academia (Mercado Público → Mercado Pago Checkout Pro).
-- Registra cada intento de compra; el webhook lo marca aprobado, asigna un
-- código de academia_accesos al email del comprador y se lo envía.
-- Solo el service_role (edge functions) accede: RLS habilitada sin políticas.
create table if not exists public.academia_pagos (
  id uuid primary key default gen_random_uuid(),
  curso_slug text not null,
  email text,
  monto integer not null,
  estado text not null default 'pendiente',
  mp_preference_id text,
  mp_payment_id text,
  codigo_entregado text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.academia_pagos enable row level security;
