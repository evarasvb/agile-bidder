-- Bases de licitacion que suben los usuarios (PDF): el Experto las lee como fuente principal
-- para criterios de evaluacion, ponderaciones, garantias, plazos, multas y clausulas.
-- Se comparten por codigo de licitacion (las bases son documentos publicos): lo que sube un
-- cliente le sirve a los demas. Mercado Publico protege los adjuntos con reCAPTCHA, por eso
-- se trabaja con el cliente en vez de descargarlas automaticamente.

create table if not exists public.bases_licitacion (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  archivo text,
  storage_path text,
  paginas integer,
  caracteres integer,
  texto text,
  secciones jsonb,
  resumen jsonb,
  subido_por uuid,
  creado_en timestamptz not null default now()
);
create index if not exists bases_licitacion_codigo_idx on public.bases_licitacion (codigo, creado_en desc);
alter table public.bases_licitacion enable row level security;
-- Sin politicas: solo service_role (edge functions y RPC) lee y escribe.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bases-licitacion', 'bases-licitacion', false, 31457280, array['application/pdf'])
on conflict (id) do nothing;

-- Texto para el Experto (solo service_role).
create or replace function public.experto_bases_texto(p_codigo text)
returns table (id uuid, archivo text, paginas integer, caracteres integer, resumen jsonb, secciones jsonb, creado_en timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.archivo, b.paginas, b.caracteres, b.resumen, b.secciones, b.creado_en
  from public.bases_licitacion b
  where upper(b.codigo) = upper(p_codigo) and coalesce(b.caracteres, 0) > 200
  order by b.creado_en desc
  limit 4;
$$;
revoke all on function public.experto_bases_texto(text) from public, anon, authenticated;
grant execute on function public.experto_bases_texto(text) to service_role;

-- Estado (cuantos archivos hay) para mostrar en la interfaz.
create or replace function public.experto_bases_estado(p_codigo text)
returns table (archivos integer, paginas integer, ultimo timestamptz)
language sql stable security definer set search_path = public as $$
  select count(*)::int, coalesce(sum(b.paginas), 0)::int, max(b.creado_en)
  from public.bases_licitacion b
  where upper(b.codigo) = upper(p_codigo) and coalesce(b.caracteres, 0) > 200;
$$;
grant execute on function public.experto_bases_estado(text) to anon, authenticated, service_role;
