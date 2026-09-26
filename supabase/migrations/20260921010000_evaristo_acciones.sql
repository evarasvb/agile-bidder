-- Don Evaristo ejecutor: cola de acciones que la extensión de Chrome ejecuta en
-- Mercado Público (sincronizar una licitación y sus bases, traer documentos de una
-- compra ágil, dejar la oferta lista para revisar, publicar productos en Convenio Marco).
-- Evaristo (chat) crea la acción; la extensión la reclama vía extension-api, la ejecuta
-- en el navegador del usuario (con su sesión de Mercado Público) y reporta el resultado.

create table if not exists public.evaristo_acciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_id uuid references public.clientes(id) on delete cascade,
  conversacion_id uuid references public.evaristo_conversaciones(id) on delete set null,
  tipo text not null check (tipo in ('sincronizar_licitacion','sincronizar_ca','preparar_oferta','publicar_cm')),
  codigo text,
  payload jsonb not null default '{}'::jsonb,
  -- confirmar: espera que el usuario apriete "Confirmar" en el chat (acciones que publican).
  -- pendiente: la extensión la toma en su próximo ciclo (cada minuto).
  estado text not null default 'pendiente' check (estado in ('confirmar','pendiente','en_curso','hecha','fallida','cancelada')),
  resultado jsonb,
  error text,
  creada_por text not null default 'evaristo',
  api_key_id uuid,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  iniciada_en timestamptz,
  terminada_en timestamptz
);

create index if not exists evaristo_acciones_cliente_estado_idx on public.evaristo_acciones (cliente_id, estado, creado_en);
create index if not exists evaristo_acciones_user_idx on public.evaristo_acciones (user_id, creado_en desc);

-- cliente_id sale del usuario; actualizado_en se mantiene solo.
create or replace function public.evaristo_acciones_antes()
returns trigger language plpgsql as $$
begin
  if new.cliente_id is null then
    select c.id into new.cliente_id from public.clientes c where c.user_id = new.user_id limit 1;
  end if;
  new.actualizado_en := now();
  return new;
end $$;

drop trigger if exists evaristo_acciones_antes on public.evaristo_acciones;
create trigger evaristo_acciones_antes before insert or update on public.evaristo_acciones
  for each row execute function public.evaristo_acciones_antes();

alter table public.evaristo_acciones enable row level security;

drop policy if exists "acciones propias: leer" on public.evaristo_acciones;
create policy "acciones propias: leer" on public.evaristo_acciones
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "acciones propias: crear" on public.evaristo_acciones;
create policy "acciones propias: crear" on public.evaristo_acciones
  for insert to authenticated with check (user_id = auth.uid());

-- Confirmar o cancelar desde el chat. Las transiciones válidas viven aquí, no en RLS.
create or replace function public.evaristo_accion_decidir(p_id uuid, p_confirmar boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_estado text;
  v_row public.evaristo_acciones;
begin
  select estado into v_estado from public.evaristo_acciones where id = p_id and user_id = auth.uid();
  if v_estado is null then
    raise exception 'accion no encontrada';
  end if;
  if p_confirmar then
    if v_estado <> 'confirmar' then
      raise exception 'la accion no esta esperando confirmacion (estado %)', v_estado;
    end if;
    update public.evaristo_acciones set estado = 'pendiente' where id = p_id returning * into v_row;
  else
    if v_estado not in ('confirmar','pendiente') then
      raise exception 'la accion ya no se puede cancelar (estado %)', v_estado;
    end if;
    update public.evaristo_acciones set estado = 'cancelada', terminada_en = now() where id = p_id returning * into v_row;
  end if;
  return to_jsonb(v_row);
end $$;

grant execute on function public.evaristo_accion_decidir(uuid, boolean) to authenticated;

-- El chat sigue el estado en vivo.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'evaristo_acciones') then
    alter publication supabase_realtime add table public.evaristo_acciones;
  end if;
end $$;

-- El contexto en vivo de Evaristo incluye las últimas acciones.
create or replace function public.evaristo_acciones_recientes(p_limite int default 6)
returns jsonb language sql stable security invoker as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.creado_en desc), '[]'::jsonb)
  from (
    select id, tipo, codigo, estado, error, resultado, creado_en, terminada_en
    from public.evaristo_acciones where user_id = auth.uid()
    order by creado_en desc limit greatest(1, least(p_limite, 20))
  ) a;
$$;

grant execute on function public.evaristo_acciones_recientes(int) to authenticated;
