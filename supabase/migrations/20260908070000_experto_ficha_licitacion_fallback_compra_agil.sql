-- El chat del Experto y TODOS sus entregables (informe, anexos, matriz, mapa,
-- estudio, bajo el agua, pptx) llaman a experto_ficha_licitacion(codigo) para
-- traer la ficha del proceso. Esa función solo buscaba en licitaciones_bi, así
-- que para el código de una compra ágil (sufijo COT) siempre volvía vacía y el
-- Experto quedaba sin antecedentes aunque el frontend sí mandaba el código
-- ("no tengo antecedentes de eso, ¿qué me estás preguntando?").
--
-- experto_libro() (la pestaña "Fuentes") ya resolvía esto con un fallback a
-- compras_agiles cuando no encontraba la licitación; se traslada exactamente
-- esa misma lógica a experto_ficha_licitacion para que la hereden todos los
-- flujos que la llaman, no solo la ficha visible en pantalla.
create or replace function public.experto_ficha_licitacion(p_codigo text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with l as (select * from public.licitaciones_bi where codigo = p_codigo order by updated_at desc limit 1),
  items as (
    select jsonb_agg(jsonb_build_object('n', correlativo, 'producto', nombre_producto, 'descripcion', left(descripcion, 300), 'cantidad', cantidad, 'unidad', unidad, 'categoria', categoria) order by correlativo) j
    from public.licitaciones_bi_items where licitacion_id = (select id from l)),
  raw_items as (
    select jsonb_agg(jsonb_build_object('producto', it->>'NombreProducto', 'descripcion', left(it->>'Descripcion',300), 'cantidad', it->>'Cantidad', 'unidad', it->>'UnidadMedida', 'categoria', it->>'Categoria')) j
    from l, jsonb_array_elements(coalesce(l.raw_data->'Items'->'Listado','[]'::jsonb)) it),
  org as (select to_jsonb(o) j from public.experto_organismo((select institucion_nombre from l)) o),
  comp as (
    select jsonb_agg(to_jsonb(c)) j from (
      select * from public.experto_competencia_licitacion((select codigo from l), 12, 6)) c),
  hist as (
    select jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', nombre, 'estado', estado, 'publicada', fecha_publicacion::date, 'presupuesto', presupuesto_estimado) order by fecha_publicacion desc) j
    from (select * from public.licitaciones_bi b where b.institucion_rut = (select institucion_rut from l) and b.codigo <> p_codigo
          and to_tsvector('spanish', coalesce(b.nombre,'')) @@ websearch_to_tsquery('spanish', (select regexp_replace(nombre, '[^[:alnum:] ]', ' ', 'g') from l))
          order by fecha_publicacion desc limit 5) h),
  ficha_licitacion as (
    select jsonb_build_object(
      'codigo', l.codigo, 'nombre', l.nombre, 'descripcion', l.descripcion, 'estado', l.estado, 'tipo', l.tipo,
      'institucion', l.institucion_nombre, 'rut_institucion', l.institucion_rut, 'unidad_compra', l.unidad_compra,
      'region', l.unidad_compra_region, 'comuna', l.unidad_compra_comuna,
      'presupuesto', l.presupuesto_estimado, 'moneda', l.moneda, 'etapas', l.etapas,
      'fecha_publicacion', l.fecha_publicacion, 'fecha_cierre', l.fecha_cierre, 'fecha_cierre_documentos', l.fecha_cierre_documentos, 'fecha_adjudicacion', l.fecha_adjudicacion,
      'fechas_api', l.raw_data->'Fechas', 'modalidad', l.raw_data->>'Modalidad', 'tipo_pago', l.raw_data->>'TipoPago',
      'duracion_contrato', concat_ws(' ', l.raw_data->>'TiempoDuracionContrato', l.raw_data->>'UnidadTiempoDuracionContrato'),
      'fuente_financiamiento', l.raw_data->>'FuenteFinanciamiento', 'direccion_entrega', l.raw_data->>'DireccionEntrega',
      'justificacion_monto', l.raw_data->>'JustificacionMontoEstimado', 'es_base_tipo', l.raw_data->>'EsBaseTipo',
      'responsable_contrato', l.raw_data->>'NombreResponsableContrato', 'adjudicacion', l.raw_data->'Adjudicacion',
      'url', 'https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion=' || l.codigo,
      'items', coalesce((select j from items), (select j from raw_items), '[]'::jsonb),
      'organismo', (select j from org),
      'competencia', (select j from comp),
      'licitaciones_similares_del_organismo', (select j from hist)
    ) j
    from l
  ),
  ca as (select * from public.compras_agiles where upper(codigo) = upper(p_codigo) limit 1),
  ficha_compra_agil as (
    select jsonb_build_object(
      'codigo', ca.codigo, 'nombre', ca.nombre, 'institucion', ca.nombre_organismo, 'tipo', 'Compra Ágil',
      'presupuesto', ca.monto_estimado, 'moneda', ca.moneda, 'estado', ca.estado, 'region', ca.region,
      'fecha_publicacion', ca.fecha_publicacion, 'fecha_cierre', ca.fecha_cierre, 'descripcion', ca.descripcion,
      'url', coalesce(ca.url_ficha, 'https://www.mercadopublico.cl/CompraAgil/Modules/CA/DetallesCompraAgil.aspx?codigo=' || ca.codigo),
      'rut_institucion', ca.organismo_rut,
      'organismo', (select to_jsonb(o) from public.experto_organismo(coalesce(ca.organismo_rut, ca.nombre_organismo)) o limit 1),
      'items', (select coalesce(jsonb_agg(jsonb_build_object('producto', i.nombre_producto, 'cantidad', i.cantidad, 'unidad', i.unidad, 'descripcion', i.descripcion_producto)), '[]'::jsonb)
                from public.compras_agiles_items i where i.compra_agil_id = ca.id)
    ) j
    from ca
  )
  select coalesce((select j from ficha_licitacion), (select j from ficha_compra_agil));
$function$;
