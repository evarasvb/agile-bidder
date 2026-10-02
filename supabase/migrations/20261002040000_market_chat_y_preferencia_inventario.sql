-- Market de proveedores del Estado: 3 pedidos de Evaristo tras revisar el
-- módulo (solicitó resmas a DIMERC y preguntó a qué correo se mandó):
--
-- 1) mk_solicitar() nunca mandaba nada a un proveedor que no está en
--    FirmaVB (como DIMERC): la fila quedaba en 'invitacion_pendiente' sin
--    ningún aviso real, aunque la UI decía "lo invitamos". Mercado Público
--    no publica el correo de los proveedores (ordenes_compra no tiene esa
--    columna), así que no hay cómo automatizar un email a un tercero sin
--    cuenta: se resuelve en el frontend con un mensaje listo para que
--    Evaristo lo copie y lo mande él mismo (WhatsApp/correo que ya tenga).
-- 2) Preferencia para proveedores con catálogo propio en FirmaVB: antes el
--    boost de +2 en relevancia era el mismo para "tiene cuenta" que para
--    "tiene inventario cargado" — ahora se separan y el catálogo propio
--    pesa más (es la señal fuerte: está realmente vendiendo por acá). No
--    se agrega una columna nueva al resultado (ver nota de DROP FUNCTION
--    más abajo): el frontend ya puede derivar "tiene catálogo" de
--    `productos.some(p => p.catalogo)`, que mk_buscar ya devuelve.
-- 3) Chat en vivo entre solicitante y proveedor (ambos usuarios del ERP)
--    sobre una solicitud de cotización, con aviso por correo si no se lee
--    pronto (igual que el resto de alertas por cron de este proyecto, no
--    un trigger instantáneo: ver alerta-documento-email).
--
-- Nota técnica: mk_buscar() se reemplaza con CREATE OR REPLACE manteniendo
-- EXACTAMENTE las mismas columnas de salida — un DROP FUNCTION previo (para
-- agregar una columna) se probó y quedó colgado de forma reproducible al
-- aplicarlo (recarga de schema cache de PostgREST), aunque la base no tenía
-- ningún lock real pendiente. CREATE OR REPLACE sin cambiar el tipo de
-- retorno evita ese problema por completo.

-- ── 1) mk_buscar: separa el peso de "tiene catálogo" de "tiene cuenta" ──
CREATE OR REPLACE FUNCTION public.mk_buscar(p_q text, p_limit integer DEFAULT 30)
 RETURNS TABLE(rut text, proveedor text, es_firmavb boolean, acepta_solicitudes boolean, cliente_id uuid, productos jsonb, n_oc integer, n_organismos integer, precio_mediana numeric, ultima_venta timestamp with time zone, relevancia real)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '15s'
