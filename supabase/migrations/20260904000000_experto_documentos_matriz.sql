-- Documentos de trabajo del usuario (Excel, Word, PDF) por licitación, matriz de postulación y
-- corrección: los estudios profundos quedaban guardados como 'informe' y pisaban el informe del libro.
update experto.consultas set modo = 'estudio' where modo = 'informe' and pregunta like 'estudio profundo%';

create table if not exists experto.documentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  codigo text,
  nombre text not null,
  tipo text not null,
  storage_path text,
  texto text not null default '',
  caracteres integer not null default 0,
  creado_en timestamptz not null default now()
);
create index if not exists documentos_user_codigo_idx on experto.documentos (user_id, upper(codigo), creado_en desc);
alter table experto.documentos enable row level security;

insert into storage.buckets (id, name, public) values ('documentos-trabajo', 'documentos-trabajo', false) on conflict (id) do nothing;

-- Texto de los documentos del usuario para el contexto del Experto (solo service_role).
create or replace function public.experto_documentos_texto(p_user_id uuid, p_codigo text, p_max integer default 12000)
returns table(id uuid, nombre text, tipo text, texto text, creado_en timestamptz)
language sql stable security definer set search_path to 'public', 'experto' as $$
  with n as (select count(*)::int as c from experto.documentos x where x.user_id = p_user_id and (upper(x.codigo) = upper(p_codigo) or (p_codigo is null and x.codigo is null)))
  select d.id, d.nombre, d.tipo, left(d.texto, greatest(1500, p_max / greatest(1, n.c))), d.creado_en
  from experto.documentos d, n
  where d.user_id = p_user_id and (upper(d.codigo) = upper(p_codigo) or (p_codigo is null and d.codigo is null))
  order by d.creado_en desc limit 8;
$$;
revoke all on function public.experto_documentos_texto(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.experto_documentos_texto(uuid, text, integer) to service_role;

-- La matriz de postulación editada en pantalla se guarda como nueva versión (modo 'matriz').
create or replace function public.experto_matriz_guardar(p_codigo text, p_matriz jsonb)
returns void language sql security definer set search_path to 'public', 'experto' as $$
  insert into experto.consultas (user_id, huella, modo, pregunta, respuesta, fuentes, licitacion, ms)
  select auth.uid(), 'libro', 'matriz', 'matriz ' || upper(p_codigo), p_matriz::text, '[]'::jsonb, upper(p_codigo), 0 where auth.uid() is not null;
$$;
grant execute on function public.experto_matriz_guardar(text, jsonb) to authenticated;

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
    'mapa', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'mapa' order by c.creado_en desc limit 1),
    'matriz', (select jsonb_build_object('texto', c.respuesta, 'creado_en', c.creado_en) from experto.consultas c where c.user_id = auth.uid() and upper(c.licitacion) = upper(p_codigo) and c.modo = 'matriz' order by c.creado_en desc limit 1),
    'anexos', (select jsonb_build_object('texto', a.contenido, 'faltantes', a.faltantes, 'creado_en', a.creado_en) from public.experto_anexos a where a.user_id = auth.uid() and upper(a.codigo) = upper(p_codigo) order by a.creado_en desc limit 1),
    'plan', public.experto_mi_plan()
  );
$function$;
