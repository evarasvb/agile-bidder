-- Vigía de cambios: cuando una licitación o compra ágil con la que un cliente ya
-- interactuó (match, bases subidas, oferta generada, o consulta en el Libro del
-- Experto) cambia después — se mueve el cierre, cambia el presupuesto, cambia de
-- estado, o le agregan un anexo nuevo — queda registrado en licitaciones_cambios.
-- El edge function evaristo-vigia (cron) procesa esos cambios: si hay clientes
-- interesados, Don Evaristo redacta un análisis de impacto breve y se les avisa
-- (memoria del chat + email), sin que tengan que darse cuenta solos.
--
-- Límite conocido (documentado, no resuelto aquí): un anexo con el MISMO nombre
-- pero contenido reemplazado no se detecta (licitacion-adjuntos hace upsert por
-- codigo+nombre); solo se detectan anexos nuevos. Requeriría comparar hash de
-- bytes, fuera de alcance de esta primera versión.

create table if not exists public.licitaciones_cambios (
  id uuid primary key default gen_random_uuid(),
  tipo_proceso text not null check (tipo_proceso in ('licitacion', 'compra_agil')),
  codigo text not null,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  detectado_en timestamptz not null default now(),
  procesado boolean not null default false
);
create index if not exists licitaciones_cambios_pendientes_idx on public.licitaciones_cambios (procesado, detectado_en) where not procesado;
create index if not exists licitaciones_cambios_codigo_idx on public.licitaciones_cambios (codigo, detectado_en desc);
alter table public.licitaciones_cambios enable row level security;
-- Sin políticas: solo service_role (el cron/edge function) lee y escribe.

-- Cambios en la ficha (fecha de cierre, segundo llamado, monto, estado). Se exige
-- que el valor ANTERIOR no sea null: un campo que recién se completa (primera
-- carga/enriquecimiento) no es un "cambio" que le importe a un cliente, solo lo es
-- cuando un valor ya conocido pasa a ser otro.
create or replace function public.registrar_cambio_proceso()
returns trigger
language plpgsql
as $$
declare
  v_tipo text := case tg_table_name when 'licitaciones' then 'licitacion' else 'compra_agil' end;
begin
  if old.fecha_cierre is not null and new.fecha_cierre is distinct from old.fecha_cierre then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values (v_tipo, new.codigo, 'fecha_cierre', old.fecha_cierre::text, new.fecha_cierre::text);
  end if;
  if old.fecha_cierre_segundo_llamado is not null and new.fecha_cierre_segundo_llamado is distinct from old.fecha_cierre_segundo_llamado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values (v_tipo, new.codigo, 'fecha_cierre_segundo_llamado', old.fecha_cierre_segundo_llamado::text, new.fecha_cierre_segundo_llamado::text);
  end if;
  if old.monto_estimado is not null and new.monto_estimado is distinct from old.monto_estimado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values (v_tipo, new.codigo, 'monto_estimado', old.monto_estimado::text, new.monto_estimado::text);
  end if;
  if old.estado is not null and new.estado is distinct from old.estado then
    insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
    values (v_tipo, new.codigo, 'estado', old.estado, new.estado);
  end if;
  return new;
end;
$$;

drop trigger if exists licitaciones_registrar_cambio on public.licitaciones;
create trigger licitaciones_registrar_cambio
  after update on public.licitaciones
  for each row execute function public.registrar_cambio_proceso();

drop trigger if exists compras_agiles_registrar_cambio on public.compras_agiles;
create trigger compras_agiles_registrar_cambio
  after update on public.compras_agiles
  for each row execute function public.registrar_cambio_proceso();

-- Anexo nuevo (licitacion-adjuntos hace upsert por codigo+nombre: un anexo con
-- nombre nuevo dispara un INSERT real, uno ya visto solo actualiza sus columnas).
create or replace function public.registrar_cambio_adjunto()
returns trigger
language plpgsql
as $$
begin
  insert into public.licitaciones_cambios (tipo_proceso, codigo, campo, valor_anterior, valor_nuevo)
  values ('licitacion', new.codigo, 'anexo_nuevo', null, new.nombre);
  return new;
end;
$$;

drop trigger if exists licitaciones_adjuntos_registrar_cambio on public.licitaciones_adjuntos;
create trigger licitaciones_adjuntos_registrar_cambio
  after insert on public.licitaciones_adjuntos
  for each row execute function public.registrar_cambio_adjunto();

-- Clientes con interés real en un código (match, bases subidas, oferta generada o
-- consulta en el Libro del Experto): a quién avisar cuando ese código cambia.
create or replace function public.vigia_clientes_interesados(p_codigo text)
returns table (cliente_id uuid, email text, empresa_nombre text)
language sql
stable
security definer
set search_path = public, experto, pg_catalog
as $$
  select distinct c.id, c.email, c.empresa_nombre
  from public.clientes c
  where c.email is not null
    and c.id in (
      select m.cliente_id from public.lic_item_matches m where m.licitacion_codigo = p_codigo
      union
      select m.cliente_id from public.ca_matches m where m.compra_agil_codigo = p_codigo
      union
      select o.cliente_id from public.cliente_ofertas o where o.licitacion_id = p_codigo
      union
      select cl.id from public.bases_licitacion b join public.clientes cl on cl.user_id = b.subido_por where b.codigo = p_codigo
      union
      select cl.id from experto.consultas q join public.clientes cl on cl.user_id = q.user_id where q.licitacion = p_codigo
    );
$$;

revoke execute on function public.vigia_clientes_interesados(text) from public, anon;
grant execute on function public.vigia_clientes_interesados(text) to service_role;

-- Cron: procesa los cambios pendientes cada 10 minutos.
select cron.unschedule(jobid) from cron.job where jobname = 'evaristo-vigia';
select cron.schedule('evaristo-vigia', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://juiskeeutbaipwbeeezw.supabase.co/functions/v1/evaristo-vigia',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_jwt_legacy')),
    body := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
