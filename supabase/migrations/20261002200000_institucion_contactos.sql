-- Pedido de Evaristo sobre Cobranza: el campo de "nombre de contacto" no debe
-- ser solo texto suelto por factura — tiene que ser un directorio COMPARTIDO
-- de contactos por institución (venta, cobranza, etc.) que se va
-- "robusteciendo" a medida que cualquier cliente de FirmaVB agrega uno: la
-- próxima vez que alguien cobre a esa misma institución, ya encuentra el
-- contacto con su correo listo, en vez de escribirlo de nuevo.
--
-- Mismo patrón colaborativo que mk_proveedor_contactos (20261002050000):
-- lectura pública, cualquier autenticado puede agregar/editar — no es un dato
-- privado de una empresa, es inteligencia compartida sobre instituciones.
-- Separado de marketing_contactos (que es la agenda PRIVADA de Evaristo para
-- marketing propio, gateada a evaras@firmavb.cl) a propósito: esto lo ve y
-- edita cualquier cliente.
create table if not exists public.institucion_contactos (
  id uuid primary key default gen_random_uuid(),
  institucion_rut text not null,
  institucion_nombre text,
  nombre_contacto text not null,
  email text,
  telefono text,
  cargo text,
  -- Para qué sirve este contacto: 'venta', 'cobranza', etc. Un mismo contacto
  -- puede servir para varias cosas.
  etiquetas text[] not null default '{}',
  notas text,
  agregado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_institucion_contactos_rut on public.institucion_contactos (institucion_rut);

grant select on public.institucion_contactos to anon, authenticated, service_role;
grant insert, update on public.institucion_contactos to authenticated, service_role;
alter table public.institucion_contactos enable row level security;

create policy ic_select on public.institucion_contactos for select to anon, authenticated using (true);
create policy ic_ins on public.institucion_contactos for insert to authenticated with check (true);
create policy ic_upd on public.institucion_contactos for update to authenticated using (true) with check (true);
