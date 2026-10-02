-- Market de proveedores del Estado: 2 pedidos de Evaristo después del chat.
--
-- 1) El administrador puede eliminar una solicitud, y queda registro de qué
--    usuario (no solo qué empresa) la creó — útil cuando varios vendedores
--    de la misma empresa piden cotizaciones. mk_mis_solicitudes() ya está
--    publicada vía RPC con columnas fijas: agregarle una columna nueva
--    exige un DROP FUNCTION, que en este entorno quedó colgado de forma
--    reproducible al aplicarlo (ver migración 20261002040000) — se evita
--    dejando la función original intacta y agregando mk_mis_solicitudes_v2()
--    como una función nueva con el campo de más; el frontend pasa a usar
--    esta.
--
-- 2) Tabla compartida de contactos de proveedores (mk_proveedor_contactos):
--    Mercado Público no publica el correo de los proveedores, así que no
--    hay forma de automatizar por completo el conseguirlo. Se deja un lugar
--    para guardar lo que sí se consiga (búsqueda manual, scraping puntual,
--    que el propio Evaristo lo escriba tras llamar) — email, teléfono,
--    whatsapp, dirección, comuna, región, nombre de contacto. Es de lectura
--    pública (como mk_directorio) y cualquier usuario autenticado puede
--    agregar/corregir — es un directorio colaborativo, no un dato privado
--    de una empresa.

-- ── 1) Admin elimina solicitudes + registro de quién la creó ────────
alter table public.mk_solicitudes add column if not exists creado_por uuid references auth.users(id);

CREATE OR REPLACE FUNCTION public.mk_solicitar(p_rut_proveedor text, p_producto text, p_cantidad numeric DEFAULT NULL::numeric, p_unidad text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_fecha date DEFAULT NULL::date, p_oportunidad text DEFAULT NULL::text, p_mensaje text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare yo uuid := public.cliente_owner_id(); prov uuid; nom text; sid uuid;
begin
  if yo is null then raise exception 'Debes iniciar sesión como cliente FirmaVB'; end if;
  if coalesce(trim(p_producto),'') = '' then raise exception 'Falta el producto'; end if;
  select c.id, c.empresa_nombre into prov, nom from clientes c where public.rut_norm(c.rut) = public.rut_norm(p_rut_proveedor) limit 1;
  if prov = yo then raise exception 'No puedes cotizarte a ti mismo'; end if;
  if nom is null then select proveedor into nom from mk_directorio where rut_norm = public.rut_norm(p_rut_proveedor) limit 1; end if;
  insert into mk_solicitudes (solicitante_id, proveedor_id, proveedor_rut_norm, proveedor_nombre, producto, cantidad, unidad, region_entrega,
                              fecha_requerida, oportunidad_codigo, mensaje, estado, creado_por)
  values (yo, prov, public.rut_norm(p_rut_proveedor), nom, left(p_producto, 500), p_cantidad, p_unidad, p_region, p_fecha,
          p_oportunidad, left(p_mensaje, 2000), case when prov is null then 'invitacion_pendiente' else 'enviada' end, auth.uid())
  returning id into sid;
  return sid;
end $function$;

-- Mismas columnas que mk_mis_solicitudes() + creado_por_nombre + el RUT del
-- proveedor (lo necesita el frontend para buscar su ficha de contacto).
CREATE OR REPLACE FUNCTION public.mk_mis_solicitudes_v2()
 RETURNS TABLE(id uuid, rol text, contraparte text, producto text, cantidad numeric, oportunidad_codigo text, estado text, created_at timestamp with time zone, cotizaciones jsonb, creado_por_nombre text, proveedor_rut_norm text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select s.id, case when s.solicitante_id = public.cliente_owner_id() then 'enviada' else 'recibida' end,
         case when s.solicitante_id = public.cliente_owner_id() then s.proveedor_nombre else (select empresa_nombre from clientes where id = s.solicitante_id) end,
         s.producto, s.cantidad, s.oportunidad_codigo, s.estado, s.created_at,
         coalesce((select jsonb_agg(to_jsonb(k) - 'solicitud_id' order by k.created_at) from mk_cotizaciones k where k.solicitud_id = s.id), '[]'),
         coalesce(p.full_name, p.email),
         s.proveedor_rut_norm
  from mk_solicitudes s
  left join profiles p on p.user_id = s.creado_por
  where public.cliente_owner_id() in (s.solicitante_id, s.proveedor_id)
  order by s.created_at desc limit 200;
$function$;

grant execute on function public.mk_mis_solicitudes_v2() to anon, authenticated, service_role;

-- DELETE: solo un administrador (user_roles.role = 'admin', misma función
-- que ya usan las demás políticas del proyecto) de alguna de las dos
-- empresas involucradas.
-- (Ampliada a super_admin en 20261002140000_mksol_del_super_admin.sql —
-- is_super_admin() todavía no existía cuando se escribió esta migración.)
create policy mksol_del on public.mk_solicitudes for delete to authenticated
  using (
    ((solicitante_id = (select public.cliente_owner_id())) or (proveedor_id = (select public.cliente_owner_id())))
    and public.has_role(auth.uid(), 'admin'::app_role)
  );

grant delete on public.mk_solicitudes to authenticated;

-- ── 2) Directorio colaborativo de contactos de proveedores ──────────
create table if not exists public.mk_proveedor_contactos (
  rut_norm text primary key,
  rut text,
  proveedor text,
  email text,
  telefono text,
  whatsapp text,
  sitio_web text,
  direccion text,
  comuna text,
  region text,
  nombre_contacto text,
  fuente text,
  notas text,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users(id)
);

grant select on public.mk_proveedor_contactos to anon, authenticated, service_role;
grant insert, update on public.mk_proveedor_contactos to authenticated, service_role;
alter table public.mk_proveedor_contactos enable row level security;

create policy mkpc_select on public.mk_proveedor_contactos for select to anon, authenticated using (true);
create policy mkpc_ins on public.mk_proveedor_contactos for insert to authenticated with check (true);
create policy mkpc_upd on public.mk_proveedor_contactos for update to authenticated using (true) with check (true);

-- Lo que se encontró de DIMERC al probar el enfoque (búsqueda web, 02-oct-2026):
-- dirección real sí está pública; correo no (y su sitio bloquea scraping
-- automático con 403) — mejor vía con ellos es llamar o usar su formulario.
insert into public.mk_proveedor_contactos (rut_norm, rut, proveedor, sitio_web, direccion, comuna, region, fuente, notas)
values ('966708409', '96.670.840-9', 'DIMERC S A', 'https://www.dimerc.cl', 'Alberto Pepper 1784', 'Renca', 'Metropolitana',
        'Búsqueda web (guiasenior.com), 02-oct-2026',
        'No se encontró correo público ni WhatsApp — dimerc.cl bloquea scraping automático (403). Mejor vía: llamar o usar el formulario de contacto del sitio.')
on conflict (rut_norm) do update set
  sitio_web = excluded.sitio_web, direccion = excluded.direccion, comuna = excluded.comuna, region = excluded.region,
  fuente = excluded.fuente, notas = excluded.notas, actualizado_en = now();
