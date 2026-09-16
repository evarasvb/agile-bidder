-- El boton "Importar Clientes" de Marketing > Contactos hace un select directo a
-- clientes desde el navegador, pero esa tabla tiene RLS "cada quien ve su propia
-- fila" (ver admin_traccion_resumen): en la practica el boton solo importaba la
-- ficha del propio admin. Mismo patron de RPC security-definer para exponer la
-- lista completa solo al admin.
create or replace function public.admin_clientes_para_importar()
returns table (
  email text,
  empresa_nombre text,
  nombre_responsable text,
  rut text
)
language sql stable security definer set search_path = public as $$
  select c.email, c.empresa_nombre, c.nombre_responsable, c.rut
  from clientes c
  where (auth.jwt() ->> 'email') = 'evaras@firmavb.cl';
$$;
grant execute on function public.admin_clientes_para_importar() to authenticated;
