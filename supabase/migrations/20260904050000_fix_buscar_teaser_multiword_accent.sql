-- Auditoría comparativa firmavb vs Mercado Público: la búsqueda pública del
-- landing (buscar_teaser_licitaciones) exigía que TODO el término tipeado
-- apareciera como substring literal y contiguo, sin normalizar tildes.
-- Verificado con datos reales: "arriendo" solo = 169, "vehiculos" solo = 33,
-- pero "arriendo vehiculos" juntos = 0. "informática" = 14 pero "informatica"
-- (sin tilde, lo más común al escribir rápido) = 3. Cualquier búsqueda de más
-- de una palabra, o sin tilde, perdía casi todos los resultados reales.
--
-- Ahora exige cada palabra por separado (AND), sin importar dónde aparezca
-- ni el orden, y compara sin tildes (unaccent) en ambos lados.
create or replace function public.buscar_teaser_licitaciones(termino text, limite integer default 6)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with palabras as (
    select distinct lower(unaccent(w)) as palabra
    from regexp_split_to_table(btrim(termino), '\s+') as w
    where btrim(w) <> ''
  ),
  base as (
    select codigo, nombre, institucion_nombre, unidad_compra_region,
           presupuesto_estimado, moneda, fecha_cierre
    from public.licitaciones_bi l
    where estado = 'Publicada'
      and codigo_estado = 5
      and fecha_cierre > now()
      and exists (select 1 from palabras)
      and not exists (
        select 1 from palabras p
        where not (
          lower(unaccent(l.nombre)) like '%' || p.palabra || '%'
          or lower(unaccent(coalesce(l.descripcion, ''))) like '%' || p.palabra || '%'
        )
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'items', coalesce((
      select jsonb_agg(t)
      from (
        select * from base
        order by fecha_cierre asc
        limit greatest(1, least(coalesce(limite, 6), 12))
      ) t
    ), '[]'::jsonb)
  );
$function$;
