-- Permisos por módulo por miembro + rol "cobranza".
--   1. Agrega el valor 'cobranza' al enum app_role (para el rol de perfil).
--   2. Agrega vendedores.permisos (jsonb): lista de claves de módulos que el
--      miembro puede ver. null = acceso a todo (así no se bloquea a nadie que
--      ya exista). Las claves son las de src/lib/modulosPermisos.ts.
-- El gating real vive en el front (menú + guard de ruta); los datos sensibles
-- siguen protegidos por RLS. Idempotente.

alter type public.app_role add value if not exists 'cobranza';

-- El CHECK histórico de vendedores.rol (migración 20260318000002) solo permitía
-- admin/vendedor/viewer, lo que haría fallar el guardado del rol 'cobranza' (y
-- 'visor'). Se recrea con el vocabulario completo. En prod ese CHECK ya no
-- existía, pero en un build desde cero sí, así que esto lo deja consistente.
alter table public.vendedores drop constraint if exists vendedores_rol_check;
alter table public.vendedores add constraint vendedores_rol_check
  check (rol in ('admin', 'vendedor', 'visor', 'viewer', 'cobranza'));

alter table public.vendedores add column if not exists permisos jsonb;
comment on column public.vendedores.permisos is
  'Lista jsonb de claves de módulos permitidos para este miembro (ver src/lib/modulosPermisos.ts). null = acceso a todo (sin restricción).';
