-- Panel de ajustes del ERP: interruptores de avisos + aviso de documentos.
-- Los crons de avisos consultan ajustes_avisos.activo antes de disparar el correo,
-- así el fundador prende/apaga cada aviso desde una pantalla sin tocar código.

create table if not exists public.ajustes_avisos (
  clave text primary key,
  etiqueta text not null,
  descripcion text,
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);
alter table public.ajustes_avisos enable row level security;
-- Acceso solo vía RPC del fundador (SECURITY DEFINER). Sin políticas.

insert into public.ajustes_avisos (clave, etiqueta, descripcion) values
  ('alerta-cita-email', 'Nueva cita agendada', 'Correo cuando alguien agenda una reunión.'),
  ('alerta-registro-email', 'Nuevo registro en la app', 'Correo cuando alguien se registra.'),
  ('alerta-onboarding-email', 'Onboarding completado', 'Correo cuando un cliente termina su configuración.'),
  ('alerta-drive-email', 'Conexión de Google Drive', 'Correo cuando un cliente conecta su Drive.'),
  ('alerta-documento-email', 'Documento subido', 'Correo cuando un cliente sube un documento.')
on conflict (clave) do nothing;

-- Lista de ajustes (fundador).
create or replace function public.fundador_ajustes_listar()
returns table(clave text, etiqueta text, descripcion text, activo boolean, actualizado_en timestamptz)
language sql security definer set search_path to 'public'
as $$
  select a.clave, a.etiqueta, a.descripcion, a.activo, a.actualizado_en
  from public.ajustes_avisos a
  where (select auth.jwt() ->> 'email') = 'evaras@firmavb.cl'
  order by a.etiqueta;
$$;

-- Prender/apagar un aviso (fundador).
create or replace function public.fundador_ajuste_set(p_clave text, p_activo boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if coalesce((select auth.jwt() ->> 'email'), '') <> 'evaras@firmavb.cl' then raise exception 'no autorizado'; end if;
  update public.ajustes_avisos set activo = p_activo, actualizado_en = now() where clave = p_clave;
end; $$;

revoke all on function public.fundador_ajustes_listar() from public, anon;
revoke all on function public.fundador_ajuste_set(text, boolean) from public, anon;
grant execute on function public.fundador_ajustes_listar() to authenticated;
grant execute on function public.fundador_ajuste_set(text, boolean) to authenticated;

-- Aviso de documentos: marca + RPC de pendientes.
alter table public.cliente_documentos
  add column if not exists avisado boolean not null default false;
update public.cliente_documentos set avisado = true where avisado = false;
create index if not exists idx_cliente_documentos_avisado
  on public.cliente_documentos (avisado) where avisado = false;

create or replace function public.documentos_por_avisar()
returns table(id uuid, nombre text, tipo text, empresa text, email text, subido_en timestamptz)
language sql security definer set search_path to 'public'
as $$
  select d.id, d.nombre, d.tipo,
         coalesce(c.empresa_nombre, c.nombre_responsable),
         coalesce(c.email, c.email_contacto, p.email),
         d.created_at
  from public.cliente_documentos d
  left join public.clientes c on c.id = d.cliente_id
  left join public.profiles p on p.id = c.user_id
  where d.avisado = false
  order by d.created_at;
$$;

revoke all on function public.documentos_por_avisar() from public, anon, authenticated;
grant execute on function public.documentos_por_avisar() to service_role;
