-- Búsqueda de oportunidades DENTRO de los ítems (licitaciones y compras ágiles).
-- Antes el panel bajaba 500 filas al navegador y buscaba por título: una
-- licitación con "resma" en su lista de productos nunca aparecía. Ahora la
-- búsqueda corre en el servidor con índices de texto completo (español, sin
-- acentos, con prefijos) sobre título, descripción y cada ítem.

create extension if not exists unaccent;

-- unaccent() no es inmutable; envoltorio para poder indexar.
create or replace function public.quitar_acentos(t text)
returns text language sql immutable parallel safe strict
as $$ select public.unaccent('public.unaccent', t) $$;

create or replace function public.tsv_oportunidad(a text, b text)
returns tsvector language sql immutable parallel safe
as $$ select to_tsvector('spanish', public.quitar_acentos(coalesce(a,'') || ' ' || coalesce(b,''))) $$;

-- Convierte lo que escribe el usuario en una consulta: cada palabra con prefijo
-- y todas obligatorias ("papel electro" => papel:* & electro:*).
create or replace function public.tsq_oportunidad(texto text)
returns tsquery language sql immutable parallel safe
as $$
  select case
    when coalesce(string_agg(w, ' & '), '') = '' then null
    else to_tsquery('spanish', string_agg(w, ' & '))
  end
  from (
    select public.quitar_acentos(lower(w)) || ':*' as w
    from regexp_split_to_table(regexp_replace(coalesce(texto,''), '[^[:alnum:]áéíóúñÁÉÍÓÚÑ ]+', ' ', 'g'), '\s+') w
    where length(w) >= 2
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

-- Organismo y código se buscan por trigramas (ilike '%texto%' con índice):
-- sin esto, recorrer 55.000 licitaciones del semestre tardaba 1,6 s.
create index if not exists idx_licbi_institucion_trgm
  on public.licitaciones_bi using gin (institucion_nombre gin_trgm_ops);
create index if not exists idx_licbi_codigo_trgm
  on public.licitaciones_bi using gin (codigo gin_trgm_ops);
create index if not exists idx_ca_organismo_trgm
  on public.compras_agiles using gin (nombre_organismo gin_trgm_ops);
create index if not exists idx_ca_codigo_trgm
  on public.compras_agiles using gin (codigo gin_trgm_ops);

-- Devuelve los códigos que coinciden por título, descripción, código, organismo
-- o CUALQUIER ítem, con el ítem que calzó como "coincidencia". Cada rama va
-- separada (UNION) para que use su propio índice; la relevancia es fija por
-- rama (título 1, ítem 0.6, organismo/código 0.3) y el ítem coincidente sale
-- de la misma rama de ítems (recalcular el tsvector fila por fila tardaba
-- entre 3 y 6 s con cerradas).
create or replace function public.buscar_oportunidades(
  p_texto text,
  p_incluir_cerradas boolean default false,
  p_limite int default 300
)
returns table (tipo text, codigo text, coincidencia text, relevancia real)
language plpgsql stable security definer
set search_path = public
as $$
declare
  q tsquery := public.tsq_oportunidad(p_texto);
  patron text := '%' || trim(coalesce(p_texto,'')) || '%';
  -- Con cerradas se mira solo el último medio año (el panel muestra las más
  -- recientes de todas formas).
  desde timestamptz := case when p_incluir_cerradas then now() - interval '180 days' else now() end;
begin
  if q is null then return; end if;
  return query
  with lic as (
    select l.codigo, l.fecha_publicacion as fp, 1.0::real as r, null::text as coincidencia
    from licitaciones_bi l
    where l.fecha_cierre > desde
      and public.tsv_oportunidad(l.nombre, l.descripcion) @@ q
    union all
    select l.codigo, l.fecha_publicacion, 0.3, null
    from licitaciones_bi l
    where l.fecha_cierre > desde
      and (l.institucion_nombre ilike patron or l.codigo ilike patron)
    union all
    select l.codigo, l.fecha_publicacion, 0.6,
           case when public.tsv_oportunidad(i.descripcion, null) @@ q
                then left(i.descripcion, 140) else i.nombre_producto end
    from licitaciones_bi_items i
    join licitaciones_bi l on l.id = i.licitacion_id
    where public.tsv_oportunidad(i.nombre_producto, i.descripcion) @@ q
      and l.fecha_cierre > desde
  ),
  ca as (
    select c.codigo, c.created_at as fp, 1.0::real as r, null::text as coincidencia
    from compras_agiles c
    where c.fecha_cierre > desde
      and public.tsv_oportunidad(c.nombre, c.descripcion) @@ q
    union all
    select c.codigo, c.created_at, 0.3, null
    from compras_agiles c
    where c.fecha_cierre > desde
      and (c.nombre_organismo ilike patron or c.codigo ilike patron)
    union all
    select c.codigo, c.created_at, 0.6,
           case when public.tsv_oportunidad(i.descripcion_producto, null) @@ q
                then left(i.descripcion_producto, 140) else i.nombre_producto end
    from compras_agiles_items i
    join compras_agiles c on c.id = i.compra_agil_id
    where public.tsv_oportunidad(i.nombre_producto, i.descripcion_producto) @@ q
      and c.fecha_cierre > desde
  ),
  todo as (
    select 'licitacion'::text as tipo, x.codigo, max(x.r) as r, max(x.fp) as fp,
           (array_agg(x.coincidencia) filter (where x.coincidencia is not null))[1] as coincidencia
    from lic x group by x.codigo
    union all
    select 'compra_agil', x.codigo, max(x.r), max(x.fp),
           (array_agg(x.coincidencia) filter (where x.coincidencia is not null))[1]
    from ca x group by x.codigo
  )
  select t.tipo, t.codigo, t.coincidencia, t.r
  from todo t
  order by t.r desc nulls last, t.fp desc nulls last
  limit greatest(1, least(p_limite, 1000));
end $$;

revoke all on function public.buscar_oportunidades(text, boolean, int) from public, anon;
grant execute on function public.buscar_oportunidades(text, boolean, int) to authenticated, service_role;
