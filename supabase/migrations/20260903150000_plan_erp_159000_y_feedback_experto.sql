-- Plan de suscripcion FirmaVB ERP: $159.000 / mes (incluye Experto Pro y Plus).
update public.planes set precio_mensual = 159000, nombre = 'FirmaVB ERP' where id = 'pro';

-- Feedback del usuario sobre cada respuesta del Experto: sirve para mejorar dia a dia y
-- se reinyecta como memoria en las proximas respuestas de ese usuario.
create table if not exists experto.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  huella text,
  pregunta text,
  util boolean,
  comentario text,
  creado_en timestamptz not null default now()
);
create index if not exists feedback_user_idx on experto.feedback (user_id, creado_en desc);
create index if not exists feedback_huella_idx on experto.feedback (huella, creado_en desc);
alter table experto.feedback enable row level security;

create or replace function public.experto_feedback(p_huella text, p_pregunta text, p_util boolean, p_comentario text default null)
returns void language sql security definer set search_path = public, experto as $$
  insert into experto.feedback (user_id, huella, pregunta, util, comentario)
  values (auth.uid(), left(p_huella, 80), left(p_pregunta, 500), p_util, nullif(left(p_comentario, 600), ''));
$$;
grant execute on function public.experto_feedback(text, text, boolean, text) to anon, authenticated;

create or replace function public.experto_memoria(p_user_id uuid, p_huella text)
returns table (pregunta text, comentario text, util boolean, creado_en timestamptz)
language sql stable security definer set search_path = public, experto as $$
  select f.pregunta, f.comentario, f.util, f.creado_en from experto.feedback f
  where f.comentario is not null
    and ((p_user_id is not null and f.user_id = p_user_id) or (p_user_id is null and f.huella = p_huella))
  order by f.creado_en desc limit 4;
$$;
revoke all on function public.experto_memoria(uuid, text) from public, anon, authenticated;
grant execute on function public.experto_memoria(uuid, text) to service_role;
