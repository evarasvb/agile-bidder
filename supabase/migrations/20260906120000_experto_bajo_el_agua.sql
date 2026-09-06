-- Modo "Bajo el Agua": investigación profunda de una licitación a partir de su ID.
-- 1) Cuotas por plan: 1 informe gratis de por vida como gancho; después según plan (editable en la tabla, sin tocar código).
-- 2) experto_bajo_agua_datos: lo que está debajo de la superficie (proveedor de siempre, origen de las compras,
--    compras ágiles y convenio marco del mismo producto, desiertas, personas repetidas, reclamos, precio del producto).
-- 3) experto_libro devuelve el último informe Bajo el Agua y la cuota del usuario.

create table if not exists public.experto_bajo_agua_cuotas (
  plan text primary key,
  informes integer,                      -- null = sin límite
  periodo text not null default 'mes' check (periodo in ('mes', 'total')),
  updated_at timestamptz not null default now()
);
alter table public.experto_bajo_agua_cuotas enable row level security;
drop policy if exists experto_bajo_agua_cuotas_leer on public.experto_bajo_agua_cuotas;
create policy experto_bajo_agua_cuotas_leer on public.experto_bajo_agua_cuotas for select to authenticated using (true);
insert into public.experto_bajo_agua_cuotas (plan, informes, periodo) values
  ('free', 1, 'total'), ('pro', 10, 'mes'), ('plus', 30, 'mes'), ('starter', 5, 'mes'), ('professional', 30, 'mes'),
  ('business', null, 'mes'), ('enterprise', null, 'mes'), ('erp', null, 'mes')
on conflict (plan) do nothing;

-- Cuota del usuario: plan, informes usados en el período, máximo (null = sin límite) y período.
create or replace function public.experto_bajo_agua_cuota(p_user_id uuid)
returns table (plan text, usados integer, maximo integer, periodo text)
language sql stable security definer set search_path = public, experto as $$
  with p as (select coalesce((select u.plan from public.experto_uso_mes(p_user_id, 'libro') u limit 1), 'free') as plan),
       c as (select p.plan, case when q.plan is null then 10 else q.informes end as maximo, coalesce(q.periodo, 'mes') as periodo
             from p left join public.experto_bajo_agua_cuotas q on q.plan = p.plan)
  select c.plan,
         (select count(*)::int from experto.consultas x
           where x.user_id = p_user_id and x.modo = 'bajo_agua'
             and (c.periodo = 'total' or x.creado_en >= date_trunc('month', now()))),
         c.maximo, c.periodo
  from c;
$$;
revoke all on function public.experto_bajo_agua_cuota(uuid) from public, anon, authenticated;
grant execute on function public.experto_bajo_agua_cuota(uuid) to service_role;

create or replace function public.experto_bajo_agua_mi_cuota()
returns table (plan text, usados integer, maximo integer, periodo text)
language sql stable security definer set search_path = public as $$
  select * from public.experto_bajo_agua_cuota(auth.uid());
$$;
grant execute on function public.experto_bajo_agua_mi_cuota() to authenticated;

-- Índice de apoyo (los demás ya existen en producción).
create index if not exists compras_agiles_organismo_rut_idx on public.compras_agiles (organismo_rut);

