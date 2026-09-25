-- Fase 2 — Contactos de compradores públicos.
-- Objetivo: convertir el directorio (mv_compradores_publicos) en una lista lista
-- para campañas, capturando el CONTACTO INSTITUCIONAL de cada organismo dentro de
-- marketing_contactos (que ya trae consentimiento, origen, validación y estado).
-- Los compradores públicos se guardan con origen='comprador_publico' y el RUT del
-- organismo en campos_adicionales->>'rut_organismo' para poder cruzarlos.
-- Todo bajo la llave del fundador (email evaras@firmavb.cl), SECURITY DEFINER.

-- Índice para cruzar rápido el RUT del organismo guardado en el JSON.
create index if not exists idx_marketing_contactos_rut_organismo
  on public.marketing_contactos ((campos_adicionales->>'rut_organismo'))
  where origen = 'comprador_publico';

-- 1) Directorio con estado de contacto (reemplaza al anterior, agrega columnas).
drop function if exists public.fundador_directorio_compradores(text, integer);
create or replace function public.fundador_directorio_compradores(
  p_buscar text default null,
  p_limite integer default 500
)
returns table(
  institucion text, rut text, region text, sector text,
  n_oc bigint, monto_total numeric, ultima_compra timestamptz,
  contacto_email text, contacto_nombre text, contacto_estado text,
  tiene_contacto boolean, consentimiento boolean
)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then
    return;
  end if;
  return query
  select coalesce(m.institucion, '(sin nombre)') as institucion,
         m.rut, i.region, i.sector, m.n_oc, m.monto_total, m.ultima_compra,
         c.email, c.nombre, c.estado_contacto,
         (c.id is not null) as tiene_contacto,
         coalesce(c.consentimiento_marketing, false) as consentimiento
  from public.mv_compradores_publicos m
  left join public.instituciones i on i.rut = m.rut
  left join lateral (
    select mc.id, mc.email, mc.nombre, mc.estado_contacto, mc.consentimiento_marketing
    from public.marketing_contactos mc
    where mc.origen = 'comprador_publico'
      and mc.campos_adicionales->>'rut_organismo' = m.rut
    order by mc.actualizado_en desc nulls last
    limit 1
  ) c on true
  where (p_buscar is null or p_buscar = ''
         or m.institucion ilike '%' || p_buscar || '%'
         or m.rut ilike '%' || p_buscar || '%')
  order by m.monto_total desc nulls last
  limit greatest(coalesce(p_limite, 500), 1);
end;
$$;

-- 2) Resumen de cobertura para las métricas del panel.
create or replace function public.fundador_compradores_resumen()
returns table(total_organismos bigint, con_contacto bigint, con_consentimiento bigint)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then
    return;
  end if;
  return query
  select
    (select count(*) from public.mv_compradores_publicos)::bigint,
    (select count(distinct campos_adicionales->>'rut_organismo')
       from public.marketing_contactos
      where origen = 'comprador_publico'
        and coalesce(email,'') <> '')::bigint,
    (select count(distinct campos_adicionales->>'rut_organismo')
       from public.marketing_contactos
      where origen = 'comprador_publico'
        and consentimiento_marketing = true)::bigint;
end;
$$;

-- 3) Guardar / actualizar el contacto de un comprador (upsert por RUT organismo).
create or replace function public.fundador_comprador_guardar_contacto(
  p_rut text,
  p_institucion text,
  p_email text,
  p_nombre text default null,
  p_cargo text default null,
  p_telefono text default null,
  p_consentimiento boolean default false
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
  v_email text := nullif(btrim(lower(p_email)), '');
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then
    raise exception 'no autorizado';
  end if;
  if p_rut is null or btrim(p_rut) = '' then
    raise exception 'RUT del organismo requerido';
  end if;

  select id into v_id
  from public.marketing_contactos
  where origen = 'comprador_publico'
    and campos_adicionales->>'rut_organismo' = p_rut
  limit 1;

  if v_id is null then
    insert into public.marketing_contactos (
      email, nombre, empresa, telefono, origen, fuente_datos, fuente_primaria,
      estado_contacto, estado_suscripcion, consentimiento_marketing,
      consentimiento_fecha, etiquetas, campos_adicionales, creado_en, actualizado_en
    ) values (
      v_email, nullif(btrim(p_nombre),''), nullif(btrim(p_institucion),''),
      nullif(btrim(p_telefono),''), 'comprador_publico', 'directorio_mp', 'directorio_mp',
      case when v_email is null then 'sin_contacto' else 'pendiente_contacto' end,
      'suscrito',
      coalesce(p_consentimiento,false),
      case when p_consentimiento then now() else null end,
      array['comprador_publico'],
      jsonb_build_object('rut_organismo', p_rut, 'cargo', nullif(btrim(p_cargo),'')),
      now(), now()
    ) returning id into v_id;
  else
    update public.marketing_contactos set
      email = coalesce(v_email, email),
      nombre = coalesce(nullif(btrim(p_nombre),''), nombre),
      empresa = coalesce(nullif(btrim(p_institucion),''), empresa),
      telefono = coalesce(nullif(btrim(p_telefono),''), telefono),
      estado_contacto = case when coalesce(v_email, email) is null then 'sin_contacto' else estado_contacto end,
      consentimiento_marketing = coalesce(p_consentimiento, consentimiento_marketing),
      consentimiento_fecha = case when p_consentimiento and consentimiento_fecha is null then now() else consentimiento_fecha end,
      campos_adicionales = coalesce(campos_adicionales,'{}'::jsonb)
        || jsonb_build_object('rut_organismo', p_rut)
        || case when nullif(btrim(p_cargo),'') is not null
                then jsonb_build_object('cargo', btrim(p_cargo)) else '{}'::jsonb end,
      actualizado_en = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

-- 4) Importar en lote: recibe un arreglo JSON [{rut,email,nombre?,cargo?,institucion?}].
create or replace function public.fundador_comprador_importar_contactos(p_items jsonb)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_item jsonb;
  v_n integer := 0;
  v_inst text;
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then
    raise exception 'no autorizado';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return 0;
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if coalesce(btrim(v_item->>'rut'),'') = '' then continue; end if;
    -- Si no viene institución, la tomamos del directorio.
    v_inst := nullif(btrim(v_item->>'institucion'),'');
    if v_inst is null then
      select institucion into v_inst from public.mv_compradores_publicos where rut = btrim(v_item->>'rut') limit 1;
    end if;
    perform public.fundador_comprador_guardar_contacto(
      btrim(v_item->>'rut'), v_inst, v_item->>'email',
      v_item->>'nombre', v_item->>'cargo', v_item->>'telefono', false
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.fundador_comprador_guardar_contacto(text,text,text,text,text,text,boolean) from public, anon;
revoke all on function public.fundador_comprador_importar_contactos(jsonb) from public, anon;
revoke all on function public.fundador_compradores_resumen() from public, anon;
grant execute on function public.fundador_comprador_guardar_contacto(text,text,text,text,text,text,boolean) to authenticated;
grant execute on function public.fundador_comprador_importar_contactos(jsonb) to authenticated;
grant execute on function public.fundador_compradores_resumen() to authenticated;