AS $function$
declare t text := lower(unaccent(trim(coalesce(p_q,'')))); w text[]; pat text;
begin
  select array_agg(x) into w from unnest(regexp_split_to_array(t, '\s+')) x where length(x) >= 3;
  if w is null then return; end if;
  return query
  with hits as (
    select d.*, word_similarity(t, d.producto_norm) ws
    from mk_directorio d
    where (select bool_and(d.producto_norm ilike '%'||left(x, greatest(4, length(x)-2))||'%') from unnest(w) x)
  ),
  pub as (
    select h.rut_norm, max(h.rut) rut, max(h.proveedor) proveedor,
           (select jsonb_agg(jsonb_build_object('producto', z.producto, 'n_oc', z.n_oc, 'precio_mediana', round(z.precio_mediana), 'ultima', z.ultima_venta::date))
              from (select * from hits h2 where h2.rut_norm = h.rut_norm order by h2.ws desc, h2.n_oc desc limit 4) z) productos,
           sum(h.n_oc)::int n_oc, max(h.n_organismos)::int n_org,
           percentile_cont(0.5) within group (order by h.precio_mediana) pm, max(h.ultima_venta) ult, max(h.ws) ws
    from hits h group by h.rut_norm
  ),
  inv as (
    select public.rut_norm(c.rut) rut_norm, c.rut, coalesce(p.nombre_publico, c.empresa_nombre) proveedor, c.id cid, p.acepta_solicitudes acepta,
           jsonb_agg(jsonb_build_object('producto', coalesce(ci.nombre_producto, ci.nombre), 'precio', ci.precio_unitario, 'stock', ci.stock_disponible, 'catalogo', true)) productos
    from cliente_inventario ci
    join clientes c on c.id = ci.cliente_id
    join mk_perfiles p on p.cliente_id = c.id and p.visible
    where (select bool_and(lower(unaccent(coalesce(ci.nombre_producto, ci.nombre,''))) ilike '%'||left(x, greatest(4, length(x)-2))||'%') from unnest(w) x)
    group by 1,2,3,4,5
  ),
  fv as (select public.rut_norm(c.rut) rn, c.id, coalesce(p.acepta_solicitudes, false) acepta
         from clientes c left join mk_perfiles p on p.cliente_id = c.id where c.rut is not null)
  select coalesce(pub.rut, inv.rut), coalesce(inv.proveedor, pub.proveedor),
         (fv.id is not null or inv.cid is not null), coalesce(inv.acepta, fv.acepta, false), coalesce(inv.cid, fv.id),
         coalesce(inv.productos, '[]'::jsonb) || coalesce(pub.productos, '[]'::jsonb),
         coalesce(pub.n_oc, 0), coalesce(pub.n_org, 0), round(pub.pm::numeric), pub.ult,
         -- Catálogo propio en FirmaVB: boost fuerte (+4, antes compartía el
         -- +2 con solo-tener-cuenta). Cuenta FirmaVB sin catálogo: boost
         -- chico (+1), ya no el mismo peso que quien sí está vendiendo acá
         -- (hallazgo/pedido de Evaristo).
         (coalesce(pub.ws, 0.5)
          + case when inv.cid is not null then 4 else 0 end
          + case when inv.cid is null and fv.id is not null then 1 else 0 end
          + ln(1 + coalesce(pub.n_oc, 0)) / 4 + coalesce(pub.n_org, 0) / 50.0)::real
  from pub full join inv on inv.rut_norm = pub.rut_norm
  left join fv on fv.rn = coalesce(pub.rut_norm, inv.rut_norm)
  order by 11 desc
  limit least(greatest(p_limit, 1), 60);
end $function$;

grant execute on function public.mk_buscar(text, integer) to anon, authenticated, service_role;

-- ── 2) Chat por solicitud ────────────────────────────────────────
create table if not exists public.mk_mensajes (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.mk_solicitudes (id) on delete cascade,
  autor_id uuid not null references public.clientes (id) on delete cascade,
  mensaje text not null,
  avisado_email boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_mkmsg_sol on public.mk_mensajes (solicitud_id, created_at);
create index if not exists idx_mkmsg_por_avisar on public.mk_mensajes (created_at) where not avisado_email;

grant select, insert on public.mk_mensajes to authenticated, service_role;
grant update (avisado_email) on public.mk_mensajes to service_role;
alter table public.mk_mensajes enable row level security;

-- Sin "drop policy if exists" previo (ver nota de DROP arriba): estas
-- políticas son nuevas (tabla recién creada), así que CREATE directo basta
-- y evita el mismo problema de recarga de schema cache.
create policy mkmsg_select on public.mk_mensajes for select to authenticated
  using (exists (
    select 1 from public.mk_solicitudes s
    where s.id = mk_mensajes.solicitud_id
      and ((s.solicitante_id = (select public.cliente_owner_id())) or (s.proveedor_id = (select public.cliente_owner_id())))));
create policy mkmsg_ins on public.mk_mensajes for insert to authenticated
  with check (
    autor_id = (select public.cliente_owner_id())
    and exists (
      select 1 from public.mk_solicitudes s
      where s.id = mk_mensajes.solicitud_id
        and ((s.solicitante_id = (select public.cliente_owner_id())) or (s.proveedor_id = (select public.cliente_owner_id())))));

-- Realtime solo para tablas con consumidor activo (ver reduce_realtime_surface):
-- este chat sí lo necesita, es su único propósito.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mk_mensajes'
  ) then
    alter publication supabase_realtime add table public.mk_mensajes;
  end if;
