-- Conceptos ampliados por IA que el cliente decidió NO usar (clic en el chip).
-- Se guardan aparte para que una nueva ampliación no los vuelva a activar.
alter table public.cliente_filtros_oportunidades
  add column if not exists palabras_ia_descartadas text[] not null default '{}';
