-- El hook useCalendarioIntegrado.ts (eventos personalizados del Calendario Integrado:
-- crear, editar, borrar recordatorios/tareas propias) ya lee/escribe en
-- `eventos_calendario` desde hace tiempo, pero la tabla nunca se creó: la consulta de
-- lectura lo esconde con un try/catch ("Table may not exist yet – ignore"), pero crear
-- o borrar un evento personalizado fallaba de verdad. Se crea la tabla con exactamente
-- las columnas que el hook ya espera (interface EventoCalendarioRow).
create table if not exists public.eventos_calendario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descripcion text,
  tipo text not null default 'otro' check (tipo in ('cierre', 'adjudicacion', 'tarea', 'recordatorio', 'otro')),
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz,
  todo_el_dia boolean not null default false,
  oportunidad_id text,
  oportunidad_tipo text,
  asignado_a text,
  repetir text not null default 'none' check (repetir in ('none', 'daily', 'weekly', 'monthly')),
  recordatorio_minutos integer,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists eventos_calendario_user_id_idx on public.eventos_calendario (user_id);

alter table public.eventos_calendario enable row level security;

create policy "eventos_calendario_select_own" on public.eventos_calendario
  for select using (auth.uid() = user_id);
create policy "eventos_calendario_insert_own" on public.eventos_calendario
  for insert with check (auth.uid() = user_id);
create policy "eventos_calendario_update_own" on public.eventos_calendario
  for update using (auth.uid() = user_id);
create policy "eventos_calendario_delete_own" on public.eventos_calendario
  for delete using (auth.uid() = user_id);
