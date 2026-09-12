-- Detalle por línea de producto de las órdenes de compra (cubo "por producto").
-- Tabla compacta: solo lo necesario para cruzar producto/categoría/proveedor/
-- institución/mes/monto sin arrastrar el peso de la cabecera.
create table if not exists public.oc_lineas (
  linea_id text primary key,          -- clave natural: codigo#correlativo
  codigo text not null,               -- OC a la que pertenece la línea
  correlativo numeric,
  producto text,
  categoria text,                     -- rubro real del ítem
  rubro_n1 text,
  tipo text,                          -- tipo de OC (compra ágil, trato directo, etc.)
  cantidad numeric,
  precio_neto numeric,
  moneda text,
  monto_linea numeric,
  rut_proveedor text,
  proveedor_nombre text,
  organismo text,
  rut_organismo text,
  fecha timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_oc_lineas_rut_prov on public.oc_lineas(rut_proveedor);
create index if not exists idx_oc_lineas_fecha on public.oc_lineas(fecha);
create index if not exists idx_oc_lineas_categoria on public.oc_lineas(categoria);
create index if not exists idx_oc_lineas_codigo on public.oc_lineas(codigo);

alter table public.oc_lineas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policy where polname='oc_lineas lectura todos' and polrelid='public.oc_lineas'::regclass) then
    create policy "oc_lineas lectura todos" on public.oc_lineas for select using (true);
  end if;
  if not exists (select 1 from pg_policy where polname='oc_lineas admin gestiona' and polrelid='public.oc_lineas'::regclass) then
    create policy "oc_lineas admin gestiona" on public.oc_lineas for all using ((select is_admin())) with check ((select is_admin()));
  end if;
end $$;
