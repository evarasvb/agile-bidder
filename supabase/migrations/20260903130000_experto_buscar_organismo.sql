-- Encuentra el organismo aunque las palabras vengan en otro orden
-- ("puerto montt municipalidad" -> I. MUNICIPALIDAD DE PUERTO MONTT). Devuelve el RUT
-- para llamar a experto_organismo, que hoy solo busca por subcadena exacta.
create or replace function public.experto_buscar_organismo(p_texto text)
returns text language sql stable security definer set search_path = public, extensions as $$
  with pal as (
    select array_agg(w) ws from (
      select w from regexp_split_to_table(unaccent(lower(coalesce(p_texto, ''))), '\s+') w
      where length(w) > 2 and w not in ('ilustre','los','las','del','para','con')) t)
  select i.rut from public.instituciones i, pal
  where i.rut = p_texto
     or unaccent(lower(i.nombre)) like '%' || unaccent(lower(p_texto)) || '%'
     or (pal.ws is not null and cardinality(pal.ws) > 0
         and (select bool_and(unaccent(lower(i.nombre)) like '%' || w || '%') from unnest(pal.ws) w))
  order by (unaccent(lower(i.nombre)) like '%' || unaccent(lower(p_texto)) || '%') desc,
           (i.pago_actualizado_el is not null) desc, i.oc_monto_total desc nulls last, length(i.nombre)
  limit 1;
$$;
revoke all on function public.experto_buscar_organismo(text) from public, anon, authenticated;
grant execute on function public.experto_buscar_organismo(text) to service_role;
