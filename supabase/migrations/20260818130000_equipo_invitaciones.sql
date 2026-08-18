-- =====================================================================
-- Invitaciones de equipo: activación por email
-- =====================================================================
-- Se agrega a `vendedores` un token de activación y el estado de la invitación.
-- La edge function `invitar-miembro` crea el registro pendiente + envía el email;
-- `activar-miembro` crea la cuenta (contraseña) y la vincula.
alter table public.vendedores
  add column if not exists invite_token text,
  add column if not exists invitado_por uuid,
  add column if not exists estado_invitacion text not null default 'activada',
  add column if not exists invited_at timestamptz;

create unique index if not exists idx_vendedores_invite_token
  on public.vendedores (invite_token) where invite_token is not null;
