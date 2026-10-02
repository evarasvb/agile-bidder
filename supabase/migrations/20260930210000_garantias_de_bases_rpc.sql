-- Detección de garantía en la ficha de licitación.
-- La garantía ya viene extraída de las bases por el Experto y guardada en
-- bases_licitacion.resumen->'garantias' ({seriedad, fiel_cumplimiento} en texto).
-- Ese texto es información pública de la licitación (no es inteligencia premium),
-- así que se expone a usuarios logueados mediante un RPC de solo lectura acotado
-- a ese subconjunto. No toca la tabla bases_licitacion (que sigue solo service_role).
create or replace function public.garantias_de_bases(p_codigo text)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.resumen -> 'garantias'
  from public.bases_licitacion b
  where b.codigo = p_codigo
    and b.resumen is not null
    and b.resumen ? 'garantias'
  order by
    ((b.resumen -> 'garantias' ->> 'seriedad') is not null
      or (b.resumen -> 'garantias' ->> 'fiel_cumplimiento') is not null) desc,
    (b.tipo = 'bases') desc nulls last
  limit 1;
$$;

revoke execute on function public.garantias_de_bases(text) from public, anon;
grant execute on function public.garantias_de_bases(text) to authenticated, service_role;
