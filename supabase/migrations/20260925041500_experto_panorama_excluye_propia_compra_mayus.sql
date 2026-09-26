-- Hallazgo P2 de Codex: la exclusión `c.codigo <> v_codigo` agregada en la
-- migración anterior compara contra `v_codigo` (siempre en mayúsculas), pero
-- `compras_agiles.codigo` no se normaliza a mayúsculas al insertarse
-- (sync-compras-agiles-csv guarda el valor del CSV tal cual). Verificado en
-- la base viva: 12 filas de 125.609 tienen el código en minúscula o mixto.
-- Para esas filas, si el código consultado ES esa compra, la comparación en
-- minúsculas nunca calzaba con v_codigo y la compra se auto-incluía en
-- "relacionadas" igual. Se normaliza con upper(), mismo criterio que ya usa
-- la función para el lookup inicial (`upper(codigo) = v_codigo`).
create or replace function public.experto_panorama_licitacion(p_codigo text, p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_rut text; v_nombre text; v_org text;
  v_or text;
  v_docs jsonb; v_ant jsonb; v_ca jsonb; v_recl jsonb; v_match jsonb := '[]'::jsonb;
  v_cid uuid;
begin
  if v_codigo = '' then return '{}'::jsonb; end if;

  select institucion_rut, nombre, institucion_nombre into v_rut, v_nombre, v_org
  from public.licitaciones_bi where codigo = v_codigo order by updated_at desc limit 1;
  if v_nombre is null then
    select organismo_rut, nombre, nombre_organismo into v_rut, v_nombre, v_org
    from public.compras_agiles where upper(codigo) = v_codigo limit 1;
  end if;

  select string_agg(w, ' or ') into v_or
  from (select distinct lower(w) w from regexp_split_to_table(regexp_replace(coalesce(v_nombre, ''), '[^[:alnum:] ]', ' ', 'g'), '\s+') w
        where length(w) > 3 and lower(w) not in ('para', 'según', 'segun', 'sobre', 'servicio', 'servicios', 'adquisicion', 'adquisición', 'compra', 'contratacion', 'contratación', 'licitacion', 'licitación', 'publica', 'pública', 'convenio', 'marco', 'suministro')
        limit 6) s;

  select coalesce(jsonb_agg(jsonb_build_object(
           'archivo', d.archivo, 'tipo', d.tipo, 'codigo_detectado', d.cod, 'subido', d.creado_en,
           'relacion', case when exists (select 1 from public.licitaciones_bi b where b.codigo = d.cod and b.institucion_rut = v_rut)
                            then 'antecedente_mismo_organismo' else 'otra_licitacion' end)), '[]'::jsonb)
  into v_docs
  from (
    select b.archivo, b.tipo, b.creado_en,
           position(v_codigo in upper(coalesce(b.archivo, '') || ' ' || left(coalesce(b.texto, ''), 6000))) > 0 as menciona_propio,
           (select m[1] from regexp_matches(upper(coalesce(b.archivo, '') || ' ' || left(coalesce(b.texto, ''), 6000)), '([0-9]{1,7}-[0-9]{1,6}-[A-Z]{1,3}[0-9]{2,3})', 'g') m
             where m[1] <> v_codigo limit 1) as cod
    from public.bases_licitacion b where b.codigo = v_codigo
  ) d
  where d.cod is not null and not d.menciona_propio;

  select coalesce(jsonb_agg(x order by x->>'fecha_publicacion' desc), '[]'::jsonb) into v_ant
  from (
    select jsonb_build_object(
      'codigo', b.codigo, 'nombre', b.nombre, 'estado', b.estado,
      'fecha_publicacion', b.fecha_publicacion::date, 'fecha_cierre', b.fecha_cierre::date,
      'presupuesto', b.presupuesto_estimado, 'moneda', b.moneda,
      'oferentes', b.raw_data->'Adjudicacion'->>'NumeroOferentes',
      'adjudicatarios', (select string_agg(distinct a #>> '{}', '; ')
                         from jsonb_array_elements(coalesce(jsonb_path_query_array(b.raw_data, '$.Items.Listado[*].Adjudicacion.NombreProveedor'), '[]'::jsonb)) a),
      'bases_cargadas', (select count(*) from public.bases_licitacion x where x.codigo = b.codigo),
      'reclamos', (select count(*) from public.reclamos_mp r where r.proceso_codigo = b.codigo)
    ) as x
    from public.licitaciones_bi b
    where v_rut is not null and b.institucion_rut = v_rut and b.codigo <> v_codigo
      and b.fecha_publicacion >= now() - interval '3 years'
      and to_tsvector('spanish', coalesce(b.nombre, '')) @@ websearch_to_tsquery('spanish', regexp_replace(coalesce(v_nombre, ''), '[^[:alnum:] ]', ' ', 'g'))
    order by b.fecha_publicacion desc limit 6
  ) s;

  -- Compras ágiles del mismo organismo sobre el mismo tema (180 días): posible fragmentación.
  -- upper(c.codigo) <> v_codigo (no c.codigo <> v_codigo): compras_agiles.codigo no
  -- siempre está en mayúsculas (el CSV se guarda tal cual), así que comparar sin
  -- normalizar dejaba pasar el self-match para esas filas.
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', c.codigo, 'nombre', c.nombre, 'estado', c.estado, 'monto', c.monto_estimado,
           'publicada', c.fecha_publicacion::date, 'cierra', c.fecha_cierre, 'unidad_compra', c.unidad_compra
         ) order by c.fecha_publicacion desc), '[]'::jsonb)
  into v_ca
  from (
    select * from public.compras_agiles c
    where v_or is not null
      and upper(c.codigo) <> v_codigo
      and (c.organismo_rut = v_rut or (v_org is not null and unaccent(lower(c.nombre_organismo)) = unaccent(lower(v_org))))
      and c.fecha_publicacion >= now() - interval '180 days'
      and to_tsvector('spanish', coalesce(c.nombre, '') || ' ' || coalesce(c.descripcion, '')) @@ websearch_to_tsquery('spanish', v_or)
    order by c.fecha_publicacion desc limit 8
  ) c;

  select jsonb_build_object(
    'total_12m', coalesce(sum(n), 0),
    'por_tipo', coalesce(jsonb_object_agg(tipo, n) filter (where tipo is not null), '{}'::jsonb),
    'ultimos', (select coalesce(jsonb_agg(jsonb_build_object('fecha', r.fecha, 'tipo', r.tipo, 'reclamante', r.reclamante, 'estado', r.estado, 'proceso', r.proceso_codigo) order by r.fecha desc), '[]'::jsonb)
                from (select * from public.reclamos_mp where organismo_rut = v_rut and fecha >= current_date - 365 order by fecha desc limit 5) r)
  ) into v_recl
  from (select tipo, count(*) n from public.reclamos_mp where v_rut is not null and organismo_rut = v_rut and fecha >= current_date - 365 group by tipo) t;

  if p_user_id is not null then
    select id into v_cid from public.clientes where user_id = p_user_id limit 1;
    if v_cid is not null then
      select coalesce(jsonb_agg(jsonb_build_object('pedido', left(m.nombre_solicitado, 80), 'cantidad', m.cantidad, 'tu_producto', left(m.nombre_producto, 80), 'sku', m.sku, 'precio', m.precio_unitario, 'score', round(m.score)) order by m.score desc), '[]'::jsonb)
      into v_match
      from (select * from public.lic_item_matches where licitacion_codigo = v_codigo and cliente_id = v_cid order by score desc limit 12) m;
    end if;
  end if;

  return jsonb_build_object(
    'codigo', v_codigo, 'organismo', v_org,
    'documentos_de_otra_licitacion', v_docs,
    'antecedentes', v_ant,
    'compras_agiles_relacionadas', v_ca,
    'reclamos_organismo', v_recl,
    'matches_cliente', v_match
  );
end;
$$;
