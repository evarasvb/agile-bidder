-- Perfil "comprador": pedido de Evaristo para quien solo necesita crear
-- solicitudes de cotización en Market del Estado, sin ver el resto de la
-- plataforma. El sistema de permisos por módulo (20261002140000) ya permite
-- restringir a un miembro a un solo módulo ('market'); esto solo agrega el
-- rol como opción reconocida, igual que se hizo con 'cobranza'.
-- mk_solicitar / la política mksol_ins ya dejan pedir cotizaciones a
-- cualquier usuario autenticado de un cliente, sin chequear rol — no hace
-- falta tocar RLS de Market del Estado.

alter type public.app_role add value if not exists 'comprador';

alter table public.vendedores drop constraint if exists vendedores_rol_check;
alter table public.vendedores add constraint vendedores_rol_check
  check (rol in ('admin', 'vendedor', 'visor', 'viewer', 'cobranza', 'comprador'));
