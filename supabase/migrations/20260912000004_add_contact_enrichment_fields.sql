-- Add contact enrichment and validation fields for automatic data quality
-- Sistema de enriquecimiento automático y limpieza de contactos

-- Extend marketing_contactos with validation and enrichment tracking
alter table public.marketing_contactos
add column if not exists email_validado boolean default false,
add column if not exists estado_email text default 'desconocido', -- valido, invalido, rebote, desconocido
add column if not exists ultima_validacion timestamptz,
add column if not exists rubro text, -- Tecnologia, Ferreteria, Alimentos, Oficina, Servicios, Extranjera
add column if not exists fuente_primaria text, -- mercadopublico, datos_abiertos, api_estado, enriquecimiento
add column if not exists intentos_validacion int default 0,
add column if not exists datos_enriquecimiento jsonb; -- almacena datos adicionales obtenidos

-- Create index for efficient validation filtering
create index if not exists idx_marketing_contactos_email_validado on public.marketing_contactos(email_validado);
create index if not exists idx_marketing_contactos_rubro on public.marketing_contactos(rubro);
create index if not exists idx_marketing_contactos_fuente_primaria on public.marketing_contactos(fuente_primaria);
create index if not exists idx_marketing_contactos_estado_email on public.marketing_contactos(estado_email);
create index if not exists idx_marketing_contactos_ultima_validacion on public.marketing_contactos(ultima_validacion);

-- Table for tracking enrichment processes and statistics
create table if not exists public.contact_enrichment_logs (
  id uuid primary key default gen_random_uuid(),
  proceso text not null, -- mercadopublico_sync, email_validation, deduplication, bounce_cleanup
  fecha_inicio timestamptz not null default now(),
  fecha_fin timestamptz,
  estado text default 'procesando', -- procesando, completado, error
  registros_procesados int default 0,
  registros_nuevos int default 0,
  registros_actualizados int default 0,
  errores int default 0,
  mensaje_error text,
  metadata jsonb
);

-- Table for tracking data sources and their sync status
create table if not exists public.contact_data_sources (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique, -- mercadopublico, datos_abiertos, api_estado, etc
  descripcion text,
  tipo_fuente text, -- api, base_datos, archivo, scraping
  ultima_sincronizacion timestamptz,
  proxima_sincronizacion timestamptz,
  estado text default 'activo', -- activo, inactivo, error
  configuracion jsonb, -- URL, credenciales, parámetros
  registros_obtenidos int default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.contact_data_sources enable row level security;
create policy contact_data_sources_admin on public.contact_data_sources
  for all to authenticated using ((auth.jwt() ->> 'email') = 'evaras@firmavb.cl');

-- Function para validar emails con lógica básica
create or replace function public.validar_email_basico(p_email text)
returns text language plpgsql as $$
declare
  v_regex_result boolean;
begin
  -- Validación básica de formato email
  v_regex_result := p_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';

  if not v_regex_result then
    return 'invalido';
  end if;

  -- Checks para dominios comunes inválidos
  if p_email ilike '%@test.%' or
     p_email ilike '%@example.%' or
     p_email ilike '%@invalid.%' or
     p_email ilike '%@localhost%' then
    return 'invalido';
  end if;

  return 'valido';
end $$;

-- Function para limpiar contactos duplicados
create or replace function public.limpiar_duplicados_contactos()
returns table(eliminados int, procesados int) language plpgsql security definer set search_path = public as $$
declare
  v_eliminados int := 0;
  v_procesados int := 0;
  v_row record;
begin
  -- Encontrar y marcar duplicados (mantener el más reciente)
  for v_row in
    select
      lower(email) as email_lower,
      array_agg(id order by creado_en desc) as ids
    from public.marketing_contactos
    where email is not null
    group by lower(email)
    having count(*) > 1
  loop
    v_procesados := v_procesados + 1;

    -- Marcar como duplicate todos excepto el primero (más reciente)
    update public.marketing_contactos
    set categoria = categoria || '_DUPLICADO'
    where id = any(v_row.ids[2:]);

    v_eliminados := v_eliminados + array_length(v_row.ids[2:], 1);
  end loop;

  return query select v_eliminados, v_procesados;
end $$;

-- Function para registrar log de enriquecimiento
create or replace function public.registrar_enriquecimiento_log(
  p_proceso text,
  p_registros_procesados int,
  p_registros_nuevos int,
  p_registros_actualizados int,
  p_errores int default 0,
  p_mensaje_error text default null,
  p_metadata jsonb default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_log_id uuid;
begin
  insert into public.contact_enrichment_logs (
    proceso, registros_procesados, registros_nuevos, registros_actualizados,
    errores, mensaje_error, metadata, estado, fecha_fin
  ) values (
    p_proceso, p_registros_procesados, p_registros_nuevos, p_registros_actualizados,
    p_errores, p_mensaje_error, p_metadata, 'completado', now()
  )
  returning id into v_log_id;

  return v_log_id;
end $$;

-- Initial data sources configuration
insert into public.contact_data_sources (nombre, descripcion, tipo_fuente, configuracion)
values
  ('mercadopublico', 'Proveedores registrados en Mercado Público Chile', 'api', '{"url": "https://apis.mercadopublico.cl", "actualizar_cada_dias": 7}'),
  ('datos_abiertos', 'Datos abiertos del Estado de Chile', 'api', '{"url": "https://datos.gob.cl", "actualizar_cada_dias": 30}'),
  ('empresas_chilenas', 'Registro de empresas SII Chile', 'api', '{"url": "https://www.sii.cl", "actualizar_cada_dias": 30}')
on conflict (nombre) do nothing;
