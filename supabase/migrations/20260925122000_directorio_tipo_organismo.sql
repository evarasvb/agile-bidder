-- Clasifica cada organismo por TIPO derivado del nombre (Municipalidad, Salud,
-- Educación, Gobierno, Otros) y agrega el filtro p_tipo al directorio.
drop function if exists public.fundador_directorio_compradores(text, integer);
create or replace function public.fundador_directorio_compradores(
  p_buscar text default null, p_limite integer default 500, p_tipo text default null
)
returns table(
  institucion text, rut text, region text, tipo text,
  n_oc bigint, monto_total numeric, ultima_compra timestamptz,
  n_correos bigint, n_encargados bigint, encargados text,
  tiene_contacto boolean, consentimiento boolean
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return; end if;
  return query
  with base as (
    select m.institucion, m.rut, i.region, m.n_oc, m.monto_total, m.ultima_compra,
      case
        when m.institucion ilike '%municipal%' then 'Municipalidad'
        when m.institucion ilike '%hospital%' or m.institucion ilike '%salud%'
          or m.institucion ilike '%cesfam%' or m.institucion ilike '%consultorio%' then 'Salud'
        when m.institucion ilike '%universidad%' or m.institucion ilike '%liceo%'
          or m.institucion ilike '%escuela%' or m.institucion ilike '%educac%'
          or m.institucion ilike '%jardin%' or m.institucion ilike '%colegio%' then 'Educación'
        when m.institucion ilike '%ministerio%' or m.institucion ilike '%servicio%'
          or m.institucion ilike '%direccion%' or m.institucion ilike '%subsecretar%'
          or m.institucion ilike '%gobierno%' or m.institucion ilike '%intendencia%'
          or m.institucion ilike '%seremi%' then 'Gobierno'
        else 'Otros'
      end as tipo
    from public.mv_compradores_publicos m
    left join public.instituciones i on i.rut = m.rut
  )
  select coalesce(b.institucion,'(sin nombre)'), b.rut, b.region, b.tipo,
         b.n_oc, b.monto_total, b.ultima_compra,
         coalesce(mc.n_correos,0), coalesce(en.n_enc,0), en.nombres,
         coalesce(mc.n_correos,0) > 0, coalesce(mc.consiente,false)
  from base b
  left join lateral (
    select count(*) filter (where coalesce(email,'') <> '') n_correos,
           bool_or(coalesce(consentimiento_marketing,false)) consiente
    from public.marketing_contactos
    where origen='comprador_publico' and campos_adicionales->>'rut_organismo' = b.rut
  ) mc on true
  left join lateral (
    select count(*) n_enc, string_agg(nombre, ', ' order by nombre) nombres
    from public.compradores_encargados where rut_organismo = b.rut
  ) en on true
  where (p_buscar is null or p_buscar = '' or b.institucion ilike '%'||p_buscar||'%' or b.rut ilike '%'||p_buscar||'%')
    and (p_tipo is null or p_tipo = '' or p_tipo = 'Todos' or b.tipo = p_tipo)
  order by b.monto_total desc nulls last
  limit greatest(coalesce(p_limite,500),1);
end; $$;

revoke all on function public.fundador_directorio_compradores(text, integer, text) from public, anon;
grant execute on function public.fundador_directorio_compradores(text, integer, text) to authenticated;
