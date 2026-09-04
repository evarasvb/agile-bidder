-- Búsqueda de oportunidades por palabra exacta (prefijo), sin recorte de raíz.
-- Con el diccionario 'spanish', "toner" quedaba en 'ton' (traía toneladas, tonos)
-- y "resma" en 'resm' (traía Resmed). Con 'simple' + quitar_acentos se busca la
-- palabra tal cual escrita, más su plural/derivados por prefijo (resma => resmas).
-- Los índices GIN se reconstruyen porque dependen del cuerpo de tsv_oportunidad.

drop index if exists public.idx_licbi_busqueda;
drop index if exists public.idx_ca_busqueda;
drop index if exists public.idx_licbi_items_busqueda;
drop index if exists public.idx_ca_items_busqueda;

create or replace function public.tsv_oportunidad(a text, b text)
returns tsvector language sql immutable parallel safe
as $$ select to_tsvector('simple', public.quitar_acentos(coalesce(a,'') || ' ' || coalesce(b,''))) $$;

-- Palabras de relleno que 'spanish' descartaba solo y 'simple' no.
create or replace function public.tsq_oportunidad(texto text)
returns tsquery language sql immutable parallel safe
as $$
  select case
    when coalesce(string_agg(w, ' & '), '') = '' then null
    else to_tsquery('simple', string_agg(w, ' & '))
  end
  from (
    select public.quitar_acentos(lower(w)) || ':*' as w
    from regexp_split_to_table(regexp_replace(coalesce(texto,''), '[^[:alnum:]áéíóúñÁÉÍÓÚÑ ]+', ' ', 'g'), '\s+') w
    where length(w) >= 2
      and lower(public.quitar_acentos(w)) not in
        ('de','del','la','el','lo','los','las','y','o','u','en','para','con','sin','un','una','unos','unas','por','al','a','e','se','su','sus')
  ) p
$$;

create index if not exists idx_licbi_busqueda
  on public.licitaciones_bi using gin (public.tsv_oportunidad(nombre, descripcion));
create index if not exists idx_ca_busqueda
  on public.compras_agiles using gin (public.tsv_oportunidad(nombre, descripcion));
create index if not exists idx_licbi_items_busqueda
  on public.licitaciones_bi_items using gin (public.tsv_oportunidad(nombre_producto, descripcion));
create index if not exists idx_ca_items_busqueda
  on public.compras_agiles_items using gin (public.tsv_oportunidad(nombre_producto, descripcion_producto));