-- Datos "bajo el agua" de una licitación (solo service_role; lo llama la función experto-bajo-agua).
create or replace function public.experto_bajo_agua_datos(p_codigo text)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  l record; r jsonb; rut text; org text; kw text[]; usuario text; res jsonb := '{}'::jsonb;
begin
  select * into l from public.licitaciones_bi where codigo = upper(p_codigo) order by updated_at desc limit 1;
  if not found then return null; end if;
  r := case when l.raw_data ? 'Comprador' then l.raw_data
            when jsonb_typeof(l.raw_data->'detail') = 'object' then l.raw_data->'detail'
            else coalesce(l.raw_data, '{}'::jsonb) end;
  rut := nullif(btrim(l.institucion_rut), ''); org := l.institucion_nombre;
  usuario := nullif(btrim(r->'Comprador'->>'NombreUsuario'), '');

  -- Palabras clave del objeto y de los primeros ítems, sin palabras genéricas.
  select coalesce(array_agg(w order by n), '{}'::text[]) into kw from (
    select w, min(n) as n from (
      select lower(unaccent(t.w)) as w, t.n
      from regexp_split_to_table(concat_ws(' ', l.nombre,
             (select string_agg(i.nombre_producto, ' ') from (select nombre_producto from public.licitaciones_bi_items where licitacion_id = l.id order by correlativo limit 3) i)),
             '[^[:alnum:]]+') with ordinality as t(w, n)) x
    where length(w) > 4 and w not in ('adquisicion','compra','compras','servicio','servicios','suministro','suministros','contratacion','licitacion','publica','publico','arriendo','otros','varios','insumos','material','materiales','equipos','equipamiento','mantencion','provision','reposicion','anual','periodo','meses','segun','bases','tecnicas','unidad','region','municipalidad','ilustre','hospital','direccion','departamento','programa','proyecto','ejecucion','implementacion','instalacion','productos','diversos','general','generales','requerimiento','requerimientos','establecimientos','establecimiento','distintos','nuevos','nuevas')
    group by w order by min(n) limit 4) y;

  res := res || jsonb_build_object('codigo', l.codigo, 'organismo', org, 'rut', rut, 'keywords', to_jsonb(kw), 'estado', l.estado, 'tipo', l.tipo);

  -- 1. Personas: quién lleva la licitación y cuántas veces se repite en este organismo (y en el mismo rubro).
  res := res || jsonb_build_object('personas', jsonb_build_object(
    'encargado', usuario, 'cargo', r->'Comprador'->>'CargoUsuario', 'unidad', r->'Comprador'->>'NombreUnidad',
    'responsable_contrato', r->>'NombreResponsableContrato', 'responsable_pago', r->>'NombreResponsablePago',
    'procesos_mismo_encargado', case when usuario is null or rut is null then null else
      (select count(*) from public.licitaciones_bi b where b.institucion_rut = rut and b.codigo <> l.codigo
         and btrim(coalesce(b.raw_data->'Comprador'->>'NombreUsuario', b.raw_data->'detail'->'Comprador'->>'NombreUsuario')) = usuario) end,
    'mismo_encargado_mismo_rubro', case when usuario is null or rut is null then null else
      (select count(*) from public.licitaciones_bi b where b.institucion_rut = rut and b.codigo <> l.codigo
         and btrim(coalesce(b.raw_data->'Comprador'->>'NombreUsuario', b.raw_data->'detail'->'Comprador'->>'NombreUsuario')) = usuario
         and exists (select 1 from unnest(kw) w where lower(unaccent(coalesce(b.nombre, ''))) like '%' || w || '%')) end,
    'lista', case when usuario is null or rut is null then '[]'::jsonb else
      (select coalesce(jsonb_agg(jsonb_build_object('codigo', b.codigo, 'nombre', left(b.nombre, 90), 'fecha', b.fecha_publicacion::date, 'estado', b.estado) order by b.fecha_publicacion desc), '[]'::jsonb)
         from (select * from public.licitaciones_bi b where b.institucion_rut = rut and b.codigo <> l.codigo
                 and btrim(coalesce(b.raw_data->'Comprador'->>'NombreUsuario', b.raw_data->'detail'->'Comprador'->>'NombreUsuario')) = usuario
               order by b.fecha_publicacion desc limit 8) b) end));

  -- 2. Contrato, renovación y adjudicación según la ficha de la API.
  res := res || jsonb_build_object('contrato', jsonb_build_object(
    'modalidad', r->>'Modalidad', 'tipo_pago', r->>'TipoPago', 'tipo_convocatoria', r->>'TipoConvocatoria',
    'duracion', nullif(concat_ws(' ', r->>'TiempoDuracionContrato', r->>'UnidadTiempoDuracionContrato'), ''), 'tipo_duracion', r->>'TipoDuracionContrato',
    'es_renovable', r->>'EsRenovable', 'renovacion', nullif(concat_ws(' ', r->>'ValorTiempoRenovacion', r->>'PeriodoTiempoRenovacion'), ''),
    'extension_plazo', r->>'ExtensionPlazo', 'toma_razon', r->>'TomaRazon', 'reclamos_ficha', r->>'CantidadReclamos',
    'adjudicacion', case when jsonb_typeof(r->'Adjudicacion') = 'object' then r->'Adjudicacion' else null end,
    'adjudicados', (select coalesce(jsonb_agg(jsonb_build_object('producto', it->>'NombreProducto', 'cantidad', it->>'Cantidad',
                       'proveedor', it->'Adjudicacion'->>'NombreProveedor', 'rut', it->'Adjudicacion'->>'RutProveedor',
                       'monto_unitario', it->'Adjudicacion'->>'MontoUnitario', 'cantidad_adjudicada', it->'Adjudicacion'->>'Cantidad')), '[]'::jsonb)
                    from jsonb_array_elements(case when jsonb_typeof(r->'Items'->'Listado') = 'array' then r->'Items'->'Listado' else '[]'::jsonb end) it
                    where jsonb_typeof(it->'Adjudicacion') = 'object')));

  -- 3. Órdenes de compra del organismo en el rubro (36 meses): proveedor dominante y por qué vía compra.
  res := res || jsonb_build_object('oc_rubro', (
    with oc as (
      select o.codigo, o.proveedor, o.rut_proveedor, o.fecha_envio_oc, o.total, public.mp_tipo_oc(o.codigo) as origen,
             i.producto, i.cantidad, i.precio_unitario
      from public.ordenes_compra o join public.ordenes_compra_items i on i.numero_oc = o.codigo
      where ((rut is not null and o.rut_demandante = rut) or (rut is null and o.demandante ilike org))
        and o.fecha_envio_oc >= now() - interval '36 months'
        and exists (select 1 from unnest(kw) w where coalesce(i.producto_norm, lower(unaccent(coalesce(i.producto, '')))) like '%' || w || '%'))
    select jsonb_build_object(
      'ordenes', (select count(distinct codigo) from oc),
      'monto', (select coalesce(sum(t), 0) from (select codigo, max(total) t from oc group by codigo) x),
      'desde', (select min(fecha_envio_oc)::date from oc), 'hasta', (select max(fecha_envio_oc)::date from oc),
      'por_origen', (select coalesce(jsonb_object_agg(origen, n), '{}'::jsonb) from (select origen, count(distinct codigo) n from oc group by origen) x),
      'proveedores', (select coalesce(jsonb_agg(jsonb_build_object('proveedor', proveedor, 'rut', rut_proveedor, 'ordenes', n, 'monto', m, 'precio_unit_mediano', med, 'ultima', ult, 'origenes', ors) order by n desc, m desc), '[]'::jsonb)
                      from (select proveedor, rut_proveedor, count(distinct codigo) n, sum(precio_unitario * cantidad) m,
                                   percentile_cont(0.5) within group (order by precio_unitario) filter (where precio_unitario > 0) med,
                                   max(fecha_envio_oc)::date ult, string_agg(distinct origen, ',') ors
                            from oc group by 1, 2 order by n desc, m desc limit 8) x),
      'items', (select coalesce(jsonb_agg(jsonb_build_object('oc', codigo, 'fecha', fecha_envio_oc::date, 'proveedor', proveedor, 'producto', left(producto, 80), 'cantidad', cantidad, 'precio_unitario', precio_unitario, 'origen', origen) order by fecha_envio_oc desc), '[]'::jsonb)
                from (select * from oc order by fecha_envio_oc desc limit 12) x))));

  -- 4. Compras ágiles del organismo con el mismo producto (18 meses).
  res := res || jsonb_build_object('compras_agiles', (
    with ca as (
      select * from public.compras_agiles c
      where ((rut is not null and c.organismo_rut = rut) or c.nombre_organismo ilike org)
        and coalesce(c.fecha_publicacion, c.fecha_cierre) >= now() - interval '18 months'
        and exists (select 1 from unnest(kw) w where lower(unaccent(coalesce(c.nombre, '') || ' ' || coalesce(c.descripcion, ''))) like '%' || w || '%'))
    select jsonb_build_object('total', (select count(*) from ca), 'monto', (select coalesce(sum(monto_estimado), 0) from ca),
      'lista', (select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', left(nombre, 90), 'fecha', coalesce(fecha_publicacion, fecha_cierre)::date, 'monto', monto_estimado, 'estado', estado, 'ofertas', ofertas_recibidas) order by coalesce(fecha_publicacion, fecha_cierre) desc), '[]'::jsonb)
                from (select * from ca order by coalesce(fecha_publicacion, fecha_cierre) desc limit 10) x))));

  -- 5. Desiertas, revocadas y suspendidas del organismo (OCDS + BI), primero las del mismo rubro.
  res := res || jsonb_build_object('desiertas', (
    with d as (
      select o.codigo, o.titulo, coalesce(o.fecha_publicacion, o.fecha_cierre) fecha, coalesce(nullif(o.estado_award, ''), o.estado_tender) estado, o.num_oferentes, o.monto_estimado,
             exists (select 1 from unnest(kw) w where lower(unaccent(coalesce(o.titulo, ''))) like '%' || w || '%') mismo_rubro
      from public.ocds_procesos o
      where rut is not null and o.comprador_rut = rut and (o.estado_tender ~* 'desiert|revocad|suspend' or o.estado_award ~* 'desiert|revocad|suspend')
      union all
      select b.codigo, b.nombre, b.fecha_publicacion, b.estado, null, b.presupuesto_estimado,
             exists (select 1 from unnest(kw) w where lower(unaccent(coalesce(b.nombre, ''))) like '%' || w || '%')
      from public.licitaciones_bi b
      where rut is not null and b.institucion_rut = rut and b.estado ~* 'desiert|revocad|suspend'
        and not exists (select 1 from public.ocds_procesos o where o.codigo = b.codigo))
    select jsonb_build_object('total', (select count(*) from d), 'mismo_rubro', (select count(*) from d where mismo_rubro),
      'lista', (select coalesce(jsonb_agg(jsonb_build_object('codigo', codigo, 'titulo', left(titulo, 90), 'fecha', fecha::date, 'estado', estado, 'oferentes', num_oferentes, 'presupuesto', monto_estimado, 'mismo_rubro', mismo_rubro) order by mismo_rubro desc, fecha desc), '[]'::jsonb)
                from (select * from d order by mismo_rubro desc, fecha desc limit 10) x))));

  -- 6. Precio del producto en todo el Estado (24 meses): mediana, rango, por vía de compra y quién lo vende.
  res := res || jsonb_build_object('precio_producto', (
    with it as (
      select o.codigo, o.proveedor, o.rut_proveedor, o.rut_demandante, o.fecha_envio_oc, public.mp_tipo_oc(o.codigo) as origen, i.precio_unitario, i.cantidad, i.producto
      from public.ordenes_compra_items i join public.ordenes_compra o on o.codigo = i.numero_oc
      where o.fecha_envio_oc >= now() - interval '24 months' and i.precio_unitario > 0
        and exists (select 1 from unnest(kw) w where coalesce(i.producto_norm, lower(unaccent(coalesce(i.producto, '')))) like '%' || w || '%'))
    select jsonb_build_object('items', (select count(*) from it), 'compradores', (select count(distinct rut_demandante) from it),
      'mediana', (select percentile_cont(0.5) within group (order by precio_unitario) from it),
      'p25', (select percentile_cont(0.25) within group (order by precio_unitario) from it),
      'p75', (select percentile_cont(0.75) within group (order by precio_unitario) from it),
      'minimo', (select min(precio_unitario) from it), 'maximo', (select max(precio_unitario) from it),
      'por_origen', (select coalesce(jsonb_agg(jsonb_build_object('origen', origen, 'items', n, 'mediana', med) order by n desc), '[]'::jsonb)
                     from (select origen, count(*) n, percentile_cont(0.5) within group (order by precio_unitario) med from it group by origen) x),
      'proveedores', (select coalesce(jsonb_agg(jsonb_build_object('proveedor', proveedor, 'rut', rut_proveedor, 'ordenes', n, 'compradores', c, 'precio_unit_mediano', med) order by n desc), '[]'::jsonb)
                      from (select proveedor, rut_proveedor, count(distinct codigo) n, count(distinct rut_demandante) c, percentile_cont(0.5) within group (order by precio_unitario) med
                            from it group by 1, 2 order by n desc limit 6) x),
      'ejemplos', (select coalesce(jsonb_agg(jsonb_build_object('producto', left(producto, 70), 'precio_unitario', precio_unitario, 'proveedor', proveedor, 'fecha', fecha_envio_oc::date, 'origen', origen)), '[]'::jsonb)
                   from (select * from it order by fecha_envio_oc desc limit 6) x))));

  -- 7. Reclamos contra el organismo (24 meses), sobre este proceso y sobre procesos del mismo rubro.
  res := res || jsonb_build_object('reclamos', jsonb_build_object(
    'por_tipo', (select coalesce(jsonb_object_agg(tipo, n), '{}'::jsonb) from (select coalesce(tipo::text, 's/i') tipo, count(*) n from public.reclamos_mp where rut is not null and organismo_rut = rut and fecha >= (now() - interval '24 months')::date group by 1) x),
    'este_proceso', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'fecha', fecha, 'reclamante', reclamante, 'estado', estado)), '[]'::jsonb) from public.reclamos_mp where proceso_codigo = l.codigo),
    'mismo_rubro', (select coalesce(jsonb_agg(jsonb_build_object('proceso', x.proceso_codigo, 'tipo', x.tipo, 'fecha', x.fecha, 'reclamante', x.reclamante, 'estado', x.estado) order by x.fecha desc), '[]'::jsonb)
                    from (select m.* from public.reclamos_mp m join public.licitaciones_bi b on b.codigo = m.proceso_codigo
                          where rut is not null and m.organismo_rut = rut and exists (select 1 from unnest(kw) w where lower(unaccent(coalesce(b.nombre, ''))) like '%' || w || '%')
                          order by m.fecha desc limit 8) x)));

  -- 8. Enlaces para verificar a mano lo que no está en la base (lobby, dictámenes, prensa, transparencia).
  res := res || jsonb_build_object('enlaces', jsonb_build_object(
    'ficha', 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=' || l.codigo,
    'lobby', 'https://www.google.com/search?q=' || regexp_replace('site:infolobby.cl "' || unaccent(coalesce(org, '')) || '"', '[^A-Za-z0-9":.]+', '+', 'g'),
    'dictamenes', 'https://www.google.com/search?q=' || regexp_replace('site:contraloria.cl dictamen "' || unaccent(coalesce(org, '')) || '" licitacion ' || array_to_string(kw[1:2], ' '), '[^A-Za-z0-9":.]+', '+', 'g'),
    'noticias', 'https://news.google.com/search?q=' || regexp_replace(unaccent(coalesce(org, '')) || ' ' || array_to_string(kw[1:2], ' '), '[^A-Za-z0-9]+', '+', 'g') || '&hl=es-419&gl=CL&ceid=CL:es-419',
    'transparencia', 'https://www.portaltransparencia.cl/PortalPdT/',
    'analiza', 'https://analiza.mercadopublico.cl/'));

  return res;
