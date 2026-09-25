-- Control de aviso por correo de citas: columna para no repetir el aviso.
alter table public.agendamientos_meet add column if not exists avisado boolean not null default false;
-- Baseline: las citas ya existentes no se re-avisan; solo las nuevas de ahora en adelante.
update public.agendamientos_meet set avisado = true where avisado = false;
create index if not exists idx_agendamientos_meet_avisado on public.agendamientos_meet (avisado) where avisado = false;
