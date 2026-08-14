-- El wizard de onboarding (ClienteOnboarding) escribe onboarding_completado /
-- onboarding_step en `clientes`, pero esas columnas no existían -> el wizard
-- reventaba (por eso estaba "muerto"). Se agregan.
alter table public.clientes
  add column if not exists onboarding_completado boolean not null default false,
  add column if not exists onboarding_step integer not null default 1;

-- Backfill: los clientes que YA están operando (tienen categoría o inventario) se
-- marcan como onboarded, para no forzarlos a repetir el onboarding.
update public.clientes c
set onboarding_completado = true
where onboarding_completado = false
  and (
    c.categoria_negocio is not null
    or exists (select 1 from public.cliente_inventario i where i.cliente_id = c.id)
  );