end $$;
revoke all on function public.experto_bajo_agua_datos(text) from public, anon, authenticated;
grant execute on function public.experto_bajo_agua_datos(text) to service_role;

-- Libro: ahora trae también el último informe Bajo el Agua y la cuota del usuario.
create or replace function public.experto_libro(p_codigo text)
returns jsonb language sql stable security definer set search_path to 'public', 'experto' as $function$
  with f as (
    select coalesce(
      public.experto_ficha_licitacion(upper(p_codigo)),
      (select jsonb_build_object('codigo', ca.codigo, 'nombre', ca.nombre, 'institucion', ca.nombre_organismo, 'tipo', 'Compra Ágil',
                                 'presupuesto', ca.monto_estimado, 'moneda', ca.moneda, 'estado', ca.estado, 'region', ca.region,
                                 'fecha_publicacion', ca.fecha_publicacion, 'fecha_cierre', ca.fecha_cierre, 'descripcion', ca.descripcion,
                                 'url', coalesce(ca.url_ficha, 'https://www.mercadopublico.cl/CompraAgil/Modules/CA/DetallesCompraAgil.aspx?codigo=' || ca.codigo),
                                 'rut_institucion', ca.organismo_rut,
                                 'organismo', (select to_jsonb(o) from public.experto_organismo(coalesce(ca.organismo_rut, ca.nombre_organismo)) o limit 1),
                                 'items', (select coalesce(jsonb_agg(jsonb_build_object('producto', i.nombre_producto, 'cantidad', i.cantidad, 'unidad', i.unidad, 'descripcion', i.descripcion_producto)), '[]'::jsonb)
                                           from public.compras_agiles_items i where i.compra_agil_id = ca.id))
       from public.compras_agiles ca where upper(ca.codigo) = upper(p_codigo) limit 1)
    ) ficha)
  select jsonb_build_object(
    'codigo', upper(p_codigo),
    'ficha', (select ficha from f),
    'bases', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'archivo', b.archivo, 'paginas', b.paginas, 'creado_en', b.creado_en, 'resumen', b.resumen) order by b.creado_en desc), '[]'::jsonb)
              from public.bases_licitacion b where upper(b.codigo) = upper(p_codigo) and coalesce(b.caracteres, 0) > 200),
    'documentos', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'tipo', d.tipo, 'caracteres', d.caracteres, 'creado_en', d.creado_en) order by d.creado_en desc), '[]'::jsonb)
                   from experto.documentos d where d.user_id = auth.uid() and upper(d.codigo) = upper(p_codigo)),
    'top_adjudicatarios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from f, lateral public.experto_top_adjudicatarios(f.ficha->'organismo'->>'rut', 12, 6) t where f.ficha->'organismo'->>'rut' is not null),
    'chat', (select coalesce(jsonb_agg(jsonb_build_object('pregunta', c.pregunta, 'respuesta', c.respuesta, 'creado_en', c.creado_en) order by c.creado_en), '[]'::jsonb)
             from (select * from experto.consultas where user_id = auth.uid() and upper(licitacion) = upper(p_codigo) and modo = 'chat' order by creado_en desc limit 30) c),
    'informe', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'informe' order by c.creado_en desc limit 1),
    'estudio', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'estudio' order by c.creado_en desc limit 1),
    'bajo_agua', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'bajo_agua' order by c.creado_en desc limit 1),
    'bajo_agua_cuota', (select to_jsonb(q) from public.experto_bajo_agua_cuota(auth.uid()) q limit 1),
    'mapa', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'mapa' order by c.creado_en desc limit 1),
    'matriz', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'matriz' order by c.creado_en desc limit 1),
    'anexos', (select jsonb_build_object('texto', a.contenido, 'faltantes', a.faltantes, 'creado_en', a.creado_en) from public.experto_anexos a where a.user_id = auth.uid() and upper(a.codigo) = upper(p_codigo) order by a.creado_en desc limit 1),
    'plan', public.experto_mi_plan()
  );
$function$;