end $$;

-- Aviso in-app (campanita) al OTRO participante de la solicitud, igual que
-- ya hace mk_avisar() para solicitudes/cotizaciones.
CREATE OR REPLACE FUNCTION public.mk_avisar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid; txt text;
begin
  if tg_table_name = 'mk_solicitudes' then
    if new.proveedor_id is null or (tg_op = 'UPDATE' and old.proveedor_id is not distinct from new.proveedor_id) then return new; end if;
    select user_id into uid from clientes where id = new.proveedor_id;
    txt := '🤝 Marketplace: '||coalesce((select empresa_nombre from clientes where id = new.solicitante_id),'Un proveedor')||
           ' te pide cotizar "'||left(new.producto,80)||'"'||coalesce(' (x'||trim(to_char(new.cantidad,'FM999G999G999'))||')','')||
           coalesce(' para '||new.oportunidad_codigo,'')||'.';
  elsif tg_table_name = 'mk_cotizaciones' then
    select c.user_id into uid from mk_solicitudes s join clientes c on c.id = s.solicitante_id where s.id = new.solicitud_id;
    txt := '💬 Marketplace: te cotizaron'||coalesce(' a $'||trim(to_char(new.precio_unitario,'FM999G999G999'))||' c/u','')||
           coalesce(', entrega en '||new.plazo_entrega_dias||' días','')||'.';
  else -- mk_mensajes
    select c.user_id into uid
    from mk_solicitudes s
    join clientes c on c.id = (case when s.solicitante_id = new.autor_id then s.proveedor_id else s.solicitante_id end)
    where s.id = new.solicitud_id;
    txt := '💬 '||coalesce((select empresa_nombre from clientes where id = new.autor_id),'Te')||' escribió: "'||left(new.mensaje,100)||'"';
  end if;
  if uid is not null then insert into notifications (user_id, message) values (uid, txt); end if;
  return new;
end $function$;

create trigger trg_mk_msg_aviso after insert on public.mk_mensajes
  for each row execute function public.mk_avisar();

-- Mensajes nuevos sin avisar por correo (para el cron mk-avisar-mensajes-email):
-- un email por destinatario con lo pendiente, igual que
-- documentos_por_avisar/alerta-documento-email.
CREATE OR REPLACE FUNCTION public.mk_mensajes_por_avisar()
 RETURNS TABLE(id uuid, destino_email text, destino_nombre text, autor_nombre text, producto text, mensaje text, creado_en timestamptz)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, pd.email, cd.empresa_nombre, ca.empresa_nombre, s.producto, m.mensaje, m.created_at
  from mk_mensajes m
  join mk_solicitudes s on s.id = m.solicitud_id
  join clientes ca on ca.id = m.autor_id
  join clientes cd on cd.id = (case when s.solicitante_id = m.autor_id then s.proveedor_id else s.solicitante_id end)
  join profiles pd on pd.user_id = cd.user_id
  where not m.avisado_email
    -- Solo si el otro participante lleva más de 10 min sin que se le avise
    -- (deja tiempo a que lo vea en vivo en el chat antes de mandarle correo).
    and m.created_at < now() - interval '10 minutes'
  order by m.created_at;
$function$;

grant execute on function public.mk_mensajes_por_avisar() to service_role;

-- Marca por id (no por corte de tiempo): evita la carrera de marcar como
-- avisado un mensaje recién llegado que todavía no se intentó enviar por
-- correo en esta misma pasada del cron.
CREATE OR REPLACE FUNCTION public.mk_mensajes_marcar_avisados(p_ids uuid[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with u as (
    update mk_mensajes set avisado_email = true
    where id = any(p_ids)
    returning 1
  )
  select count(*)::int from u;
$function$;

grant execute on function public.mk_mensajes_marcar_avisados(uuid[]) to service_role;
