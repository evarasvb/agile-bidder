-- Arreglo: en compras ágiles (u otros tipos) la búsqueda por 'tipo' no calzaba con ninguna ley
-- y la sección "Leyes aplicables" del libro salía vacía. Las 5 leyes base aplican siempre, así que
-- si la búsqueda no encuentra ninguna ley, se muestran igual (ordenadas por fecha).
create or replace function public.experto_leyes(consulta text, cantidad integer default 3)
returns table (id bigint, fuente text, seccion text, url text, texto text, fecha timestamptz, relevancia real)
language sql stable security definer set search_path = public, experto as $$
  with q as (select websearch_to_tsquery('spanish', consulta) as tq)
  select f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en, ts_rank_cd(f.tsv, q.tq) as relevancia
  from experto.fragmentos f, q
  where f.fuente like 'Ley:%'
    and (
      f.tsv @@ q.tq
      -- Si ninguna ley calza con la búsqueda, mostrar todas (aplican de forma general).
      or not exists (select 1 from experto.fragmentos g, q qq where g.fuente like 'Ley:%' and g.tsv @@ qq.tq)
    )
  order by relevancia desc, f.creado_en desc
  limit least(cantidad, 6);
$$;
grant execute on function public.experto_leyes(text, integer) to authenticated, service_role;
