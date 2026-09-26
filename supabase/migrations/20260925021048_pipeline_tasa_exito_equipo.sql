-- Tasa de éxito del pipeline a nivel EMPRESA (dueño + vendedores/miembros de
-- equipo activos que le pertenecen), no del usuario que llama. Necesario
-- porque oportunidad_veredictos es una fila compartida por cliente_owner_id():
-- si se usa el pipeline de auth.uid() (RLS: solo ve sus propias filas), el
-- dueño y un vendedor invitado calculan tasas de éxito distintas para el
-- mismo veredicto, y el último en generar pisa el número del otro con el
-- suyo. Security definer para poder leer el pipeline de todo el equipo sin
-- reimplementar la RLS acá.
create or replace function public.pipeline_tasa_exito_equipo()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  with equipo as (
    select coalesce(
      (
        select v.invitado_por
        from public.vendedores v
        where v.user_id = auth.uid() and v.activo is true and v.invitado_por is not null
        order by v.updated_at desc nulls last
        limit 1
      ),
      auth.uid()
    ) as owner_user_id
  ),
  miembros as (
    select owner_user_id as user_id from equipo
    union
    select v.user_id from public.vendedores v join equipo e on v.invitado_por = e.owner_user_id where v.activo is true
  ),
  filas as (
    select p.etapa
    from public.pipeline p
    join miembros m on m.user_id = p.user_id
    where p.etapa in ('adjudicada', 'oc_emitida', 'pagada', 'perdida')
  )
  select case when count(*) >= 3 then round(100.0 * count(*) filter (where etapa <> 'perdida') / count(*))::integer else null end
  from filas;
$function$;

revoke execute on function public.pipeline_tasa_exito_equipo() from public, anon;
grant execute on function public.pipeline_tasa_exito_equipo() to authenticated;
