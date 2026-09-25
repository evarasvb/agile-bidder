-- Vista de contactos del Estado (seguimiento 1-a-1) capturados desde el correo.
-- Clasifica cada contacto por BLOQUE (Salud, Gobierno, Municipalidad, Educación,
-- Otros) a partir de la empresa/dominio, para gestionarlos por sector.
create or replace function public.fundador_contactos_estado(
  p_sector text default null, p_buscar text default null
)
returns table(
  id uuid, nombre text, email text, empresa text, dominio text,
  sector text, estado text, creado_en timestamptz
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return; end if;
  return query
  with base as (
    select mc.id, mc.nombre, mc.email, mc.empresa,
           mc.campos_adicionales->>'dominio' as dominio,
           mc.estado_contacto, mc.creado_en,
           case
             when coalesce(mc.empresa,'') || ' ' || coalesce(mc.campos_adicionales->>'dominio','')
                  ~* '(salud|redsalud|hospital|hegc|cesfam|consultorio|fonasa|hsp|hcsba|hls|hsjm)' then 'Salud'
             when coalesce(mc.empresa,'') || ' ' || coalesce(mc.campos_adicionales->>'dominio','')
                  ~* '(municipal|munic|\.muni|i\. munic)' then 'Municipalidad'
             when coalesce(mc.empresa,'') || ' ' || coalesce(mc.campos_adicionales->>'dominio','')
                  ~* '(universidad|liceo|escuela|educac|colegio|jardin|junaeb|junji)' then 'Educación'
             when coalesce(mc.empresa,'') || ' ' || coalesce(mc.campos_adicionales->>'dominio','')
                  ~* '(ministerio|servicio|superint|senama|sbap|sag|direccion|subsecretar|gobierno|intendencia|seremi|minrel|pensiones|\.gob\.cl|\.gov)' then 'Gobierno'
             else 'Otros'
           end as sector
    from public.marketing_contactos mc
    where 'seguimiento_1a1' = any(mc.etiquetas)
  )
  select b.id, b.nombre, b.email, b.empresa, b.dominio, b.sector, b.estado_contacto, b.creado_en
  from base b
  where (p_sector is null or p_sector = '' or p_sector = 'Todos' or b.sector = p_sector)
    and (p_buscar is null or p_buscar = ''
         or b.nombre ilike '%'||p_buscar||'%' or b.email ilike '%'||p_buscar||'%' or b.empresa ilike '%'||p_buscar||'%')
  order by b.sector, b.empresa, b.nombre;
end; $$;

revoke all on function public.fundador_contactos_estado(text, text) from public, anon;
grant execute on function public.fundador_contactos_estado(text, text) to authenticated;
