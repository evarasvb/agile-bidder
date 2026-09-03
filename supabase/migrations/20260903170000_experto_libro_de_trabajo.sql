-- Libro de trabajo por licitacion (pantalla tipo cuaderno): fuentes, chat y entregables del usuario.
create or replace function public.experto_libro(p_codigo text)
returns jsonb language sql stable security definer set search_path = public, experto as $$
  with f as (select public.experto_ficha_licitacion(upper(p_codigo)) ficha)
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
grant execute on function public.experto_libro(text) to authenticated;

create or replace function public.experto_mis_libros()
returns table (codigo text, nombre text, institucion text, cierre timestamptz, ultima timestamptz, consultas integer)
language sql stable security definer set search_path = public, experto as $$
  select c.licitacion, l.nombre, l.institucion_nombre, l.fecha_cierre, max(c.creado_en), count(*)::int
  from experto.consultas c left join public.licitaciones_bi l on l.codigo = c.licitacion
  where c.user_id = auth.uid() and c.licitacion is not null
  group by c.licitacion, l.nombre, l.institucion_nombre, l.fecha_cierre
  order by max(c.creado_en) desc limit 20;
$$;
grant execute on function public.experto_mis_libros() to authenticated;
