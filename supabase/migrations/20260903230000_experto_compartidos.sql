-- Analisis compartidos del Experto: pagina publica con marca FirmaVB (marketing) y contador de vistas.
-- Aplicado en prod como experto_compartidos.
create table if not exists public.experto_compartidos (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(9), 'hex'),
  user_id uuid not null,
  codigo text,
  tipo text not null,
  titulo text,
  empresa text,
  contenido text not null,
  vistas integer not null default 0,
  creado_en timestamptz not null default now()
);
alter table public.experto_compartidos enable row level security;
drop policy if exists experto_compartidos_propios on public.experto_compartidos;
create policy experto_compartidos_propios on public.experto_compartidos for select to authenticated using (user_id = auth.uid());

create or replace function public.experto_compartir(p_codigo text, p_tipo text, p_titulo text, p_contenido text)
returns text language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'login'; end if;
  insert into public.experto_compartidos (user_id, codigo, tipo, titulo, empresa, contenido)
  values (auth.uid(), upper(p_codigo), left(p_tipo, 20), left(p_titulo, 200),
          (select c.empresa_nombre from public.clientes c where c.user_id = auth.uid() limit 1), left(p_contenido, 60000))
  returning token into t;
  return t;
end $$;
grant execute on function public.experto_compartir(text, text, text, text) to authenticated;

create or replace function public.experto_compartido(p_token text)
returns table (codigo text, tipo text, titulo text, empresa text, contenido text, creado_en timestamptz, vistas integer)
language plpgsql security definer set search_path = public as $$
begin
  update public.experto_compartidos set vistas = vistas + 1 where token = p_token;
  return query select c.codigo, c.tipo, c.titulo, c.empresa, c.contenido, c.creado_en, c.vistas from public.experto_compartidos c where c.token = p_token;
end $$;
grant execute on function public.experto_compartido(text) to anon, authenticated;
