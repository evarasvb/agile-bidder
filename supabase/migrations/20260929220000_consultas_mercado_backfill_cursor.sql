-- Hallazgo P2 de Codex sobre la PR (commit 2f00a81): al arreglar que
-- sync-consultas-mercado siempre releyera las páginas 1..paginasMax (dejando
-- afuera las RF recientes cuando hay más páginas que el cupo), cada corrida
-- ahora vuelve a leer siempre las últimas paginasMax páginas — pero nunca las
-- páginas intermedias de esos mismos 45 días. Una institución cuya única RF
-- quedó, por ejemplo, en la página 50 de 114 nunca se ingesta.
--
-- Se agrega un cursor persistente de "backfill": cada corrida reparte su
-- cupo de páginas entre "recientes" (siempre las últimas, para no perder
-- nunca lo nuevo) y "backfill" (avanza secuencialmente desde donde quedó la
-- corrida anterior, hasta cubrir toda la ventana; al llegar al final vuelve
-- a empezar). Con el cron cada 15 minutos y cupo de 20 páginas (10+10), una
-- ventana de ~115 páginas se termina de cubrir en unas pocas horas.
create table if not exists public.consultas_mercado_sync_estado (
  id boolean primary key default true,
  constraint consultas_mercado_sync_estado_singleton check (id),
  ultima_pagina_backfill integer not null default 2,
  updated_at timestamptz not null default now()
);
insert into public.consultas_mercado_sync_estado (id, ultima_pagina_backfill)
values (true, 2)
on conflict (id) do nothing;

alter table public.consultas_mercado_sync_estado enable row level security;
-- Sin políticas para authenticated/anon: es estado interno del sync, solo
-- lo toca la edge function con service_role.
grant select, update on public.consultas_mercado_sync_estado to service_role;
