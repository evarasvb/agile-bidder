-- El libro de trabajo tambien abre compras agiles (ficha ligera desde compras_agiles).
-- Aplicado en prod como experto_libro_compras_agiles.
create or replace function public.experto_libro(p_codigo text)
returns jsonb language sql stable security definer set search_path = public, experto as $$
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
    'top_adjudicatarios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from f, lateral public.experto_top_adjudicatarios(f.ficha->'organismo'->>'rut', 12, 6) t where f.ficha->'organismo'->>'rut' is not null),
    'chat', (select coalesce(jsonb_agg(jsonb_build_object('pregunta', c.pregunta, 'respuesta', c.respuesta, 'creado_en', c.creado_en) order by c.creado_en), '[]'::jsonb)
             from (select * from experto.consultas where user_id = auth.uid() and upper(licitacion) = upper(p_codigo) and modo = 'chat' order by creado_en desc limit 30) c),
    'informe', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'informe' order by c.creado_en desc limit 1),
    'estudio', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'estudio' order by c.creado_en desc limit 1),
    'anexos', (select jsonb_build_object('texto', a.contenido, 'faltantes', a.faltantes, 'creado_en', a.creado_en) from public.experto_anexos a where a.user_id = auth.uid() and upper(a.codigo) = upper(p_codigo) order by a.creado_en desc limit 1),
    'plan', public.experto_mi_plan()
  );
$$;
