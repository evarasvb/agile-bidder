-- Evaristo (soporte) ahora detecta cuando el usuario reporta un problema técnico (no solo una
-- duda de uso) y genera el ticket solo, sin esperar a que la persona toque "¿Prefieres que te
-- contacte el equipo?". `tipo` distingue bug de consulta y `origen` si lo creó Evaristo solo o
-- el usuario a mano, para que el equipo priorice y para medir cuánto se resuelve sin fricción.
alter table public.soporte_tickets add column if not exists tipo text not null default 'consulta';
alter table public.soporte_tickets add column if not exists origen text not null default 'manual';
create index if not exists soporte_tickets_tipo_idx on public.soporte_tickets (tipo, created_at desc);
