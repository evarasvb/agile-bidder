-- Hallazgo de Codex en la PR del onboarding "Tu empresa": las columnas nuevas
-- de clientes y la función perfil_por_rut que usa supabase/functions/perfil-empresa-ia
-- se habían aplicado a mano en producción, pero no quedaron en ninguna migración
-- del repo. Un ambiente nuevo (local, staging, o esta misma base recreada desde
-- cero) quedaría sin ellas: el onboarding fallaría con "columna desconocida" y,
-- como OnboardingGate redirige a cualquier cliente sin terminos_aceptados_at,
-- el cliente quedaría atrapado en el onboarding sin poder salir. Esta migración
-- deja ambas cosas en el repo (create/alter ... if not exists / or replace, así
-- que en producción, donde ya existen, no cambia nada).

alter table public.clientes add column if not exists descripcion_empresa text;
alter table public.clientes add column if not exists terminos_aceptados_at timestamptz;
alter table public.clientes add column if not exists terminos_version text;

-- Perfil real de ventas al Estado por RUT (o por rubro, si aún no vende): lo usa
-- perfil-empresa-ia para armar palabras clave e industrias con datos reales de
-- oc_lineas en vez de solo la descripción que escribe el cliente. Definición
-- verbatim de la que ya corre en producción.
create or replace function public.perfil_por_rut(p_rut text, p_rubro text default null::text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_rut text := upper(regexp_replace(coalesce(p_rut,''), '[^0-9kK]', '', 'g'));
  v_vende boolean;
  v_rubro text;
  v_res jsonb;
begin
  select exists (
    select 1 from oc_lineas
    where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut
  ) into v_vende;

  if v_vende then
    select rubro_n1 into v_rubro
    from oc_lineas
    where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut
    group by rubro_n1 order by sum(monto_linea) desc nulls last limit 1;

    select jsonb_build_object(
      'rut', p_rut,
      'vende_al_estado', true,
      'nombre', (select proveedor_nombre from oc_lineas
                 where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut
                 group by 1 order by count(*) desc limit 1),
      'rubro_principal', v_rubro,
      'resumen', (select jsonb_build_object(
                    'lineas', count(*),
                    'monto_total', round(sum(monto_linea)),
                    'primera_venta', min(fecha)::date,
                    'ultima_venta', max(fecha)::date,
                    'organismos_distintos', count(distinct rut_organismo))
                  from oc_lineas
                  where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut),
      'top_organismos', (select coalesce(jsonb_agg(t),'[]') from (
                    select organismo, rut_organismo, count(*) lineas,
                           round(sum(monto_linea)) monto, max(fecha)::date ultima
                    from oc_lineas
                    where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut
                    group by 1,2 order by monto desc nulls last limit 10) t),
      'top_productos', (select coalesce(jsonb_agg(t),'[]') from (
                    select producto, categoria, count(*) lineas, round(sum(monto_linea)) monto
                    from oc_lineas
                    where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut
                    group by 1,2 order by monto desc nulls last limit 15) t),
      'keywords_sugeridas', (select coalesce(jsonb_agg(k),'[]') from (
                    select lower(w) k
                    from oc_lineas,
                         regexp_split_to_table(coalesce(producto,'')||' '||coalesce(categoria,''), '[^[:alnum:]áéíóúñ]+') w
                    where upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) = v_rut
                      and length(w) >= 4
                      and lower(w) not in ('para','unidad','unidades','otros','otras','servicio','servicios','producto','productos','compra','general','tipo','según','segun','marca')
                    group by 1 order by count(*) desc limit 20) s),
      'competidores', (select coalesce(jsonb_agg(t),'[]') from (
                    select proveedor_nombre, rut_proveedor, round(sum(monto_linea)) monto
                    from oc_lineas
                    where rubro_n1 = v_rubro
                      and upper(regexp_replace(rut_proveedor,'[^0-9kK]','','g')) <> v_rut
                    group by 1,2 order by monto desc nulls last limit 10) t)
    ) into v_res;
  else
    v_rubro := p_rubro;
    select jsonb_build_object(
      'rut', p_rut,
      'vende_al_estado', false,
      'rubro_principal', v_rubro,
      'mercado_rubro', case when v_rubro is null then null else (
                    select jsonb_build_object(
                      'lineas', count(*),
                      'monto_total', round(sum(monto_linea)),
                      'organismos_compradores', count(distinct rut_organismo),
                      'proveedores_activos', count(distinct rut_proveedor),
                      'desde', min(fecha)::date, 'hasta', max(fecha)::date)
                    from oc_lineas where rubro_n1 = v_rubro) end,
      'top_compradores', case when v_rubro is null then '[]'::jsonb else (
                    select coalesce(jsonb_agg(t),'[]') from (
                    select organismo, rut_organismo, round(sum(monto_linea)) monto, count(*) lineas
                    from oc_lineas where rubro_n1 = v_rubro
                    group by 1,2 order by monto desc nulls last limit 10) t) end,
      'top_proveedores', case when v_rubro is null then '[]'::jsonb else (
                    select coalesce(jsonb_agg(t),'[]') from (
                    select proveedor_nombre, rut_proveedor, round(sum(monto_linea)) monto
                    from oc_lineas where rubro_n1 = v_rubro
                    group by 1,2 order by monto desc nulls last limit 10) t) end,
      'keywords_sugeridas', case when v_rubro is null then '[]'::jsonb else (
                    select coalesce(jsonb_agg(k),'[]') from (
                    select lower(w) k
                    from oc_lineas,
                         regexp_split_to_table(coalesce(producto,'')||' '||coalesce(categoria,''), '[^[:alnum:]áéíóúñ]+') w
                    where rubro_n1 = v_rubro and length(w) >= 4
                      and lower(w) not in ('para','unidad','unidades','otros','otras','servicio','servicios','producto','productos','compra','general','tipo','según','segun','marca')
                    group by 1 order by count(*) desc limit 20) s) end
    ) into v_res;
  end if;

  return v_res;
end;
$function$;

revoke all on function public.perfil_por_rut(text, text) from public, anon;
grant execute on function public.perfil_por_rut(text, text) to authenticated, service_role;
