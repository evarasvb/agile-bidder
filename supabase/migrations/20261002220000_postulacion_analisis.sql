-- Pedido de Evaristo: en Postulaciones, para lo que se perdió (o ganó) un
-- resumen breve de IA de por qué, y para lo que no se postuló, quién ganó y
-- por qué. Mismo patrón que oportunidad_veredictos/veredicto-oportunidad
-- (tabla-caché por cliente + edge function que la llena con el client
-- autenticado como el propio usuario, no service_role): RLS scoped a
-- cliente_id = cliente_owner_id() para select/insert/update.
create table if not exists public.postulacion_analisis (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  tipo text not null check (tipo in ('licitacion', 'compra_agil')),
  codigo text not null,
  resultado text not null check (resultado in ('ganada', 'perdida', 'sin_tomar')),
  resumen text not null,
  factores text[] not null default '{}',
  generado_en timestamptz not null default now(),
  unique (cliente_id, tipo, codigo)
);

grant select, insert, update on public.postulacion_analisis to authenticated;
grant select, insert, update on public.postulacion_analisis to service_role;
alter table public.postulacion_analisis enable row level security;

create policy pa_select on public.postulacion_analisis for select to authenticated
  using (cliente_id = public.cliente_owner_id());
create policy pa_insert on public.postulacion_analisis for insert to authenticated
  with check (cliente_id = public.cliente_owner_id());
create policy pa_update on public.postulacion_analisis for update to authenticated
  using (cliente_id = public.cliente_owner_id());
