-- Fase 2 (cont.) — Encargados reales de MP + varios correos por organismo.
-- marketing_contactos exige email ÚNICO y NOT NULL: es una tabla de correos.
-- Por eso separamos:
--  * compradores_encargados  → intel: nombres/cargos de encargados publicados por
--    cada organismo en Mercado Público (objeto "Comprador"). Sin correo.
--  * marketing_contactos     → correos reales para campañas (uno o varios por
--    organismo), con consentimiento. Se cargan a mano o por importación.

create table if not exists public.compradores_encargados (
  id uuid primary key default gen_random_uuid(),
  rut_organismo text not null,
  nombre text not null,
  cargo text,
  unidad text,
  comuna text,
  region text,
  fuente text not null default 'mercadopublico_comprador',
  creado_en timestamptz not null default now(),
  unique (rut_organismo, nombre)
);
create index if not exists idx_compradores_encargados_rut on public.compradores_encargados (rut_organismo);
alter table public.compradores_encargados enable row level security;
-- Sin políticas: solo accesible vía RPC SECURITY DEFINER (llave del fundador).

-- Semilla idempotente de encargados desde licitaciones_bi.Comprador.
insert into public.compradores_encargados (rut_organismo, nombre, cargo, unidad, comuna, region)
select distinct on (c.rut_unidad, c.nombre_usuario)
  c.rut_unidad, c.nombre_usuario,
  nullif(btrim(c.cargo_usuario),''), nullif(btrim(c.nombre_unidad),''),
  nullif(btrim(c.comuna_unidad),''), nullif(btrim(c.region_unidad),'')
from (
  select distinct
    raw_data->'Comprador'->>'RutUnidad' rut_unidad,
    btrim(raw_data->'Comprador'->>'NombreUsuario') nombre_usuario,
    raw_data->'Comprador'->>'CargoUsuario' cargo_usuario,
    raw_data->'Comprador'->>'NombreUnidad' nombre_unidad,
    raw_data->'Comprador'->>'ComunaUnidad' comuna_unidad,
    raw_data->'Comprador'->>'RegionUnidad' region_unidad
  from public.licitaciones_bi
  where raw_data ? 'Comprador'
    and coalesce(btrim(raw_data->'Comprador'->>'NombreUsuario'),'') <> ''
) c
join public.mv_compradores_publicos m on m.rut = c.rut_unidad
on conflict (rut_organismo, nombre) do nothing;

-- Guardar correo real (uno o varios por organismo). Email OBLIGATORIO.
create or replace function public.fundador_comprador_guardar_contacto(
  p_rut text, p_institucion text, p_email text,
  p_nombre text default null, p_cargo text default null, p_telefono text default null,
  p_consentimiento boolean default false, p_id uuid default null
)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid := p_id; v_email text := nullif(btrim(lower(p_email)), '');
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then raise exception 'no autorizado'; end if;
  if p_rut is null or btrim(p_rut) = '' then raise exception 'RUT del organismo requerido'; end if;
  if v_email is null then raise exception 'correo requerido'; end if;

  -- Dedupe por correo (es único en la tabla).
  if v_id is null then
    select id into v_id from public.marketing_contactos where lower(email) = v_email limit 1;
  end if;

  if v_id is null then
    insert into public.marketing_contactos (
      email, nombre, empresa, telefono, origen, fuente_datos, fuente_primaria,
      estado_contacto, estado_suscripcion, consentimiento_marketing,
      consentimiento_fecha, etiquetas, campos_adicionales, creado_en, actualizado_en
    ) values (
      v_email, nullif(btrim(p_nombre),''), nullif(btrim(p_institucion),''),
      nullif(btrim(p_telefono),''), 'comprador_publico', 'directorio_mp', 'directorio_mp',
      'pendiente_contacto', 'suscrito',
      coalesce(p_consentimiento,false), case when p_consentimiento then now() else null end,
      array['comprador_publico'],
      jsonb_strip_nulls(jsonb_build_object('rut_organismo', p_rut, 'cargo', nullif(btrim(p_cargo),''))),
      now(), now()
    ) returning id into v_id;
  else
    update public.marketing_contactos set
      nombre = coalesce(nullif(btrim(p_nombre),''), nombre),
      empresa = coalesce(nullif(btrim(p_institucion),''), empresa),
      telefono = coalesce(nullif(btrim(p_telefono),''), telefono),
      consentimiento_marketing = coalesce(p_consentimiento, consentimiento_marketing),
      consentimiento_fecha = case when p_consentimiento and consentimiento_fecha is null then now() else consentimiento_fecha end,
      campos_adicionales = coalesce(campos_adicionales,'{}'::jsonb) || jsonb_build_object('rut_organismo', p_rut)
        || case when nullif(btrim(p_cargo),'') is not null then jsonb_build_object('cargo', btrim(p_cargo)) else '{}'::jsonb end,
      actualizado_en = now()
    where id = v_id;
  end if;
  return v_id;
