-- Estas funciones SECURITY DEFINER se ejecutaban con el privilegio del dueño y
-- conservaban el EXECUTE implícito para PUBLIC/anon. Son tareas internas o de
-- mantenimiento: solo service_role debe poder invocarlas desde la API.
revoke execute on function public.cm_reclasificar_pendientes(integer) from public, anon, authenticated;
revoke execute on function public.cubo_refrescar() from public, anon, authenticated;
revoke execute on function public.cubo_refrescar_1d() from public, anon, authenticated;
revoke execute on function public.limpiar_duplicados_contactos() from public, anon, authenticated;
revoke execute on function public.registrar_enriquecimiento_log(text, integer, integer, integer, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.youtube_sincronizar_suscriptores(uuid) from public, anon, authenticated;
revoke execute on function public.marketing_actualizar_ultimo_contacto(uuid) from public, anon, authenticated;
revoke execute on function public.marketing_calcular_metricas(uuid, date) from public, anon, authenticated;
revoke execute on function public.marketing_importar_contactos(text, text, integer) from public, anon, authenticated;
revoke execute on function public.marketing_importar_webinars() from public, anon, authenticated;
revoke execute on function public.marketing_sincronizar_webinar() from public, anon, authenticated;

grant execute on function public.cm_reclasificar_pendientes(integer) to service_role;
grant execute on function public.cubo_refrescar() to service_role;
grant execute on function public.cubo_refrescar_1d() to service_role;
grant execute on function public.limpiar_duplicados_contactos() to service_role;
grant execute on function public.registrar_enriquecimiento_log(text, integer, integer, integer, integer, text, jsonb) to service_role;
grant execute on function public.youtube_sincronizar_suscriptores(uuid) to service_role;
grant execute on function public.marketing_actualizar_ultimo_contacto(uuid) to service_role;
grant execute on function public.marketing_calcular_metricas(uuid, date) to service_role;
grant execute on function public.marketing_importar_contactos(text, text, integer) to service_role;
grant execute on function public.marketing_importar_webinars() to service_role;
grant execute on function public.marketing_sincronizar_webinar() to service_role;

-- Esta es la única RPC invocada por la pantalla privada de Enrique. La propia
-- función valida la identidad porque una ruta oculta en el navegador no basta.
create or replace function public.marketing_registrar_auditoria(
  p_accion text,
  p_fuente text,
  p_cantidad integer,
  p_detalles jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> 'evaras@firmavb.cl' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.marketing_contactos_auditoria
    (accion, fuente, cantidad_afectada, detalles, realizado_por)
  values
    (p_accion, p_fuente, p_cantidad, p_detalles, auth.jwt() ->> 'email')
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.marketing_registrar_auditoria(text, text, integer, jsonb) from public, anon;
grant execute on function public.marketing_registrar_auditoria(text, text, integer, jsonb) to authenticated, service_role;
