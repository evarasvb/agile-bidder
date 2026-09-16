-- Aplicada directo a la base por otra sesión (sin dejar el archivo en el repo).
-- La dejamos versionada para que supabase/migrations refleje el estado real
-- de la base: agrega tipo/origen a soporte_tickets (para distinguir tickets
-- creados a mano de los que abre el bot de guardián/monitoreo automático).
alter table public.soporte_tickets add column if not exists tipo text not null default 'consulta';
alter table public.soporte_tickets add column if not exists origen text not null default 'manual';
create index if not exists soporte_tickets_tipo_idx on public.soporte_tickets (tipo, created_at desc);