end; $$;

-- Contactos con correo real de un organismo.
create or replace function public.fundador_comprador_contactos(p_rut text)
returns table(id uuid, nombre text, cargo text, email text, telefono text, consentimiento boolean, estado text)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return; end if;
  return query
  select mc.id, mc.nombre, mc.campos_adicionales->>'cargo', mc.email, mc.telefono,
         coalesce(mc.consentimiento_marketing,false), mc.estado_contacto
  from public.marketing_contactos mc
  where mc.origen='comprador_publico' and mc.campos_adicionales->>'rut_organismo' = p_rut
  order by mc.nombre nulls last;
end; $$;

-- Encargados conocidos (intel) de un organismo.
create or replace function public.fundador_comprador_encargados(p_rut text)
returns table(id uuid, nombre text, cargo text, unidad text, region text)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return; end if;
  return query
  select e.id, e.nombre, e.cargo, e.unidad, e.region
  from public.compradores_encargados e
  where e.rut_organismo = p_rut order by e.nombre;
end; $$;

create or replace function public.fundador_comprador_eliminar_contacto(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then raise exception 'no autorizado'; end if;
  delete from public.marketing_contactos where id = p_id and origen='comprador_publico';
end; $$;

-- Directorio con conteo de correos + encargados conocidos.
drop function if exists public.fundador_directorio_compradores(text, integer);
create or replace function public.fundador_directorio_compradores(
  p_buscar text default null, p_limite integer default 500
)
returns table(
  institucion text, rut text, region text, sector text,
  n_oc bigint, monto_total numeric, ultima_compra timestamptz,
  n_correos bigint, n_encargados bigint, encargados text,
  tiene_contacto boolean, consentimiento boolean
)
language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then return; end if;
  return query
  select coalesce(m.institucion, '(sin nombre)'),
         m.rut, i.region, i.sector, m.n_oc, m.monto_total, m.ultima_compra,
         coalesce(mc.n_correos,0), coalesce(en.n_enc,0), en.nombres,
         coalesce(mc.n_correos,0) > 0, coalesce(mc.consiente,false)
  from public.mv_compradores_publicos m
  left join public.instituciones i on i.rut = m.rut
  left join lateral (
    select count(*) filter (where coalesce(email,'') <> '') n_correos,
           bool_or(coalesce(consentimiento_marketing,false)) consiente
    from public.marketing_contactos
    where origen='comprador_publico' and campos_adicionales->>'rut_organismo' = m.rut
  ) mc on true
  left join lateral (
    select count(*) n_enc, string_agg(nombre, ', ' order by nombre) nombres
    from public.compradores_encargados where rut_organismo = m.rut
  ) en on true
  where (p_buscar is null or p_buscar = '' or m.institucion ilike '%'||p_buscar||'%' or m.rut ilike '%'||p_buscar||'%')
  order by m.monto_total desc nulls last
  limit greatest(coalesce(p_limite,500),1);
end; $$;

revoke all on function public.fundador_comprador_guardar_contacto(text,text,text,text,text,text,boolean,uuid) from public, anon;
revoke all on function public.fundador_comprador_contactos(text) from public, anon;
revoke all on function public.fundador_comprador_encargados(text) from public, anon;
revoke all on function public.fundador_comprador_eliminar_contacto(uuid) from public, anon;
grant execute on function public.fundador_comprador_guardar_contacto(text,text,text,text,text,text,boolean,uuid) to authenticated;
grant execute on function public.fundador_comprador_contactos(text) to authenticated;
grant execute on function public.fundador_comprador_encargados(text) to authenticated;
grant execute on function public.fundador_comprador_eliminar_contacto(uuid) to authenticated;
