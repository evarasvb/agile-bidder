-- Regla de Evaristo: las "Noticias de tus instituciones" del dashboard deben
-- venir SOLO de las instituciones que el cliente sigue (cliente_instituciones_seguidas).
-- Si no sigue ninguna, no se muestran noticias.
--
-- Antes esta RPC deducía las instituciones de la ACTIVIDAD del cliente
-- (cliente_ofertas, lic_item_matches, ca_matches) y buscaba en la base global de
-- prensa del Experto (experto.fragmentos). Resultado: aparecían noticias de
-- organismos que el cliente no sigue, e incluso prensa sin relación ("de
-- cualquier parte del planeta"). La campanita (medio_institucion) ya filtraba por
-- seguidas; esta fila del dashboard no. Se alinea con la campanita.
create or replace function public.cliente_noticias_instituciones(p_max_instituciones integer default 5, p_por_institucion integer default 3)
returns table (
  institucion text, noticia_id bigint, fuente text, seccion text, url text, texto text, fecha timestamptz
)
language plpgsql
stable
security definer
set search_path = public, experto
as $$
declare
  v_cid uuid := public.cliente_owner_id();
begin
  if v_cid is null then
    return;
  end if;

  return query
  with candidatas as (
    -- Solo instituciones SEGUIDAS explícitamente por el cliente (o por el
    -- vendedor invitado). Sin seguidas => sin noticias.
    select s.nombre_institucion as institucion, max(s.created_at) as ultima
    from public.cliente_instituciones_seguidas s
    where (s.cliente_id = v_cid or s.cliente_id = auth.uid())
      and s.nombre_institucion is not null
      and length(btrim(s.nombre_institucion)) > 2
    group by s.nombre_institucion
  ),
  noticias as (
    select c.institucion, c.ultima, f.id, f.fuente, f.seccion, f.url, f.texto, f.creado_en
    from candidatas c
    cross join lateral (
      select fr.id, fr.fuente, fr.seccion, fr.url, fr.texto, fr.creado_en
      from experto.fragmentos fr
      where fr.fuente like 'Noticia:%'
        and fr.tsv @@ websearch_to_tsquery('spanish', c.institucion)
        and fr.creado_en > now() - interval '120 days'
      order by ts_rank_cd(fr.tsv, websearch_to_tsquery('spanish', c.institucion)) desc, fr.creado_en desc
      limit greatest(1, least(p_por_institucion, 5))
    ) f
  ),
  top_instituciones as (
    select distinct institucion, ultima
    from noticias
    order by ultima desc nulls last, institucion
    limit greatest(1, least(p_max_instituciones, 20))
  )
  select n.institucion, n.id, n.fuente, n.seccion, n.url, n.texto, n.creado_en
  from noticias n
  join top_instituciones ti using (institucion)
  order by ti.ultima desc nulls last, n.creado_en desc;
end;
$$;

revoke all on function public.cliente_noticias_instituciones(integer, integer) from public, anon;
grant execute on function public.cliente_noticias_instituciones(integer, integer) to authenticated;
